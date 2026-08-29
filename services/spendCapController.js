// =========================================================
// SPEND CAP CONTROLLER
// =========================================================
//
// Responsible only for authorization/policy checks.
//
// It does NOT:
// - write to SQLite
// - call Razorpay
// - create Cart Mandates
//
// It answers:
// "Is this cart allowed under this Intent?"
// =========================================================


// =========================================================
// VALIDATE CART AGAINST INTENT
// =========================================================

export function validateCartAgainstIntent({
    intent,
    amount,
    currency,
}) {

    // -----------------------------------------------------
    // Intent must exist
    // -----------------------------------------------------

    if (!intent) {

        const error =
            new Error(
                "Parent Intent does not exist"
            );

        error.status = 404;
        error.code =
            "INTENT_NOT_FOUND";

        throw error;
    }


    // -----------------------------------------------------
    // Intent must already be approved
    // -----------------------------------------------------

    if (intent.status !== "approved") {

        const error =
            new Error(
                `Cart cannot be created because Intent status is '${intent.status}'`
            );

        error.status = 409;
        error.code =
            "INTENT_NOT_APPROVED";

        error.details = {
            intent_status:
                intent.status,
        };

        throw error;
    }


    // -----------------------------------------------------
    // Intent must still be valid
    // -----------------------------------------------------

    const expiryTime =
        new Date(
            intent.valid_until
        ).getTime();


    if (
        Number.isNaN(expiryTime) ||
        expiryTime <= Date.now()
    ) {

        const error =
            new Error(
                "Intent has expired"
            );

        error.status = 409;
        error.code =
            "INTENT_EXPIRED";

        error.details = {
            valid_until:
                intent.valid_until,
        };

        throw error;
    }


    // -----------------------------------------------------
    // Amount validation
    // -----------------------------------------------------

    if (
        !Number.isInteger(amount) ||
        amount <= 0
    ) {

        const error =
            new Error(
                "Cart amount must be a positive integer in paise"
            );

        error.status = 400;
        error.code =
            "INVALID_CART_AMOUNT";

        throw error;
    }


    // -----------------------------------------------------
    // Currency must match
    // -----------------------------------------------------

    const normalizedCurrency =
        currency
            .trim()
            .toUpperCase();


    if (
        normalizedCurrency !==
        intent.currency
    ) {

        const error =
            new Error(
                `Cart currency ${normalizedCurrency} does not match Intent currency ${intent.currency}`
            );

        error.status = 422;
        error.code =
            "CURRENCY_MISMATCH";

        error.details = {

            intent_currency:
                intent.currency,

            cart_currency:
                normalizedCurrency,

        };

        throw error;
    }


    // -----------------------------------------------------
    // Core spend-cap gate
    // -----------------------------------------------------

    if (
        amount >
        intent.max_amount
    ) {

        const error =
            new Error(
                "Cart amount exceeds the authorized Intent spend cap"
            );

        error.status = 422;
        error.code =
            "CAP_EXCEEDED";

        error.details = {

            authorized_amount:
                intent.max_amount,

            requested_amount:
                amount,

            excess_amount:
                amount -
                intent.max_amount,

            currency:
                normalizedCurrency,

        };

        throw error;
    }


    // -----------------------------------------------------
    // Passed
    // -----------------------------------------------------

    return {

        allowed: true,

        max_amount:
            intent.max_amount,

        requested_amount:
            amount,

        remaining_amount:
            intent.max_amount -
            amount,

        currency:
            normalizedCurrency,

    };
}