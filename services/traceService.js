import db from "../db/db.js";

import {
    verifyIntentIntegrity,
    verifyCartIntegrity,
} from "./consentManager.js";

import {
    verifyPaymentIntegrity,
} from "./paymentService.js";


// =========================================================
// SAFE JSON PARSER
// =========================================================

function parseJsonSafely(value) {

    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value !== "string") {
        return value;
    }

    try {
        return JSON.parse(value);
    }
    catch {
        return value;
    }
}

// =========================================================
// NORMALIZE INTENT
// =========================================================

function normalizeIntent(intent) {

    if (!intent) {
        return null;
    }

    return {

        ...intent,

        signature_present:
            Boolean(
                intent.signature
            ),

    };
}

// =========================================================
// NORMALIZE CART
// =========================================================

function normalizeCart(cart) {

    return {

        ...cart,

        items:
            parseJsonSafely(
                cart.items
            ),

        signature_present:
            Boolean(
                cart.signature
            ),

    };
}


// =========================================================
// NORMALIZE PAYMENT
// =========================================================

function normalizePayment(payment) {

    return {

        ...payment,

        signature_present:
            Boolean(
                payment.signature
            ),

    };
}


// =========================================================
// REMOVE RAW SIGNATURE FROM API RESPONSE
// =========================================================

function removeSignature(entity) {

    if (!entity) {
        return null;
    }


    const {
        signature,
        ...safeEntity
    } = entity;


    return {

        ...safeEntity,

        signature_present:
            Boolean(signature),

    };
}


function sanitizeCart(cart) {

    const safe =
        removeSignature(cart);


    return {

        ...safe,

        items:
            parseJsonSafely(
                safe.items
            ),

    };
}


// =========================================================
// NORMALIZE AUDIT EVENT
// =========================================================

function normalizeAuditEvent(event) {

    return {

        ...event,

        metadata:
            parseJsonSafely(
                event.metadata
            ),

    };
}


// =========================================================
// BUILD CHAIN VALIDATION
// =========================================================

function buildChainValidation({

    intent,

    carts,

    payments,

}) {

    // -----------------------------------------------------
    // Intent → Cart links
    // -----------------------------------------------------

    const intentCartLinks =
        carts.map(
            (cart) => {

                const valid =
                    Boolean(intent) &&
                    cart.parent_hash ===
                        intent.mandate_hash;

                return {

                    intent_id:
                        cart.intent_id,

                    cart_id:
                        cart.id,

                    expected_parent_hash:
                        intent
                            ? intent.mandate_hash
                            : null,

                    actual_parent_hash:
                        cart.parent_hash,

                    valid,

                };

            }
        );


    // -----------------------------------------------------
    // Cart → Payment links
    // -----------------------------------------------------

    const cartPaymentLinks =
        payments.map(
            (payment) => {

                const parentCart =
                    carts.find(
                        (cart) =>
                            cart.id ===
                            payment.cart_id
                    );


                const valid =
                    Boolean(
                        parentCart
                    ) &&
                    payment.parent_hash ===
                        parentCart.mandate_hash;


                return {

                    cart_id:
                        payment.cart_id,

                    payment_id:
                        payment.id,

                    expected_parent_hash:
                        parentCart
                            ? parentCart.mandate_hash
                            : null,

                    actual_parent_hash:
                        payment.parent_hash,

                    valid,

                };

            }
        );


    // -----------------------------------------------------
    // Trace ID consistency
    // -----------------------------------------------------

    const traceIds = [];


    if (intent) {

        traceIds.push(
            intent.trace_id
        );

    }


    for (const cart of carts) {

        traceIds.push(
            cart.trace_id
        );

    }


    for (const payment of payments) {

        traceIds.push(
            payment.trace_id
        );

    }


    const uniqueTraceIds =
        [...new Set(traceIds)];


    const traceConsistent =
        uniqueTraceIds.length <= 1;


    const intentCartValid =
        intentCartLinks.every(
            (link) =>
                link.valid
        );


    const cartPaymentValid =
        cartPaymentLinks.every(
            (link) =>
                link.valid
        );


    return {

        trace_consistent:
            traceConsistent,

        intent_cart_links_valid:
            intentCartValid,

        cart_payment_links_valid:
            cartPaymentValid,

        intent_cart_links:
            intentCartLinks,

        cart_payment_links:
            cartPaymentLinks,

    };
}


