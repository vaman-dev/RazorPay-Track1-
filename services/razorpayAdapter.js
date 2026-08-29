import Razorpay from "razorpay";


// =========================================================
// ENVIRONMENT VALIDATION
// =========================================================

if (!process.env.RAZORPAY_KEY_ID) {

    throw new Error(
        "RAZORPAY_KEY_ID is missing"
    );
}


if (!process.env.RAZORPAY_KEY_SECRET) {

    throw new Error(
        "RAZORPAY_KEY_SECRET is missing"
    );
}


// =========================================================
// RAZORPAY CLIENT
// =========================================================

const razorpay =
    new Razorpay({

        key_id:
            process.env.RAZORPAY_KEY_ID,

        key_secret:
            process.env.RAZORPAY_KEY_SECRET,

    });


// =========================================================
// CREATE ORDER
// =========================================================

export async function createOrder({

    amount,

    currency,

    receipt,

    notes = {},

}) {

    // Amount is supplied in smallest currency unit.
    // INR → paise.

    if (
        !Number.isInteger(amount) ||
        amount <= 0
    ) {

        const error =
            new Error(
                "Razorpay order amount must be a positive integer"
            );

        error.status = 400;
        error.code =
            "INVALID_RAZORPAY_AMOUNT";

        throw error;
    }


    if (
        typeof currency !== "string" ||
        currency.length !== 3
    ) {

        const error =
            new Error(
                "Invalid Razorpay currency"
            );

        error.status = 400;
        error.code =
            "INVALID_RAZORPAY_CURRENCY";

        throw error;
    }


    if (
        !receipt ||
        receipt.length > 40
    ) {

        const error =
            new Error(
                "Razorpay receipt must be between 1 and 40 characters"
            );

        error.status = 400;
        error.code =
            "INVALID_RAZORPAY_RECEIPT";

        throw error;
    }


    try {

        const order =
            await razorpay
                .orders
                .create({

                    amount,

                    currency,

                    receipt,

                    notes,

                });


        return order;

    }
    catch (error) {

        const wrappedError =
            new Error(
                error?.error?.description ||
                error?.message ||
                "Razorpay order creation failed"
            );


        wrappedError.status = 502;

        wrappedError.code =
            "RAZORPAY_ORDER_CREATE_FAILED";

        wrappedError.providerError =
            error;


        throw wrappedError;

    }

}


// =========================================================
// FETCH ORDER
// =========================================================

export async function fetchOrder(
    orderId
) {

    if (!orderId) {

        const error =
            new Error(
                "Razorpay order ID is required"
            );

        error.status = 400;
        error.code =
            "RAZORPAY_ORDER_ID_REQUIRED";

        throw error;
    }


    return razorpay
        .orders
        .fetch(orderId);

}