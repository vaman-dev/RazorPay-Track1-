import crypto from "crypto";
import jwt from "jsonwebtoken";
import db from "../db/db.js";

import {
    getCartById,
    getIntentById,
    verifyCartIntegrity,
    verifyIntentIntegrity,
} from "./consentManager.js";

import {
    createOrder,
} from "./razorpayAdapter.js";

import {
    writeAuditEvent,
} from "./ledger.js";


// =========================================================
// GET PAYMENT BY CART
// =========================================================

function getActivePaymentForCart(
    cartId
) {

    return db
        .prepare(`
            SELECT *
            FROM payments
            WHERE cart_id = ?
            AND status IN (
                'created',
                'pending',
                'captured'
            )
            ORDER BY created_at DESC
            LIMIT 1
        `)
        .get(cartId);

}


// =========================================================
// CREATE PAYMENT / RAZORPAY ORDER
// =========================================================

export async function createPaymentForCart(
    cartId
) {

    // -----------------------------------------------------
    // Validate Cart ID
    // -----------------------------------------------------

    if (
        typeof cartId !== "string" ||
        cartId.trim().length === 0
    ) {

        const error =
            new Error(
                "cart_id is required"
            );

        error.status = 400;
        error.code =
            "INVALID_CART_ID";

        throw error;
    }


    // -----------------------------------------------------
    // Load Cart
    // -----------------------------------------------------

    const cart =
        getCartById(
            cartId.trim()
        );


    if (!cart) {

        const error =
            new Error(
                "Cart not found"
            );

        error.status = 404;
        error.code =
            "CART_NOT_FOUND";

        throw error;
    }


    // -----------------------------------------------------
    // Cart must be approved
    // -----------------------------------------------------

    if (
        cart.status !==
        "approved"
    ) {

        const error =
            new Error(
                `Payment cannot be created from Cart status '${cart.status}'`
            );

        error.status = 409;
        error.code =
            "CART_NOT_APPROVED";

        throw error;
    }


    // -----------------------------------------------------
    // Verify Cart integrity
    // -----------------------------------------------------

    verifyCartIntegrity(
        cart
    );


    // -----------------------------------------------------
    // Load parent Intent
    // -----------------------------------------------------

    const intent =
        getIntentById(
            cart.intent_id
        );


    if (!intent) {

        const error =
            new Error(
                "Parent Intent not found"
            );

        error.status = 409;
        error.code =
            "PARENT_INTENT_NOT_FOUND";

        throw error;
    }


    // -----------------------------------------------------
    // Verify Intent integrity
    // -----------------------------------------------------

    verifyIntentIntegrity(
        intent
    );


    // -----------------------------------------------------
    // Verify actual cryptographic chain
    // -----------------------------------------------------

    if (
        cart.parent_hash !==
        intent.mandate_hash
    ) {

        const error =
            new Error(
                "Cart parent hash does not match Intent mandate hash"
            );

        error.status = 409;
        error.code =
            "BROKEN_INTENT_CART_CHAIN";

        throw error;
    }


    // -----------------------------------------------------
    // Budget was reserved when this immutable approved Cart was committed.
    // Re-applying the cumulative cap here would reserve the same Cart twice
    // and incorrectly block its first payment attempt. Intent status/expiry,
    // integrity, parent-link, Cart approval and idempotency checks remain.
    // -----------------------------------------------------

    if (intent.status !== "approved") {
        const error = new Error(`Payment cannot be created because Intent status is '${intent.status}'`);
        error.status = 409;
        error.code = "INTENT_NOT_APPROVED";
        throw error;
    }

    if (new Date(intent.valid_until).getTime() <= Date.now()) {
        const error = new Error("Intent has expired");
        error.status = 409;
        error.code = "INTENT_EXPIRED";
        throw error;
    }

    if (cart.currency !== intent.currency) {
        const error = new Error("Cart currency does not match Intent currency");
        error.status = 422;
        error.code = "CURRENCY_MISMATCH";
        throw error;
    }


    // -----------------------------------------------------
    // Idempotency:
    // Don't create another Razorpay order accidentally.
    // -----------------------------------------------------

    const existingPayment =
        getActivePaymentForCart(
            cart.id
        );


    if (existingPayment) {

        return {

            already_exists:
                true,

            id:
                existingPayment.id,

            trace_id:
                existingPayment.trace_id,

            cart_id:
                existingPayment.cart_id,

            razorpay_order_id:
                existingPayment.razorpay_order_id,

            amount:
                existingPayment.amount,

            currency:
                existingPayment.currency,

            parent_hash:
                existingPayment.parent_hash,

            status:
                existingPayment.status,

            // Reconstruct the public checkout contract from persisted,
            // server-trusted fields. Reuse must never create a second order.
            checkout: {
                key_id: process.env.RAZORPAY_KEY_ID,
                order_id: existingPayment.razorpay_order_id,
                amount: existingPayment.amount,
                currency: existingPayment.currency,
            },

        };

    }


    // -----------------------------------------------------
    // Generate local Payment ID
    // -----------------------------------------------------
    //
    // "pay_" + UUID = 40 characters.
    //
    // Razorpay receipt maximum is 40 characters,
    // so we can safely use this as receipt.
    // -----------------------------------------------------

    const paymentId =
        `pay_${crypto.randomUUID()}`;


    // -----------------------------------------------------
    // CRITICAL CHAIN RULES
    // -----------------------------------------------------

    const traceId =
        cart.trace_id;


    const parentHash =
        cart.mandate_hash;


    // -----------------------------------------------------
    // Create Razorpay Order
    // -----------------------------------------------------
    //
    // Amount comes FROM DATABASE CART.
    //
    // Client cannot submit a different amount here.
    // -----------------------------------------------------

    let razorpayOrder;


    try {

        razorpayOrder =
            await createOrder({

                amount:
                    cart.amount,

                currency:
                    cart.currency,

                receipt:
                    paymentId,

                notes: {

                    trace_id:
                        traceId,

                    cart_id:
                        cart.id,

                    intent_id:
                        cart.intent_id,

                },

            });

    }
    catch (error) {

        // Even provider/API failures should be visible
        // in the audit trail.

        writeAuditEvent({

            traceId,

            entityType:
                "payment",

            entityId:
                paymentId,

            event:
                "order_creation_failed",

            previousStatus:
                null,

            newStatus:
                "failed",

            reasonCode:
                error.code ||
                "RAZORPAY_ORDER_CREATE_FAILED",

            detail:
                error.message,

            metadata: {

                cart_id:
                    cart.id,

                amount:
                    cart.amount,

                currency:
                    cart.currency,

            },

        });


        throw error;

    }


    // -----------------------------------------------------
    // Store Payment record
    // -----------------------------------------------------
    //
    // mandate_hash/signature remain NULL here.
    //
    // They will be finalized when Razorpay webhook gives
    // us actual payment execution proof.
    // -----------------------------------------------------

    const transaction =
        db.transaction(() => {

            db.prepare(`
                INSERT INTO payments (
                    id,
                    trace_id,
                    cart_id,
                    razorpay_order_id,
                    razorpay_payment_id,
                    amount,
                    currency,
                    parent_hash,
                    mandate_hash,
                    signature,
                    status,
                    failure_code,
                    failure_detail
                )
                VALUES (
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?, ?
                )
            `)
                .run(

                    paymentId,

                    traceId,

                    cart.id,

                    razorpayOrder.id,

                    null,

                    cart.amount,

                    cart.currency,

                    parentHash,

                    null,

                    null,

                    "created",

                    null,

                    null

                );


            writeAuditEvent({

                traceId,

                entityType:
                    "payment",

                entityId:
                    paymentId,

                event:
                    "order_created",

                previousStatus:
                    null,

                newStatus:
                    "created",

                reasonCode:
                    "RAZORPAY_ORDER_CREATED",

                detail:
                    "Approved Cart was converted into a Razorpay Order.",

                metadata: {

                    intent_id:
                        cart.intent_id,

                    cart_id:
                        cart.id,

                    razorpay_order_id:
                        razorpayOrder.id,

                    amount:
                        cart.amount,

                    currency:
                        cart.currency,

                },

            });

        });


    transaction();


    // -----------------------------------------------------
    // Return Payment initialization
    // -----------------------------------------------------

    return {

        already_exists:
            false,

        id:
            paymentId,

        trace_id:
            traceId,

        cart_id:
            cart.id,

        razorpay_order_id:
            razorpayOrder.id,

        amount:
            razorpayOrder.amount,

        currency:
            razorpayOrder.currency,

        parent_hash:
            parentHash,

        status:
            "created",

        checkout: {

            key_id:
                process.env
                    .RAZORPAY_KEY_ID,

            order_id:
                razorpayOrder.id,

            amount:
                razorpayOrder.amount,

            currency:
                razorpayOrder.currency,

        },

    };

}


