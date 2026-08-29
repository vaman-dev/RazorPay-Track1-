import crypto from "crypto";
import jwt from "jsonwebtoken";

import db from "../db/db.js";

import {
    writeAuditEvent,
} from "./ledger.js";

import {
    validateCartAgainstIntent,
} from "./spendCapController.js";


// =========================================================
// ENVIRONMENT CHECK
// =========================================================

if (!process.env.JWT_SECRET) {

    throw new Error(
        "JWT_SECRET is missing from environment variables"
    );

}


// =========================================================
// INTENT INPUT VALIDATION
// =========================================================

function validateIntentInput({
    scope,
    max_amount,
    valid_until,
    currency = "INR",
}) {

    // -----------------------------------------------------
    // Scope
    // -----------------------------------------------------

    if (
        typeof scope !== "string" ||
        scope.trim().length === 0
    ) {

        const error =
            new Error(
                "scope is required"
            );

        error.status = 400;
        error.code =
            "INVALID_SCOPE";

        throw error;

    }


    // -----------------------------------------------------
    // Maximum amount
    // -----------------------------------------------------

    if (
        !Number.isInteger(max_amount) ||
        max_amount <= 0
    ) {

        const error =
            new Error(
                "max_amount must be a positive integer in paise"
            );

        error.status = 400;
        error.code =
            "INVALID_MAX_AMOUNT";

        throw error;

    }


    // -----------------------------------------------------
    // Currency
    // -----------------------------------------------------

    if (
        typeof currency !== "string" ||
        currency.trim().length !== 3
    ) {

        const error =
            new Error(
                "currency must be a valid 3-letter currency code"
            );

        error.status = 400;
        error.code =
            "INVALID_CURRENCY";

        throw error;

    }


    // -----------------------------------------------------
    // Validity
    // -----------------------------------------------------

    if (!valid_until) {

        const error =
            new Error(
                "valid_until is required"
            );

        error.status = 400;
        error.code =
            "INVALID_VALIDITY";

        throw error;

    }


    const validUntilDate =
        new Date(valid_until);


    if (
        Number.isNaN(
            validUntilDate.getTime()
        )
    ) {

        const error =
            new Error(
                "valid_until must be a valid date"
            );

        error.status = 400;
        error.code =
            "INVALID_VALIDITY";

        throw error;

    }


    if (
        validUntilDate.getTime() <=
        Date.now()
    ) {

        const error =
            new Error(
                "valid_until must be in the future"
            );

        error.status = 400;
        error.code =
            "INTENT_ALREADY_EXPIRED";

        throw error;

    }


    return {

        scope:
            scope.trim(),

        maxAmount:
            max_amount,

        currency:
            currency
                .trim()
                .toUpperCase(),

        validUntil:
            validUntilDate
                .toISOString(),

    };

}


// =========================================================
// GENERATE INTENT HASH
// =========================================================

function generateIntentHash({
    scope,
    maxAmount,
    currency,
    validUntil,
}) {

    const canonicalPayload =
        JSON.stringify({

            scope,

            max_amount:
                maxAmount,

            currency,

            valid_until:
                validUntil,

        });


    return crypto
        .createHash("sha256")
        .update(canonicalPayload)
        .digest("hex");

}


// =========================================================
// SIGN INTENT
// =========================================================

function signIntent({
    id,
    traceId,
    mandateHash,
}) {

    return jwt.sign(

        {

            id,

            trace_id:
                traceId,

            mandate_hash:
                mandateHash,

            type:
                "intent",

        },

        process.env.JWT_SECRET,

        {

            algorithm:
                "HS256",

        }

    );

}


// =========================================================
// VERIFY INTENT INTEGRITY
// =========================================================