// =========================================================
// BUILD CRYPTOGRAPHIC VALIDATION
// =========================================================

function buildCryptographicValidation({

    intent,

    carts,

    payments,

}) {

    let intentCheck = {

        valid: false,

        error: null,

    };


    if (intent) {

        try {

            verifyIntentIntegrity(
                intent
            );


            intentCheck = {

                valid: true,

                error: null,

            };

        }
        catch (error) {

            intentCheck = {

                valid: false,

                error:
                    error.code ||
                    "INTENT_CRYPTO_INVALID",

            };

        }

    }


    const cartChecks =
        carts.map(
            (cart) => {

                try {

                    verifyCartIntegrity(
                        cart
                    );


                    return {

                        id:
                            cart.id,

                        valid:
                            true,

                        error:
                            null,

                    };

                }
                catch (error) {

                    return {

                        id:
                            cart.id,

                        valid:
                            false,

                        error:
                            error.code ||
                            "CART_CRYPTO_INVALID",

                    };

                }

            }
        );


    const paymentChecks =
        payments.map(
            (payment) => {

                try {

                    const result =
                        verifyPaymentIntegrity(
                            payment
                        );


                    return {

                        id:
                            payment.id,

                        status:
                            payment.status,

                        ...result,

                        error:
                            null,

                    };

                }
                catch (error) {

                    return {

                        id:
                            payment.id,

                        status:
                            payment.status,

                        verifiable:
                            true,

                        valid:
                            false,

                        error:
                            error.code ||
                            "PAYMENT_CRYPTO_INVALID",

                    };

                }

            }
        );


    const cartsValid =
        cartChecks.every(
            (check) =>
                check.valid ===
                true
        );


    // Non-finalized payments have no execution proof yet,
    // so exclude them from finalized-payment validity.
    const finalizedPaymentChecks =
        paymentChecks.filter(
            (check) =>
                check.verifiable !==
                false
        );


    const paymentsValid =
        finalizedPaymentChecks.every(
            (check) =>
                check.valid ===
                true
        );


    return {

        intent_valid:
            intentCheck.valid,

        carts_valid:
            cartsValid,

        payments_valid:
            paymentsValid,

        details: {

            intent:
                intentCheck,

            carts:
                cartChecks,

            payments:
                paymentChecks,

        },

        valid:
            intentCheck.valid &&
            cartsValid &&
            paymentsValid,

    };
}


// =========================================================
// BUILD SUMMARY
// =========================================================

function buildTraceSummary({

    intent,

    carts,

    payments,

    audit,

    integrity,

}) {

    const approvedCarts =
        carts.filter(
            (cart) =>
                cart.status ===
                "approved"
        );


    const rejectedCarts =
        carts.filter(
            (cart) =>
                cart.status ===
                "rejected"
        );


    const capturedPayments =
        payments.filter(
            (payment) =>
                payment.status ===
                "captured"
        );


    const failedPayments =
        payments.filter(
            (payment) =>
                payment.status ===
                "failed"
        );


    const capturedAmount =
        capturedPayments.reduce(
            (sum, payment) =>
                sum +
                Number(
                    payment.amount
                ),
            0
        );

    const committedAmount = approvedCarts.reduce(
        (sum, cart) => sum + Number(cart.amount),
        0,
    );

    const authorizedAmount = intent ? Number(intent.max_amount) : null;


    return {

        intent_status:
            intent
                ? intent.status
                : null,

        authorized_amount: authorizedAmount,

        committed_amount: committedAmount,

        remaining_amount: authorizedAmount === null ? null : Math.max(authorizedAmount - committedAmount, 0),

        cart_count: carts.length,

        payment_count: payments.length,

        failed_payment_count: failedPayments.length,

        currency:
            intent
                ? intent.currency
                : null,

        carts: {

            total:
                carts.length,

            approved:
                approvedCarts.length,

            rejected:
                rejectedCarts.length,

        },

        payments: {

            total:
                payments.length,

            captured:
                capturedPayments.length,

            failed:
                failedPayments.length,

            captured_amount:
                capturedAmount,

        },

        audit_events:
            audit.length,

        chain_valid:
            integrity.chain_valid,

    };
}