// =========================================================
// GET PAYMENT BY RAZORPAY ORDER ID
// =========================================================

export function getPaymentByRazorpayOrderId(
    orderId
) {

    return db
        .prepare(`
            SELECT *
            FROM payments
            WHERE razorpay_order_id = ?
        `)
        .get(orderId) || null;

}


// =========================================================
// GENERATE PAYMENT MANDATE HASH
// =========================================================

function generatePaymentMandateHash({

    id,
    traceId,
    cartId,
    parentHash,
    razorpayOrderId,
    razorpayPaymentId,
    amount,
    currency,
    status,
    failureCode = null,
    failureDetail = null,

}) {

    // Fixed key order intentionally used
    // so that hashing stays deterministic.

    const canonicalPayload =
        JSON.stringify({

            id,

            trace_id:
                traceId,

            cart_id:
                cartId,

            parent_hash:
                parentHash,

            razorpay_order_id:
                razorpayOrderId,

            razorpay_payment_id:
                razorpayPaymentId,

            amount,

            currency,

            status,

            failure_code:
                failureCode,

            failure_detail:
                failureDetail,

        });


    return crypto
        .createHash("sha256")
        .update(canonicalPayload)
        .digest("hex");

}


// =========================================================
// SIGN PAYMENT MANDATE
// =========================================================