export function verifyIntentIntegrity(intent) {

    // -----------------------------------------------------
    // Rebuild Intent hash
    // -----------------------------------------------------

    const calculatedHash =
        generateIntentHash({

            scope:
                intent.scope,

            maxAmount:
                intent.max_amount,

            currency:
                intent.currency,

            validUntil:
                intent.valid_until,

        });


    // -----------------------------------------------------
    // Verify stored hash
    // -----------------------------------------------------

    if (
        calculatedHash !==
        intent.mandate_hash
    ) {

        const error =
            new Error(
                "Intent mandate hash verification failed"
            );

        error.status = 409;
        error.code =
            "INTENT_HASH_INVALID";

        throw error;

    }


    // -----------------------------------------------------
    // Verify JWT signature
    // -----------------------------------------------------

    let decoded;


    try {

        decoded =
            jwt.verify(

                intent.signature,

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
                "Intent signature verification failed"
            );

        error.status = 409;
        error.code =
            "INTENT_SIGNATURE_INVALID";

        throw error;

    }


    // -----------------------------------------------------
    // Verify JWT contents
    // -----------------------------------------------------

    if (
        decoded.id !==
            intent.id ||

        decoded.trace_id !==
            intent.trace_id ||

        decoded.mandate_hash !==
            intent.mandate_hash ||

        decoded.type !==
            "intent"
    ) {

        const error =
            new Error(
                "Intent signature payload does not match stored mandate"
            );

        error.status = 409;
        error.code =
            "INTENT_SIGNATURE_MISMATCH";

        throw error;

    }


    return true;

}


// =========================================================
// CREATE INTENT
// =========================================================

