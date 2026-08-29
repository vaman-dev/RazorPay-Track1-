import express from "express";
import crypto from "crypto";

import db from "../db/db.js";

import {

    finalizeCapturedPayment,

    finalizeFailedPayment,

} from "../services/paymentService.js";


const router =
    express.Router();


// =========================================================
// ENVIRONMENT CHECK
// =========================================================

if (
    !process.env
        .RAZORPAY_WEBHOOK_SECRET
) {

    throw new Error(
        "RAZORPAY_WEBHOOK_SECRET is missing"
    );

}


// =========================================================
// VERIFY RAZORPAY WEBHOOK SIGNATURE
// =========================================================

function verifyWebhookSignature({

    rawBody,

    receivedSignature,

}) {

    if (!receivedSignature) {

        return false;

    }


    const expectedSignature =
        crypto
            .createHmac(
                "sha256",
                process.env
                    .RAZORPAY_WEBHOOK_SECRET
            )
            .update(rawBody)
            .digest("hex");


    const expectedBuffer =
        Buffer.from(
            expectedSignature,
            "utf8"
        );


    const receivedBuffer =
        Buffer.from(
            receivedSignature,
            "utf8"
        );


    if (
        expectedBuffer.length !==
        receivedBuffer.length
    ) {

        return false;

    }


    return crypto
        .timingSafeEqual(
            expectedBuffer,
            receivedBuffer
        );

}


// =========================================================
// GENERATE FALLBACK EVENT ID
// =========================================================
//
// Razorpay normally provides:
// x-razorpay-event-id
//
// Fallback exists mainly for development/testing tools.
//

function generateFallbackEventId(
    rawBody
) {

    const hash =
        crypto
            .createHash("sha256")
            .update(rawBody)
            .digest("hex");


    return `fallback_${hash}`;

}


// =========================================================
// FIND WEBHOOK EVENT
// =========================================================

function getWebhookEvent(
    eventId
) {

    return db
        .prepare(`
            SELECT *
            FROM webhook_events
            WHERE provider_event_id = ?
        `)
        .get(eventId) || null;

}


// =========================================================
// REGISTER WEBHOOK EVENT
// =========================================================

function registerWebhookEvent({

    eventId,

    eventType,

    rawPayload,

}) {

    const existing =
        getWebhookEvent(
            eventId
        );


    if (existing) {

        return existing;

    }


    db.prepare(`
        INSERT INTO webhook_events (
            provider,
            provider_event_id,
            event_type,
            payload,
            processed
        )
        VALUES (?, ?, ?, ?, 0)
    `)
        .run(

            "razorpay",

            eventId,

            eventType,

            rawPayload

        );


    return getWebhookEvent(
        eventId
    );

}


// =========================================================
// MARK WEBHOOK PROCESSED
// =========================================================

function markWebhookProcessed(
    eventId
) {

    db.prepare(`
        UPDATE webhook_events

        SET
            processed = 1,
            processed_at =
                CURRENT_TIMESTAMP

        WHERE provider_event_id = ?
    `)
        .run(eventId);

}


// =========================================================
// POST /webhook
// =========================================================