function signPaymentMandate({

    id,
    traceId,
    cartId,
    parentHash,
    razorpayOrderId,
    razorpayPaymentId,
    mandateHash,
    status,

}) {

    return jwt.sign(

        {

            id,

            trace_id:
                traceId,

            cart_id:
                cartId,

            parent_hash:
                parentHash,

            razorpay_order_id:
                razorpayOrderId,

            razorpay_payment_id:
                razorpayPaymentId,

            mandate_hash:
                mandateHash,

            status,

            type:
                "payment",

        },

        process.env.JWT_SECRET,

        {

            algorithm:
                "HS256",

        }

    );

}


// =========================================================
// VERIFY PAYMENT MANDATE INTEGRITY
// =========================================================

export function verifyPaymentIntegrity(payment) {

    if (!payment) {

        const error =
            new Error(
                "Payment is required for integrity verification"
            );

        error.code =
            "PAYMENT_NOT_FOUND";

        throw error;
    }


    // Payment Mandate only becomes cryptographically
    // complete after captured / failed execution.
    if (
        payment.status !== "captured" &&
        payment.status !== "failed"
    ) {

        return {

            verifiable: false,

            valid: null,

            reason:
                "PAYMENT_NOT_FINALIZED",

        };

    }


    if (
        !payment.mandate_hash ||
        !payment.signature
    ) {

        const error =
            new Error(
                "Finalized Payment is missing mandate hash or signature"
            );

        error.code =
            "PAYMENT_CRYPTO_MISSING";

        throw error;
    }


    // Recalculate Payment hash from stored execution data.
    const recalculatedHash =
        generatePaymentMandateHash({

            id:
                payment.id,

            traceId:
                payment.trace_id,

            cartId:
                payment.cart_id,

            parentHash:
                payment.parent_hash,

            razorpayOrderId:
                payment.razorpay_order_id,

            razorpayPaymentId:
                payment.razorpay_payment_id,

            amount:
                payment.amount,

            currency:
                payment.currency,

            status:
                payment.status,

            failureCode:
                payment.failure_code,

            failureDetail:
                payment.failure_detail,

        });


    if (
        recalculatedHash !==
        payment.mandate_hash
    ) {

        const error =
            new Error(
                "Payment mandate hash verification failed"
            );

        error.code =
            "PAYMENT_HASH_MISMATCH";

        throw error;
    }


    let decoded;


    try {

        decoded =
            jwt.verify(

                payment.signature,

                process.env.JWT_SECRET,

                {
                    algorithms: [
                        "HS256",
                    ],

                }

            );

    }
    catch {

        const error =
            new Error(
                "Payment mandate signature verification failed"
            );

        error.code =
            "PAYMENT_SIGNATURE_INVALID";

        throw error;
    }


    if (
        decoded.id !==
            payment.id ||

        decoded.trace_id !==
            payment.trace_id ||

        decoded.cart_id !==
            payment.cart_id ||

        decoded.parent_hash !==
            payment.parent_hash ||

        decoded.razorpay_order_id !==
            payment.razorpay_order_id ||

        decoded.razorpay_payment_id !==
            payment.razorpay_payment_id ||

        decoded.mandate_hash !==
            payment.mandate_hash ||

        decoded.status !==
            payment.status ||

        decoded.type !==
            "payment"
    ) {

        const error =
            new Error(
                "Payment signed claims do not match stored Payment"
            );

        error.code =
            "PAYMENT_SIGNATURE_CLAIMS_MISMATCH";

        throw error;
    }


    return {

        verifiable: true,

        valid: true,

        hash_valid: true,

        signature_valid: true,

    };
}