// =========================================================
// GET COMPLETE TRACE
// =========================================================

export function getTraceById(
    traceId
) {

    // -----------------------------------------------------
    // Input validation
    // -----------------------------------------------------

    if (
        typeof traceId !==
            "string" ||
        traceId.trim().length ===
            0
    ) {

        const error =
            new Error(
                "trace_id is required"
            );

        error.status = 400;
        error.code =
            "INVALID_TRACE_ID";

        throw error;
    }


    const normalizedTraceId =
        traceId.trim();


    // =====================================================
    // INTENT
    // =====================================================

const rawIntent =
    db
        .prepare(`
            SELECT

                id,
                trace_id,
                scope,
                max_amount,
                currency,
                valid_until,
                usage_mode,
                policy_json,
                mandate_hash,
                signature,

                status,
                created_at

            FROM intents

            WHERE trace_id = ?

            ORDER BY created_at ASC

            LIMIT 1
        `)
        .get(
            normalizedTraceId
        ) || null;


const intent =
    normalizeIntent(
        rawIntent
    );

    // =====================================================
    // CARTS
    // =====================================================

    const rawCarts =
        db
            .prepare(`
                SELECT

                    id,
                    trace_id,
                    intent_id,
                    merchant,
                    items,
                    amount,
                    currency,
                    parent_hash,
                    mandate_hash,
                    signature,

                    status,
                    created_at

                FROM carts

                WHERE trace_id = ?

                ORDER BY created_at ASC
            `)
            .all(
                normalizedTraceId
            );


    const carts =
        rawCarts.map(
            normalizeCart
        );


    // =====================================================
    // PAYMENTS
    // =====================================================

    const rawPayments =
        db
            .prepare(`
                SELECT

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
                    failure_detail,

                    created_at,
                    updated_at

                FROM payments

                WHERE trace_id = ?

                ORDER BY created_at ASC
            `)
            .all(
                normalizedTraceId
            );


    const payments =
        rawPayments.map(
            normalizePayment
        );


    // =====================================================
    // AUDIT TIMELINE
    // =====================================================

    const rawAudit =
        db
            .prepare(`
                SELECT

                    id,
                    trace_id,

                    entity_type,
                    entity_id,

                    event,

                    previous_status,
                    new_status,

                    reason_code,
                    detail,
                    metadata,

                    timestamp

                FROM audit_log

                WHERE trace_id = ?

                ORDER BY
                    timestamp ASC,
                    id ASC
            `)
            .all(
                normalizedTraceId
            );


    const audit =
        rawAudit.map(
            normalizeAuditEvent
        );


    // =====================================================
    // TRACE NOT FOUND
    // =====================================================

    if (
        !intent &&
        carts.length === 0 &&
        payments.length === 0 &&
        audit.length === 0
    ) {

        const error =
            new Error(
                "No Mandate Ledger trace found"
            );

        error.status = 404;
        error.code =
            "TRACE_NOT_FOUND";

        throw error;
    }


    // =====================================================
    // INTEGRITY
    // =====================================================

    const linkIntegrity =
        buildChainValidation({

            intent,

            carts,

            payments,

        });


    const cryptographic =
        buildCryptographicValidation({

            intent,

            carts,

            payments,

        });


    const integrity = {

        ...linkIntegrity,

        cryptographic,

        chain_valid:
            linkIntegrity.trace_consistent &&
            linkIntegrity.intent_cart_links_valid &&
            linkIntegrity.cart_payment_links_valid &&
            cryptographic.valid,

    };


    // =====================================================
    // SUMMARY
    // =====================================================

    const summary =
        buildTraceSummary({

            intent,

            carts,

            payments,

            audit,

            integrity,

        });


    // =====================================================
    // RESPONSE
    // =====================================================

    return {

        trace_id:
            normalizedTraceId,

        summary,

        integrity,

        intent:
            removeSignature(
                intent
            ),

        carts:
            carts.map(
                sanitizeCart
            ),

        payments:
            payments.map(
                removeSignature
            ),

        audit_timeline:
            audit,

    };
}