export function createIntent(input) {

    const validated =
        validateIntentInput(
            input
        );


    // -----------------------------------------------------
    // IDs
    // -----------------------------------------------------

    const id =
        `int_${crypto.randomUUID()}`;


    const traceId =
        `trace_${crypto.randomUUID()}`;


    // -----------------------------------------------------
    // Hash
    // -----------------------------------------------------

    const mandateHash =
        generateIntentHash({

            scope:
                validated.scope,

            maxAmount:
                validated.maxAmount,

            currency:
                validated.currency,

            validUntil:
                validated.validUntil,

        });


    // -----------------------------------------------------
    // Signature
    // -----------------------------------------------------

    const signature =
        signIntent({

            id,

            traceId,

            mandateHash,

        });


    // -----------------------------------------------------
    // Prepare DB statement
    // -----------------------------------------------------

    const insertIntent =
        db.prepare(`
            INSERT INTO intents (
                id,
                trace_id,
                scope,
                max_amount,
                currency,
                valid_until,
                mandate_hash,
                signature,
                status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);


    // -----------------------------------------------------
    // Atomic database transaction
    // -----------------------------------------------------

    const transaction =
        db.transaction(() => {

            insertIntent.run(

                id,

                traceId,

                validated.scope,

                validated.maxAmount,

                validated.currency,

                validated.validUntil,

                mandateHash,

                signature,

                "pending"

            );


            writeAuditEvent({

                traceId,

                entityType:
                    "intent",

                entityId:
                    id,

                event:
                    "created",

                previousStatus:
                    null,

                newStatus:
                    "pending",

                reasonCode:
                    "INTENT_CREATED",

                detail:
                    `Intent created for "${validated.scope}" with a maximum authorized amount of ${validated.maxAmount} ${validated.currency} minor units.`,

                metadata: {

                    max_amount:
                        validated.maxAmount,

                    currency:
                        validated.currency,

                    valid_until:
                        validated.validUntil,

                },

            });

        });


    transaction();


    return {

        id,

        trace_id:
            traceId,

        scope:
            validated.scope,

        max_amount:
            validated.maxAmount,

        currency:
            validated.currency,

        valid_until:
            validated.validUntil,

        status:
            "pending",

        mandate_hash:
            mandateHash,

        signature,

    };

}


// =========================================================
// GET INTENT
// =========================================================

export function getIntentById(id) {

    const intent =
        db
            .prepare(`
                SELECT *
                FROM intents
                WHERE id = ?
            `)
            .get(id);


    return intent || null;

}


// =========================================================
// APPROVE INTENT
// =========================================================

export function approveIntent(id) {

    const intent =
        getIntentById(id);


    // -----------------------------------------------------
    // Intent must exist
    // -----------------------------------------------------

    if (!intent) {

        const error =
            new Error(
                "Intent not found"
            );

        error.status = 404;
        error.code =
            "INTENT_NOT_FOUND";

        throw error;

    }


    // -----------------------------------------------------
    // Verify mandate integrity
    // -----------------------------------------------------

    verifyIntentIntegrity(
        intent
    );


    // -----------------------------------------------------
    // Already approved
    // -----------------------------------------------------

    if (
        intent.status ===
        "approved"
    ) {

        const error =
            new Error(
                "Intent is already approved"
            );

        error.status = 409;
        error.code =
            "INTENT_ALREADY_APPROVED";

        throw error;

    }


    // -----------------------------------------------------
    // Invalid state
    // -----------------------------------------------------

    if (
        intent.status !==
        "pending"
    ) {

        const error =
            new Error(
                `Intent cannot be approved from status '${intent.status}'`
            );

        error.status = 409;
        error.code =
            "INVALID_INTENT_STATE";

        throw error;

    }


    // -----------------------------------------------------
    // Check expiry
    // -----------------------------------------------------

    if (
        new Date(
            intent.valid_until
        ).getTime() <=
        Date.now()
    ) {

        const transaction =
            db.transaction(() => {

                db
                    .prepare(`
                        UPDATE intents
                        SET status = 'expired'
                        WHERE id = ?
                    `)
                    .run(id);


                writeAuditEvent({

                    traceId:
                        intent.trace_id,

                    entityType:
                        "intent",

                    entityId:
                        intent.id,

                    event:
                        "expired",

                    previousStatus:
                        "pending",

                    newStatus:
                        "expired",

                    reasonCode:
                        "INTENT_EXPIRED",

                    detail:
                        "Intent expired before it could be approved.",

                });

            });


        transaction();


        const error =
            new Error(
                "Intent has expired"
            );

        error.status = 409;
        error.code =
            "INTENT_EXPIRED";

        throw error;

    }


    // -----------------------------------------------------
    // Approve atomically
    // -----------------------------------------------------

    const transaction =
        db.transaction(() => {

            db
                .prepare(`
                    UPDATE intents
                    SET status = 'approved'
                    WHERE id = ?
                `)
                .run(id);


            writeAuditEvent({

                traceId:
                    intent.trace_id,

                entityType:
                    "intent",

                entityId:
                    intent.id,

                event:
                    "approved",

                previousStatus:
                    "pending",

                newStatus:
                    "approved",

                reasonCode:
                    "USER_APPROVAL_GRANTED",

                detail:
                    "Intent mandate was explicitly approved.",

            });

        });


    transaction();


    return getIntentById(
        id
    );

}


// =========================================================
// CALCULATE CART TOTAL
// =========================================================

function calculateCartTotal(items) {

    let total = 0;


    for (const item of items) {

        // -------------------------------------------------
        // Item must be an object
        // -------------------------------------------------

        if (
            !item ||
            typeof item !== "object" ||
            Array.isArray(item)
        ) {

            const error =
                new Error(
                    "Every cart item must be a valid object"
                );

            error.status = 400;
            error.code =
                "INVALID_CART_ITEM";

            throw error;
        }


        // -------------------------------------------------
        // Item name
        // -------------------------------------------------

        if (
            typeof item.name !== "string" ||
            item.name.trim().length === 0
        ) {

            const error =
                new Error(
                    "Every cart item must have a valid name"
                );

            error.status = 400;
            error.code =
                "INVALID_ITEM_NAME";

            throw error;
        }


        // -------------------------------------------------
        // Quantity
        // -------------------------------------------------

        if (
            !Number.isInteger(
                item.quantity
            ) ||
            item.quantity <= 0
        ) {

            const error =
                new Error(
                    "Item quantity must be a positive integer"
                );

            error.status = 400;
            error.code =
                "INVALID_ITEM_QUANTITY";

            throw error;
        }


        // -------------------------------------------------
        // Unit amount
        // -------------------------------------------------

        if (
            !Number.isInteger(
                item.unit_amount
            ) ||
            item.unit_amount <= 0
        ) {

            const error =
                new Error(
                    "Item unit_amount must be a positive integer in paise"
                );

            error.status = 400;
            error.code =
                "INVALID_ITEM_AMOUNT";

            throw error;
        }


        // -------------------------------------------------
        // Line total
        // -------------------------------------------------

        const lineTotal =
            item.quantity *
            item.unit_amount;


        if (
            !Number.isSafeInteger(
                lineTotal
            )
        ) {

            const error =
                new Error(
                    "Cart item total exceeds safe numeric range"
                );

            error.status = 400;
            error.code =
                "INVALID_CART_TOTAL";

            throw error;
        }


        total += lineTotal;


        if (
            !Number.isSafeInteger(
                total
            )
        ) {

            const error =
                new Error(
                    "Cart total exceeds safe numeric range"
                );

            error.status = 400;
            error.code =
                "INVALID_CART_TOTAL";

            throw error;
        }

    }


    return total;
}

// =========================================================
// CART INPUT VALIDATION
// =========================================================

function validateCartInput({
    intent_id,
    merchant,
    items,
    amount,
    currency = "INR",
}) {

    // -----------------------------------------------------
    // Intent ID
    // -----------------------------------------------------

    if (
        typeof intent_id !==
            "string" ||

        intent_id.trim()
            .length === 0
    ) {

        const error =
            new Error(
                "intent_id is required"
            );

        error.status = 400;
        error.code =
            "INVALID_INTENT_ID";

        throw error;

    }


    // -----------------------------------------------------
    // Merchant
    // -----------------------------------------------------

    if (
        typeof merchant !==
            "string" ||

        merchant.trim()
            .length === 0
    ) {

        const error =
            new Error(
                "merchant is required"
            );

        error.status = 400;
        error.code =
            "INVALID_MERCHANT";

        throw error;

    }


    // -----------------------------------------------------
    // Items
    // -----------------------------------------------------

    if (
        !Array.isArray(items) ||
        items.length === 0
    ) {

        const error =
            new Error(
                "items must be a non-empty array"
            );

        error.status = 400;
        error.code =
            "INVALID_ITEMS";

        throw error;

    }


    // -----------------------------------------------------
    // Calculate actual Cart total from line items
    // -----------------------------------------------------

    const calculatedAmount =
        calculateCartTotal(
            items
        );


    // -----------------------------------------------------
    // Declared amount must equal calculated amount
    // -----------------------------------------------------

    if (
        calculatedAmount !==
        amount
    ) {

        const error =
            new Error(
                "Cart amount does not match the sum of its line items"
            );

        error.status = 422;
        error.code =
            "CART_TOTAL_MISMATCH";

        error.details = {

            declared_amount:
                amount,

            calculated_amount:
                calculatedAmount,

            difference:
                Math.abs(
                    calculatedAmount -
                    amount
                ),

            currency:
                currency
                    .trim()
                    .toUpperCase(),

        };

        throw error;

    }


    // -----------------------------------------------------
    // Amount
    // -----------------------------------------------------

    if (
        !Number.isInteger(amount) ||
        amount <= 0
    ) {

        const error =
            new Error(
                "amount must be a positive integer in paise"
            );

        error.status = 400;
        error.code =
            "INVALID_CART_AMOUNT";

        throw error;

    }


    // -----------------------------------------------------
    // Currency
    // -----------------------------------------------------

    if (
        typeof currency !==
            "string" ||

        currency.trim()
            .length !== 3
    ) {

        const error =
            new Error(
                "currency must be a valid 3-letter currency code"
            );

        error.status = 400;
        error.code =
            "INVALID_CURRENCY";

        throw error;

    }


    return {

        intentId:
            intent_id.trim(),

        merchant:
            merchant.trim(),

        items,

        amount:
            calculatedAmount,

        currency:
            currency
                .trim()
                .toUpperCase(),

    };

}


// =========================================================
// STABLE JSON SERIALIZATION
// =========================================================

function stableStringify(value) {

    if (value === null) {

        return "null";

    }


    if (
        typeof value !==
        "object"
    ) {

        return JSON.stringify(
            value
        );

    }


    if (
        Array.isArray(value)
    ) {

        return (
            "[" +
            value
                .map(
                    stableStringify
                )
                .join(",") +
            "]"
        );

    }


    const keys =
        Object
            .keys(value)
            .sort();


    return (
        "{" +

        keys
            .map(
                (key) =>

                    JSON.stringify(key) +
                    ":" +
                    stableStringify(
                        value[key]
                    )

            )
            .join(",") +

        "}"
    );

}


// =========================================================
// GENERATE CART HASH
// =========================================================

function generateCartHash({
    intentId,
    parentHash,
    merchant,
    items,
    amount,
    currency,
}) {

    const canonicalPayload =
        stableStringify({

            intent_id:
                intentId,

            parent_hash:
                parentHash,

            merchant,

            items,

            amount,

            currency,

        });


    return crypto
        .createHash("sha256")
        .update(canonicalPayload)
        .digest("hex");

}


// =========================================================
// SIGN CART
// =========================================================

function signCart({
    id,
    traceId,
    intentId,
    parentHash,
    mandateHash,
}) {

    return jwt.sign(

        {

            id,

            trace_id:
                traceId,

            intent_id:
                intentId,

            parent_hash:
                parentHash,

            mandate_hash:
                mandateHash,

            type:
                "cart",

        },

        process.env.JWT_SECRET,

        {

            algorithm:
                "HS256",

        }

    );

}


// =========================================================
// GET CART
// =========================================================

export function getCartById(id) {

    const cart =
        db
            .prepare(`
                SELECT *
                FROM carts
                WHERE id = ?
            `)
            .get(id);


    if (!cart) {

        return null;

    }


    // -----------------------------------------------------
    // Convert stored JSON string back into array
    // -----------------------------------------------------

    try {

        cart.items =
            JSON.parse(
                cart.items
            );

    }
    catch {

        // If malformed somehow, keep raw database value.

    }


    return cart;

}

// =========================================================
// VERIFY CART INTEGRITY
// =========================================================

export function verifyCartIntegrity(cart) {

    if (!cart) {

        const error =
            new Error(
                "Cart is required for integrity verification"
            );

        error.status = 400;
        error.code =
            "INVALID_CART";

        throw error;
    }


    // -----------------------------------------------------
    // Recalculate Cart hash
    // -----------------------------------------------------

    const calculatedHash =
        generateCartHash({

            intentId:
                cart.intent_id,

            parentHash:
                cart.parent_hash,

            merchant:
                cart.merchant,

            items:
                cart.items,

            amount:
                cart.amount,

            currency:
                cart.currency,

        });


    if (
        calculatedHash !==
        cart.mandate_hash
    ) {

        const error =
            new Error(
                "Cart mandate hash verification failed"
            );

        error.status = 409;
        error.code =
            "CART_HASH_INVALID";

        throw error;
    }


    // -----------------------------------------------------
    // Verify JWT
    // -----------------------------------------------------

    let decoded;


    try {

        decoded =
            jwt.verify(
                cart.signature,
                process.env.JWT_SECRET,
                {
                    algorithms: [
                        "HS256"
                    ],
                }
            );

    }
    catch {

        const error =
            new Error(
                "Cart signature verification failed"
            );

        error.status = 409;
        error.code =
            "CART_SIGNATURE_INVALID";

        throw error;
    }


    // -----------------------------------------------------
    // Verify signed claims
    // -----------------------------------------------------

    if (
        decoded.id !==
            cart.id ||

        decoded.trace_id !==
            cart.trace_id ||

        decoded.intent_id !==
            cart.intent_id ||

        decoded.parent_hash !==
            cart.parent_hash ||

        decoded.mandate_hash !==
            cart.mandate_hash ||

        decoded.type !==
            "cart"
    ) {

        const error =
            new Error(
                "Cart signature payload does not match stored mandate"
            );

        error.status = 409;
        error.code =
            "CART_SIGNATURE_MISMATCH";

        throw error;
    }


    return true;
}


// =========================================================
// CREATE CART
// =========================================================

export function createCart(input) {

    // -----------------------------------------------------
    // Validate incoming Cart
    // -----------------------------------------------------

    const validated =
        validateCartInput(
            input
        );


    // -----------------------------------------------------
    // Find parent Intent
    // -----------------------------------------------------

    const intent =
        getIntentById(
            validated.intentId
        );


    if (!intent) {

        const error =
            new Error(
                "Parent Intent not found"
            );

        error.status = 404;
        error.code =
            "INTENT_NOT_FOUND";

        throw error;

    }


    // -----------------------------------------------------
    // Verify parent Intent integrity
    // -----------------------------------------------------

    verifyIntentIntegrity(
        intent
    );


    // -----------------------------------------------------
    // An approved Intent authorizes one approved Cart only.
    // Rejected attempts do not consume the authorization, so
    // the user can still submit a cheaper valid proposal.
    // -----------------------------------------------------

    const committedCart =
        db
            .prepare(`
                SELECT id, trace_id, status
                FROM carts
                WHERE intent_id = ?
                    AND status = 'approved'
                LIMIT 1
            `)
            .get(
                intent.id
            );


    if (committedCart) {

        const error =
            new Error(
                "Intent has already been used for an approved Cart"
            );

        error.status = 409;
        error.code =
            "INTENT_ALREADY_COMMITTED";

        error.details = {

            intent_id:
                intent.id,

            cart_id:
                committedCart.id,

            trace_id:
                committedCart.trace_id,

            cart_status:
                committedCart.status,

        };

        throw error;

    }

    

    // -----------------------------------------------------
    // Generate Cart ID
    // -----------------------------------------------------

    const id =
        `cart_${crypto.randomUUID()}`;


    // -----------------------------------------------------
    // Cart inherits same trace
    // -----------------------------------------------------

    const traceId =
        intent.trace_id;


    // -----------------------------------------------------
    // Cryptographic parent link
    // -----------------------------------------------------

    const parentHash =
        intent.mandate_hash;


    // -----------------------------------------------------
    // Generate Cart hash
    // -----------------------------------------------------

    const mandateHash =
        generateCartHash({

            intentId:
                validated.intentId,

            parentHash,

            merchant:
                validated.merchant,

            items:
                validated.items,

            amount:
                validated.amount,

            currency:
                validated.currency,

        });


    // -----------------------------------------------------
    // Generate Cart signature
    // -----------------------------------------------------

    const signature =
        signCart({

            id,

            traceId,

            intentId:
                validated.intentId,

            parentHash,

            mandateHash,

        });


    // -----------------------------------------------------
    // Validate Intent + spend cap
    // -----------------------------------------------------

    let capResult;


    try {

        capResult =
            validateCartAgainstIntent({

                intent,

                amount:
                    validated.amount,

                currency:
                    validated.currency,

            });

    }
    catch (error) {

        // -------------------------------------------------
        // CAP_EXCEEDED is intentionally stored.
        //
        // This gives us proof that an unauthorized
        // transaction attempt was blocked.
        // -------------------------------------------------

        if (
            error.code ===
            "CAP_EXCEEDED"
        ) {

            const transaction =
                db.transaction(() => {

                    db
                        .prepare(`
                            INSERT INTO carts (
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
                                status
                            )
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `)
                        .run(

                            id,

                            traceId,

                            validated.intentId,

                            validated.merchant,

                            JSON.stringify(
                                validated.items
                            ),

                            validated.amount,

                            validated.currency,

                            parentHash,

                            mandateHash,

                            signature,

                            "rejected"

                        );


                    writeAuditEvent({

                        traceId,

                        entityType:
                            "cart",

                        entityId:
                            id,

                        event:
                            "rejected",

                        previousStatus:
                            null,

                        newStatus:
                            "rejected",

                        reasonCode:
                            "CAP_EXCEEDED",

                        detail:
                            `Cart rejected because requested amount ${validated.amount} exceeded authorized amount ${intent.max_amount}.`,

                        metadata: {

                            intent_id:
                                intent.id,

                            authorized_amount:
                                intent.max_amount,

                            requested_amount:
                                validated.amount,

                            excess_amount:
                                validated.amount -
                                intent.max_amount,

                            currency:
                                validated.currency,

                        },

                    });

                });


            transaction();


            error.details = {

                ...(
                    error.details ||
                    {}
                ),

                cart_id:
                    id,

                trace_id:
                    traceId,

                status:
                    "rejected",

            };

        }


        throw error;

    }


    // -----------------------------------------------------
    // Cart passed authorization checks
    // -----------------------------------------------------

    const transaction =
        db.transaction(() => {

            db
                .prepare(`
                    INSERT INTO carts (
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
                        status
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `)
                .run(

                    id,

                    traceId,

                    validated.intentId,

                    validated.merchant,

                    JSON.stringify(
                        validated.items
                    ),

                    validated.amount,

                    validated.currency,

                    parentHash,

                    mandateHash,

                    signature,

                    "approved"

                );


            // -------------------------------------------------
            // Cart created
            // -------------------------------------------------

            writeAuditEvent({

                traceId,

                entityType:
                    "cart",

                entityId:
                    id,

                event:
                    "created",

                previousStatus:
                    null,

                newStatus:
                    "approved",

                reasonCode:
                    "CART_CREATED",

                detail:
                    "Cart Mandate created and linked to approved Intent.",

                metadata: {

                    intent_id:
                        intent.id,

                    merchant:
                        validated.merchant,

                    amount:
                        validated.amount,

                    currency:
                        validated.currency,

                },

            });


            // -------------------------------------------------
            // Cap validation passed
            // -------------------------------------------------

            writeAuditEvent({

                traceId,

                entityType:
                    "cart",

                entityId:
                    id,

                event:
                    "cap_check_passed",

                previousStatus:
                    "approved",

                newStatus:
                    "approved",

                reasonCode:
                    "WITHIN_SPEND_CAP",

                detail:
                    `Requested amount ${validated.amount} is within authorized cap ${intent.max_amount}.`,

                metadata: {

                    authorized_amount:
                        intent.max_amount,

                    requested_amount:
                        validated.amount,

                    remaining_amount:
                        capResult.remaining_amount,

                    currency:
                        validated.currency,

                },

            });

        });


    transaction();


    // -----------------------------------------------------
    // Response object
    // -----------------------------------------------------

    return {

        id,

        trace_id:
            traceId,

        intent_id:
            validated.intentId,

        merchant:
            validated.merchant,

        items:
            validated.items,

        amount:
            validated.amount,

        currency:
            validated.currency,

        parent_hash:
            parentHash,

        mandate_hash:
            mandateHash,

        signature,

        status:
            "approved",

        cap_validation:
            capResult,

    };

}