// =========================================================
// VERIFY RAZORPAY PAYMENT MATCHES LOCAL PAYMENT
// =========================================================

function verifyProviderPayment({

    payment,
    providerPayment,

}) {

    // -----------------------------------------------------
    // Order ID
    // -----------------------------------------------------

    if (
        providerPayment.order_id !==
        payment.razorpay_order_id
    ) {

        const error =
            new Error(
                "Razorpay order ID does not match local Payment"
            );

        error.code =
            "RAZORPAY_ORDER_MISMATCH";

        throw error;

    }


    // -----------------------------------------------------
    // Amount
    // -----------------------------------------------------

    if (
        Number(providerPayment.amount) !==
        Number(payment.amount)
    ) {

        const error =
            new Error(
                "Razorpay payment amount does not match authorized Cart amount"
            );

        error.code =
            "PAYMENT_AMOUNT_MISMATCH";

        throw error;

    }


    // -----------------------------------------------------
    // Currency
    // -----------------------------------------------------

    if (
        String(
            providerPayment.currency
        ).toUpperCase() !==
        String(
            payment.currency
        ).toUpperCase()
    ) {

        const error =
            new Error(
                "Razorpay payment currency does not match local Payment"
            );

        error.code =
            "PAYMENT_CURRENCY_MISMATCH";

        throw error;

    }


    return true;

}


// =========================================================
// FINALIZE CAPTURED PAYMENT
// =========================================================

export function finalizeCapturedPayment(
    providerPayment
) {

    const orderId =
        providerPayment.order_id;


    // -----------------------------------------------------
    // Find our local payment
    // -----------------------------------------------------

    const payment =
        getPaymentByRazorpayOrderId(
            orderId
        );


    if (!payment) {

        const error =
            new Error(
                "No local Payment found for Razorpay Order"
            );

        error.code =
            "PAYMENT_ORDER_NOT_FOUND";

        throw error;

    }


    // -----------------------------------------------------
    // Verify provider data against our authorized data
    // -----------------------------------------------------

    verifyProviderPayment({

        payment,

        providerPayment,

    });


    // -----------------------------------------------------
    // Duplicate captured event
    // -----------------------------------------------------

    if (
        payment.status === "captured" &&
        payment.razorpay_payment_id ===
            providerPayment.id
    ) {

        return {

            already_finalized:
                true,

            ...payment,

        };

    }


    const previousStatus =
        payment.status;


    // -----------------------------------------------------
    // Generate execution-proof hash
    // -----------------------------------------------------

    const mandateHash =
        generatePaymentMandateHash({

            id:
                payment.id,

            traceId:
                payment.trace_id,

            cartId:
                payment.cart_id,

            parentHash:
                payment.parent_hash,

            razorpayOrderId:
                payment.razorpay_order_id,

            razorpayPaymentId:
                providerPayment.id,

            amount:
                payment.amount,

            currency:
                payment.currency,

            status:
                "captured",

        });


    // -----------------------------------------------------
    // Sign final Payment Mandate
    // -----------------------------------------------------

    const signature =
        signPaymentMandate({

            id:
                payment.id,

            traceId:
                payment.trace_id,

            cartId:
                payment.cart_id,

            parentHash:
                payment.parent_hash,

            razorpayOrderId:
                payment.razorpay_order_id,

            razorpayPaymentId:
                providerPayment.id,

            mandateHash,

            status:
                "captured",

        });


    // -----------------------------------------------------
    // Atomic DB update + audit
    // -----------------------------------------------------

    const transaction =
        db.transaction(() => {

            db.prepare(`
                UPDATE payments

                SET
                    razorpay_payment_id = ?,
                    mandate_hash = ?,
                    signature = ?,
                    status = 'captured',

                    failure_code = NULL,
                    failure_detail = NULL,

                    updated_at = CURRENT_TIMESTAMP

                WHERE id = ?
            `)
                .run(

                    providerPayment.id,

                    mandateHash,

                    signature,

                    payment.id

                );


            writeAuditEvent({

                traceId:
                    payment.trace_id,

                entityType:
                    "payment",

                entityId:
                    payment.id,

                event:
                    "captured",

                previousStatus,

                newStatus:
                    "captured",

                reasonCode:
                    "PAYMENT_CAPTURED",

                detail:
                    "Razorpay confirmed that the Payment was successfully captured.",

                metadata: {

                    razorpay_order_id:
                        payment.razorpay_order_id,

                    razorpay_payment_id:
                        providerPayment.id,

                    amount:
                        payment.amount,

                    currency:
                        payment.currency,

                    payment_method:
                        providerPayment.method ||
                        null,

                },

            });

        });


    transaction();


    return db
        .prepare(`
            SELECT *
            FROM payments
            WHERE id = ?
        `)
        .get(payment.id);

}