router.post(
    "/",
    (
        req,
        res
    ) => {

        // -------------------------------------------------
        // IMPORTANT:
        //
        // Because server.js mounted express.raw(),
        // req.body MUST be a Buffer here.
        // -------------------------------------------------

        const rawBody =
            req.body;


        if (
            !Buffer.isBuffer(
                rawBody
            )
        ) {

            console.error(
                "Webhook body is not raw Buffer."
            );


            return res
                .status(400)
                .json({

                    success:
                        false,

                    error:
                        "INVALID_WEBHOOK_BODY",

                });

        }


        // -------------------------------------------------
        // Razorpay signature
        // -------------------------------------------------

        const receivedSignature =
            req.get(
                "x-razorpay-signature"
            );


        const signatureValid =
            verifyWebhookSignature({

                rawBody,

                receivedSignature,

            });


        if (!signatureValid) {

            console.error(
                "Invalid Razorpay webhook signature."
            );


            return res
                .status(401)
                .json({

                    success:
                        false,

                    error:
                        "INVALID_WEBHOOK_SIGNATURE",

                });

        }


        // -------------------------------------------------
        // Parse JSON ONLY AFTER signature verification
        // -------------------------------------------------

        let event;


        try {

            event =
                JSON.parse(
                    rawBody
                        .toString(
                            "utf8"
                        )
                );

        }
        catch {

            return res
                .status(400)
                .json({

                    success:
                        false,

                    error:
                        "INVALID_WEBHOOK_JSON",

                });

        }


        // -------------------------------------------------
        // Event ID
        // -------------------------------------------------

        const eventId =

            req.get(
                "x-razorpay-event-id"
            ) ||

            generateFallbackEventId(
                rawBody
            );


        const eventType =
            event.event;


        // -------------------------------------------------
        // Register event for idempotency
        // -------------------------------------------------

        let storedEvent;


        try {

            storedEvent =
                registerWebhookEvent({

                    eventId,

                    eventType,

                    rawPayload:
                        rawBody
                            .toString(
                                "utf8"
                            ),

                });

        }
        catch (error) {

            console.error(
                "Failed to register webhook:",
                error
            );


            return res
                .status(500)
                .json({

                    success:
                        false,

                    error:
                        "WEBHOOK_STORAGE_FAILED",

                });

        }


        // -------------------------------------------------
        // Already successfully processed
        // -------------------------------------------------

        if (
            storedEvent.processed ===
            1
        ) {

            console.log(
                `Duplicate webhook ignored: ${eventId}`
            );


            return res
                .status(200)
                .json({

                    success:
                        true,

                    duplicate:
                        true,

                    event_id:
                        eventId,

                });

        }


        // -------------------------------------------------
        // Process actual event
        // -------------------------------------------------

        try {

            let result = null;


            switch (eventType) {

                // =========================================
                // PAYMENT CAPTURED
                // =========================================

                case "payment.captured": {

                    const providerPayment =
                        event
                            ?.payload
                            ?.payment
                            ?.entity;


                    if (!providerPayment) {

                        throw new Error(
                            "payment.captured payload missing payment entity"
                        );

                    }


                    result =
                        finalizeCapturedPayment(
                            providerPayment
                        );


                    break;

                }


                // =========================================
                // ORDER PAID
                // =========================================
                //
                // order.paid also contains the Payment.
                //
                // We use it as a captured confirmation.
                // finalizeCapturedPayment() is idempotent.
                // =========================================

                case "order.paid": {

                    const providerPayment =
                        event
                            ?.payload
                            ?.payment
                            ?.entity;


                    if (!providerPayment) {

                        throw new Error(
                            "order.paid payload missing payment entity"
                        );

                    }


                    result =
                        finalizeCapturedPayment(
                            providerPayment
                        );


                    break;

                }


                // =========================================
                // PAYMENT FAILED
                // =========================================

                case "payment.failed": {

                    const providerPayment =
                        event
                            ?.payload
                            ?.payment
                            ?.entity;


                    if (!providerPayment) {

                        throw new Error(
                            "payment.failed payload missing payment entity"
                        );

                    }


                    result =
                        finalizeFailedPayment(
                            providerPayment
                        );


                    break;

                }


                // =========================================
                // UNSUPPORTED / UNNEEDED EVENT
                // =========================================

                default: {

                    console.log(
                        `Webhook event ignored: ${eventType}`
                    );

                    result = {

                        ignored:
                            true,

                    };

                }

            }


            // ---------------------------------------------
            // Mark event successfully processed
            // ---------------------------------------------

            markWebhookProcessed(
                eventId
            );


            console.log(
                `Webhook processed: ${eventType} | ${eventId}`
            );


            return res
                .status(200)
                .json({

                    success:
                        true,

                    event:
                        eventType,

                    event_id:
                        eventId,

                    data:
                        result,

                });

        }
        catch (error) {

            // IMPORTANT:
            //
            // Do NOT mark processed here.
            //
            // If Razorpay retries this same event,
            // processed = 0 means we can try again.

            console.error(
                `Webhook processing failed: ${eventType}`,
                error
            );


            return res
                .status(500)
                .json({

                    success:
                        false,

                    error:
                        error.code ||
                        "WEBHOOK_PROCESSING_FAILED",

                    message:
                        error.message,

                });

        }

    }
);


export default router;