// =========================================================
// FINALIZE FAILED PAYMENT
// =========================================================

export function finalizeFailedPayment(
    providerPayment
) {

    const orderId =
        providerPayment.order_id;


    const payment =
        getPaymentByRazorpayOrderId(
            orderId
        );


    if (!payment) {

        const error =
            new Error(
                "No local Payment found for Razorpay Order"
            );

        error.code =
            "PAYMENT_ORDER_NOT_FOUND";

        throw error;

    }


    verifyProviderPayment({

        payment,

        providerPayment,

    });


    // -----------------------------------------------------
    // IMPORTANT:
    //
    // Never downgrade a captured Payment to failed.
    //
    // Razorpay explicitly warns webhook ordering is not
    // guaranteed.
    // -----------------------------------------------------

    if (
        payment.status ===
        "captured"
    ) {

        writeAuditEvent({

            traceId:
                payment.trace_id,

            entityType:
                "payment",

            entityId:
                payment.id,

            event:
                "late_failure_ignored",

            previousStatus:
                "captured",

            newStatus:
                "captured",

            reasonCode:
                "LATE_PAYMENT_FAILURE_EVENT",

            detail:
                "A payment.failed webhook arrived after this Payment had already been captured. The captured state was preserved.",

            metadata: {

                razorpay_payment_id:
                    providerPayment.id,

            },

        });


        return {

            ignored:
                true,

            reason:
                "PAYMENT_ALREADY_CAPTURED",

            ...payment,

        };

    }


    // -----------------------------------------------------
    // Failure reason
    // -----------------------------------------------------

    const failureCode =

        providerPayment.error_reason ||

        providerPayment.error_code ||

        "PAYMENT_FAILED";


    const failureDetail =

        providerPayment.error_description ||

        "Razorpay reported that the payment failed.";


    const previousStatus =
        payment.status;


    // -----------------------------------------------------
    // Hash failed execution attempt as well
    // -----------------------------------------------------

    const mandateHash =
        generatePaymentMandateHash({

            id:
                payment.id,

            traceId:
                payment.trace_id,

            cartId:
                payment.cart_id,

            parentHash:
                payment.parent_hash,

            razorpayOrderId:
                payment.razorpay_order_id,

            razorpayPaymentId:
                providerPayment.id,

            amount:
                payment.amount,

            currency:
                payment.currency,

            status:
                "failed",

            failureCode,

            failureDetail,

        });


    const signature =
        signPaymentMandate({

            id:
                payment.id,

            traceId:
                payment.trace_id,

            cartId:
                payment.cart_id,

            parentHash:
                payment.parent_hash,

            razorpayOrderId:
                payment.razorpay_order_id,

            razorpayPaymentId:
                providerPayment.id,

            mandateHash,

            status:
                "failed",

        });


    const transaction =
        db.transaction(() => {

            db.prepare(`
                UPDATE payments

                SET
                    razorpay_payment_id = ?,
                    mandate_hash = ?,
                    signature = ?,
                    status = 'failed',

                    failure_code = ?,
                    failure_detail = ?,

                    updated_at = CURRENT_TIMESTAMP

                WHERE id = ?
            `)
                .run(

                    providerPayment.id,

                    mandateHash,

                    signature,

                    failureCode,

                    failureDetail,

                    payment.id

                );


            writeAuditEvent({

                traceId:
                    payment.trace_id,

                entityType:
                    "payment",

                entityId:
                    payment.id,

                event:
                    "failed",

                previousStatus,

                newStatus:
                    "failed",

                reasonCode:
                    failureCode,

                detail:
                    failureDetail,

                metadata: {

                    razorpay_order_id:
                        payment.razorpay_order_id,

                    razorpay_payment_id:
                        providerPayment.id,

                    error_code:
                        providerPayment.error_code ||
                        null,

                    error_reason:
                        providerPayment.error_reason ||
                        null,

                    error_source:
                        providerPayment.error_source ||
                        null,

                    error_step:
                        providerPayment.error_step ||
                        null,

                },

            });

        });


    transaction();


    return db
        .prepare(`
            SELECT *
            FROM payments
            WHERE id = ?
        `)
        .get(payment.id);

}

