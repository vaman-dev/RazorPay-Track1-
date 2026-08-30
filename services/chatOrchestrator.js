import crypto from "crypto";

import {
    createIntent,
    approveIntent,
    createCart,
    getIntentById,
    getCartById,
} from "./consentManager.js";

import {
    createPaymentForCart,
} from "./paymentService.js";

import {
    computeCheckoutPreview,
} from "./commerceCheckoutService.js";

import {
    createCheckoutSession,
    getCheckoutSession,
} from "./checkoutSessionService.js";

import {
    createCommerceIntent,
    attachCommerceIntent,
    commitCommerceCart,
    initializeCommercePayment,
} from "./commerceMandateBridge.js";

import {
    getProducts,
} from "./catalogService.js";

import {
    getTraceById,
} from "./traceService.js";

import {
    getIntentBudgetState,
} from "./spendCapController.js";

import {
    runChatTurn,
    sendFunctionResult,
} from "./geminiService.js";


// =========================================================
// CONFIGURATION
// =========================================================

const MAX_TOOL_STEPS = 5;


// =========================================================
// IN-MEMORY CHAT SESSIONS
// =========================================================
//
// Fine for hackathon / MVP.
//
// Later:
//
// Redis / database
//
// can replace this without changing Gemini or payment logic.
//

const sessions =
    new Map();


// =========================================================
// TOOL CLASSIFICATION
// =========================================================

const MUTATING_TOOLS =
    new Set([

        "create_intent",
        "approve_intent",
        "create_cart",
        "create_checkout_intent",
        "attach_checkout_intent",
        "commit_checkout_cart",
        "initiate_checkout_payment",
        "initiate_payment",

    ]);


// These actions ALWAYS need backend-side
// explicit confirmation.
//
// The system prompt alone is NOT trusted.
//
const CONFIRMATION_REQUIRED_TOOLS =
    new Set([

        "approve_intent",
        "initiate_checkout_payment",
        "initiate_payment",

    ]);


// =========================================================
// SESSION CREATION
// =========================================================

function createSession() {

    const id =
        `chat_${crypto.randomUUID()}`;


const session = {

        id,

        history: [],

        // Keep the current mandate chain available to later
        // conversational turns without making the model the
        // source of truth for those identifiers.
        state: {
            intent_id: null,
            active_intent_id: null,
            intent_ids: [],
            trace_id: null,
            cart_id: null,
            payment_id: null,
            checkout_ids: [],
            cart_ids: [],
            payment_ids: [],
            traces_by_intent: {},
            explicit_existing_authorization: false,
        },

        pendingConfirmation:
            null,

        createdAt:
            new Date()
                .toISOString(),

        updatedAt:
            new Date()
                .toISOString(),

    };


    sessions.set(
        id,
        session
    );


    return session;
}


// =========================================================
// GET / CREATE SESSION
// =========================================================

function getOrCreateSession(
    sessionId
) {

    if (
        sessionId &&
        sessions.has(
            sessionId
        )
    ) {

        return sessions.get(
            sessionId
        );

    }


    return createSession();
}


// =========================================================
// TOUCH SESSION
// =========================================================

function touchSession(
    session
) {

    session.updatedAt =
        new Date()
            .toISOString();

}


// =========================================================
// MONEY FORMATTER
// =========================================================

function formatMoney(
    amount,
    currency = "INR"
) {

    if (
        amount === null ||
        amount === undefined
    ) {

        return null;

    }


    if (
        currency === "INR"
    ) {

        return `₹${(
            Number(amount) /
            100
        ).toFixed(2)}`;

    }


    return `${(
        Number(amount) /
        100
    ).toFixed(2)} ${currency}`;
}


// =========================================================
// SANITIZE DATA FOR GEMINI / CLIENT
// =========================================================
//
// Raw JWT signatures are unnecessary for Gemini.
//
// Never expose secrets accidentally.
//

function sanitizeValue(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {

        return value;

    }


    if (
        Array.isArray(
            value
        )
    ) {

        return value.map(
            sanitizeValue
        );

    }


    if (
        typeof value ===
        "object"
    ) {

        const output = {};


        for (
            const [
                key,
                childValue
            ]
            of Object.entries(
                value
            )
        ) {

            const normalizedKey =
                key.toLowerCase();


            // ---------------------------------------------
            // Never expose these
            // ---------------------------------------------

            if (
                normalizedKey ===
                    "signature" ||

                normalizedKey.includes(
                    "key_secret"
                ) ||

                normalizedKey.includes(
                    "webhook_secret"
                ) ||

                normalizedKey.includes(
                    "jwt_secret"
                ) ||

                normalizedKey ===
                    "gemini_api_key"
            ) {

                continue;

            }


            output[key] =
                sanitizeValue(
                    childValue
                );

        }


        return output;

    }


    return value;
}


// =========================================================
// TOOL SUCCESS ENVELOPE
// =========================================================

function toolSuccess(
    toolName,
    data
) {

    return {

        success:
            true,

        tool:
            toolName,

        data:
            sanitizeValue(
                data
            ),

    };
}


// =========================================================
// TOOL ERROR ENVELOPE
// =========================================================

function toolFailure(
    toolName,
    error
) {

    return {

        success:
            false,

        tool:
            toolName,

        error: {

            code:
                error.code ||
                "TOOL_EXECUTION_FAILED",

            message:
                error.message ||
                "Tool execution failed",

            details:
                sanitizeValue(
                    error.details ||
                    null
                ),

        },

    };
}


// =========================================================
// EXECUTE INTERNAL TOOL
// =========================================================
//
// IMPORTANT:
//
// NO HTTP calls.
//
// These are direct same-process service calls.
//

async function executeTool(
    functionCall
) {

    const {

        name,
        args = {},

    } = functionCall;


    switch (name) {

        // =================================================
        // CREATE INTENT
        // =================================================

        case "create_intent": {

            return await createIntent({

                scope:
                    args.scope,

                max_amount:
                    args.max_amount,

                currency:
                    args.currency ||
                    "INR",

                valid_until:
                    args.valid_until,

                usage_mode:
                    args.usage_mode || "single_use",

                policy:
                    args.policy || null,

            });

        }


        // =================================================
        // APPROVE INTENT
        // =================================================

        case "approve_intent": {

            return await approveIntent(
                args.intent_id
            );

        }


        // =================================================
        // CREATE CART
        // =================================================

        case "create_cart": {

            // A legacy free-form cart has no trusted product/category/merchant
            // identifiers. It must never be used to bypass a structured scope
            // policy; catalog purchases must go through checkout preview.
            const intent = getIntentById(args.intent_id);
            let policy = null;
            try {
                policy = intent?.policy_json ? JSON.parse(intent.policy_json) : null;
            } catch {
                policy = null;
            }
            if (policy && ["categories", "merchant_ids", "product_ids"].some((key) => policy[key]?.length)) {
                const error = new Error("This scoped authorization requires a trusted catalog checkout. Use create_checkout_preview and commit_checkout_cart.");
                error.code = "TRUSTED_COMMERCE_REQUIRED";
                error.status = 409;
                throw error;
            }

            return await createCart({

                intent_id:
                    args.intent_id,

                merchant:
                    args.merchant,

                items:
                    args.items,

                amount:
                    args.amount,

                currency:
                    args.currency ||
                    "INR",

            });

        }


        case "search_products": {
            const query = String(args.query || "").trim().toLowerCase();
            const category = String(args.category || "").trim().toLowerCase();
            return getProducts().filter((product) => {
                const matchesCategory = !category || product.category.toLowerCase() === category;
                const haystack = `${product.id} ${product.name} ${product.category} ${product.merchant}`.toLowerCase();
                return matchesCategory && (!query || haystack.includes(query));
            }).map(({ id, name, price, currency, merchant, category, stock }) => ({ product_id: id, name, price, currency, merchant, category, stock }));
        }

        case "create_checkout_preview":
            return createCheckoutSession(computeCheckoutPreview(args.items));

        case "create_checkout_intent":
            return createCommerceIntent(args.checkout_id, args.valid_until, args.max_amount ?? null, args.usage_mode);

        case "attach_checkout_intent":
            return attachCommerceIntent(args.checkout_id, args.intent_id);

        case "commit_checkout_cart":
            return commitCommerceCart(args.checkout_id);

        case "initiate_checkout_payment":
            return await initializeCommercePayment(args.checkout_id);


        // =================================================
        // GET TRACE
        // =================================================

        case "get_trace": {

            return await getTraceById(
                args.trace_id
            );

        }


        // =================================================
        // INITIATE PAYMENT
        // =================================================

        case "initiate_payment": {

            return await createPaymentForCart(
                args.cart_id
            );

        }


        // =================================================
        // UNKNOWN TOOL
        // =================================================

        default: {

            const error =
                new Error(
                    `Unsupported Gemini tool: ${name}`
                );

            error.code =
                "UNSUPPORTED_GEMINI_TOOL";

            error.status =
                400;

            throw error;

        }

    }

}


// =========================================================
// EXECUTE TOOL SAFELY
// =========================================================

async function executeToolSafely(
    functionCall
) {

    try {

        const data =
            await executeTool(
                functionCall
            );


        return toolSuccess(

            functionCall.name,

            data

        );

    }
    catch (error) {

        return toolFailure(

            functionCall.name,

            error

        );

    }

}


// =========================================================
// EXTRACT CLIENT ACTION
// =========================================================
//
// initiate_payment returns Razorpay checkout data.
//
// Gemini can explain the result,
// but the browser still needs checkout configuration
// to actually open Razorpay.
//

function extractClientAction(
    functionCall,
    toolResult
) {

    if (
        !toolResult.success
    ) {

        return null;

    }


    if (
        ["initiate_payment", "initiate_checkout_payment"].includes(
            functionCall.name
        )
    ) {

        const payment =
            toolResult.data;


        if (
            payment?.checkout
        ) {

            return {

                type:
                    "razorpay_checkout",

                payment_id:
                    payment.id,

                trace_id:
                    payment.trace_id,

                cart_id:
                    payment.cart_id,

                checkout:
                    {

                        key_id:
                            payment.checkout.key_id,

                        order_id:
                            payment.checkout.order_id,

                        amount:
                            payment.checkout.amount,

                        currency:
                            payment.checkout.currency,

                    },

            };

        }

    }


    return null;
}

// Re-ground every ordinary Gemini turn in backend-owned authorization state.
// Session IDs are only pointers; Intent status, policy, and budget are always
// read from the ledger immediately before the model is called.
function buildAuthorizationContext(session) {
    const authorizations = (session.state.intent_ids || []).map((intentId) => {
        const intent = getIntentById(intentId);
        if (!intent || intent.status !== "approved" || new Date(intent.valid_until).getTime() <= Date.now()) return null;

        let policy = null;
        try {
            policy = intent.policy_json ? JSON.parse(intent.policy_json) : null;
        } catch {
            policy = null;
        }

        const budget = getIntentBudgetState(intent.id, intent);
        return {
            intent_id: intent.id,
            trace_id: intent.trace_id,
            scope: intent.scope,
            status: intent.status,
            usage_mode: intent.usage_mode,
            currency: intent.currency,
            max_amount: Number(intent.max_amount),
            committed_amount: budget.committed_amount,
            remaining_amount: budget.remaining_amount,
            policy,
        };
    }).filter(Boolean);

    if (!authorizations.length) return null;
    return {
        active_intent_id: session.state.active_intent_id,
        active_authorizations: authorizations,
    };
}


// =========================================================
// SAFE POLICY-VIOLATION PRESENTATION DATA
// =========================================================
//
// Tool errors are normally given to Gemini so it can explain
// them conversationally. Only explicitly whitelisted product
// failures may also be returned to the browser as structured
// UI data. Do not expose arbitrary internal errors here.

function buildPolicyViolation(
    toolResult
) {

    const error =
        toolResult?.error;


    if (![
        "CAP_EXCEEDED",
        "SCOPE_NOT_ALLOWED",
    ].includes(error?.code)) {

        return null;

    }


    return {

        code:
            error.code,

        message:
            error.message,

        details: {

            authorized_amount:
                error.details?.authorized_amount,

            committed_amount:
                error.details?.committed_amount,

            remaining_amount:
                error.details?.remaining_amount,

            requested_amount:
                error.details?.requested_amount,

            excess_amount:
                error.details?.excess_amount,

            currency:
                error.details?.currency,

            scope:
                error.details?.scope,

            allowed_categories:
                error.details?.allowed_categories,

            requested_category:
                error.details?.requested_category,

            product_id:
                error.details?.product_id,

            product_name:
                error.details?.product_name,

        },

    };
}


// =========================================================
// PERSIST CONVERSATIONAL MANDATE STATE
// =========================================================
//
// Only authoritative, successful backend results update this
// state. Rejected Cart attempts therefore cannot become the
// active Cart for a session.
//
function updateSessionState(
    session,
    functionCall,
    toolResult
) {

    if (
        !toolResult.success
    ) {

        return;

    }


    const data =
        toolResult.data || {};


    if (
        functionCall.name ===
        "create_intent"
    ) {

        session.state.intent_id =
            data.id;

        session.state.active_intent_id = data.id;

        if (!session.state.intent_ids.includes(data.id)) {
            session.state.intent_ids.push(data.id);
        }

        session.state.trace_id =
            data.trace_id;

        session.state.traces_by_intent[data.id] = data.trace_id;

    }


if (
        functionCall.name ===
        "create_cart"
    ) {

        session.state.intent_id =
            data.intent_id;

        session.state.trace_id =
            data.trace_id;

        session.state.cart_id =
            data.id;

        if (!session.state.cart_ids.includes(data.id)) {
            session.state.cart_ids.push(data.id);
        }

    }

    if (functionCall.name === "create_checkout_preview") {
        if (!session.state.checkout_ids.includes(data.checkout_id)) {
            session.state.checkout_ids.push(data.checkout_id);
        }
    }

    if (["create_checkout_intent", "attach_checkout_intent"].includes(functionCall.name)) {
        const intent = data.intent || data;
        if (intent?.id) {
            session.state.intent_id = intent.id;
            session.state.active_intent_id = intent.id;
            if (!session.state.intent_ids.includes(intent.id)) session.state.intent_ids.push(intent.id);
            if (intent.trace_id) session.state.traces_by_intent[intent.id] = intent.trace_id;
        }
    }

    if (functionCall.name === "commit_checkout_cart") {
        const cart = data.cart;
        const intent = data.intent;
        if (cart?.id) {
            session.state.cart_id = cart.id;
            if (!session.state.cart_ids.includes(cart.id)) session.state.cart_ids.push(cart.id);
        }
        if (intent?.id) {
            session.state.intent_id = intent.id;
            session.state.active_intent_id = intent.id;
            if (intent.trace_id) session.state.traces_by_intent[intent.id] = intent.trace_id;
        }
        if (cart?.trace_id) session.state.trace_id = cart.trace_id;
    }


    if (
        ["initiate_payment", "initiate_checkout_payment"].includes(functionCall.name)
    ) {

        session.state.payment_id =
            data.id;

        if (!session.state.payment_ids.includes(data.id)) {
            session.state.payment_ids.push(data.id);
        }

        if (data.trace_id) {
            session.state.trace_id =
                data.trace_id;
        }

        if (data.cart_id) {
            session.state.cart_id =
                data.cart_id;
        }

    }

}


// =========================================================
// FAST TOOL RESPONSES
// =========================================================
//
// These successful operations have deterministic, trusted
// backend results. Returning them directly avoids a second
// Gemini inference that would only restate the same result.
//
// Errors, traces, and any other result continue through
// Gemini so that their explanation remains grounded.
//
function buildFastToolResponse(
    functionCall,
    toolResult
) {

    if (
        !toolResult.success
    ) {

        return null;

    }


    const data =
        toolResult.data || {};


    switch (functionCall.name) {

        case "create_intent":
            return `Intent created for "${data.scope}" with a maximum authorization of ${formatMoney(
                data.max_amount,
                data.currency
            )}. It is pending your approval.`;


        case "approve_intent":
            return `Intent for "${data.scope}" has been approved with a maximum authorization of ${formatMoney(
                data.max_amount,
                data.currency
            )}.`;


        case "create_cart": {

            const capValidation =
                data.cap_validation || {};


            return `Cart approved for ${formatMoney(
                data.amount,
                data.currency
            )}. This is within your ${formatMoney(
                capValidation.max_amount,
                data.currency
            )} authorization, leaving ${formatMoney(
                capValidation.remaining_after ?? capValidation.remaining_amount,
                data.currency
            )} available.`;

        }

        case "initiate_payment":
            return data.already_exists
                ? `A payment order already exists for Cart ${data.cart_id}.`
                : `Payment order created for ${formatMoney(
                    data.amount,
                    data.currency
                )}. Complete the payment in the secure Razorpay checkout.`;


        default:
            return null;

    }

}


// =========================================================
// RESOLVE TOOL CALL AGAINST TRUSTED SESSION STATE
// =========================================================

function resolveToolCallForSession(
    functionCall,
    session
) {

    if (
        functionCall.name !==
        "get_trace"
    ) {

        return functionCall;
    }


    const sessionTraceId =
        session?.state?.trace_id;


    const requestedTraceId =
        functionCall.args?.trace_id;


    // A model-supplied trace is accepted only when it belongs to this
    // session. This lets users query an older active Intent without letting
    // the model inspect an unrelated trace.
    const ownedTraceIds = Object.values(session?.state?.traces_by_intent || {});
    const traceId = requestedTraceId
        ? (ownedTraceIds.includes(requestedTraceId) ? requestedTraceId : null)
        : sessionTraceId;


    if (!traceId) {

        const error =
            new Error(
                requestedTraceId
                    ? "The requested trace does not belong to this chat session."
                    : "No trace is associated with this chat session."
            );

        error.code =
            "TRACE_ID_NOT_AVAILABLE";

        error.status =
            400;

        throw error;

    }


    return {

        ...functionCall,

        args: {

            ...functionCall.args,

            trace_id:
                traceId,

        },

    };

}


// =========================================================
// BUILD COMPACT TRACE CONTEXT FOR GEMINI
// =========================================================

function buildTraceContextForGemini(
    traceResult
) {

    // Supports either:
    // raw trace object
    // OR
    // { success, data: trace }
    const trace =
        traceResult?.data ??
        traceResult;


    if (!trace) {

        return {
            available:
                false,
        };

    }


    return {

        available:
            true,

        trace_id:
            trace.trace_id,

        summary:
            trace.summary,

        integrity: {

            trace_consistent:
                trace.integrity
                    ?.trace_consistent,

            intent_cart_links_valid:
                trace.integrity
                    ?.intent_cart_links_valid,

            cart_payment_links_valid:
                trace.integrity
                    ?.cart_payment_links_valid,

            cryptographic_valid:
                trace.integrity
                    ?.cryptographic
                    ?.valid,

            chain_valid:
                trace.integrity
                    ?.chain_valid,

        },


        intent:
            trace.intent
                ? {

                    id:
                        trace.intent.id,

                    scope:
                        trace.intent.scope,

                    max_amount:
                        trace.intent.max_amount,

                    currency:
                        trace.intent.currency,

                    valid_until:
                        trace.intent.valid_until,

                    usage_mode:
                        trace.intent.usage_mode,

                    policy:
                        (() => {
                            try {
                                return trace.intent.policy_json
                                    ? JSON.parse(trace.intent.policy_json)
                                    : null;
                            } catch {
                                return null;
                            }
                        })(),

                    status:
                        trace.intent.status,

                    signature_present:
                        trace.intent
                            .signature_present,

                }
                : null,


        carts:
            Array.isArray(
                trace.carts
            )
                ? trace.carts.map(
                    (cart) => ({

                        id:
                            cart.id,

                        intent_id:
                            cart.intent_id,

                        merchant:
                            cart.merchant,

                        items:
                            cart.items,

                        amount:
                            cart.amount,

                        currency:
                            cart.currency,

                        status:
                            cart.status,

                        signature_present:
                            cart.signature_present,

                    })
                )
                : [],


        payments:
            Array.isArray(
                trace.payments
            )
                ? trace.payments.map(
                    (payment) => ({

                        id:
                            payment.id,

                        cart_id:
                            payment.cart_id,

                        razorpay_order_id:
                            payment
                                .razorpay_order_id,

                        razorpay_payment_id:
                            payment
                                .razorpay_payment_id,

                        amount:
                            payment.amount,

                        currency:
                            payment.currency,

                        status:
                            payment.status,

                        failure_code:
                            payment.failure_code,

                        failure_detail:
                            payment.failure_detail,

                        signature_present:
                            payment
                                .signature_present,

                    })
                )
                : [],


        audit_timeline:
            Array.isArray(
                trace.audit_timeline
            )
                ? trace.audit_timeline
                    .slice(-12)
                    .map(
                        (event) => ({

                            event:
                                event.event,

                            entity_type:
                                event.entity_type,

                            entity_id:
                                event.entity_id,

                            reason_code:
                                event.reason_code,

                            previous_status:
                                event.previous_status,

                            new_status:
                                event.new_status,

                            detail:
                                event.detail,

                            timestamp:
                                event.timestamp,

                        })
                    )
                : [],

    };

}


// =========================================================
// PERSIST FUNCTION RESULT WITHOUT A FOLLOW-UP GENERATION
// =========================================================
//
// A fast response must still retain the executed tool result
// in Gemini history. Future turns therefore remain grounded
// in the backend action even though this turn skipped Gemini's
// explanatory follow-up.
//
function appendFunctionResultToHistory(
    history,
    functionCall,
    toolResult
) {

    if (
        functionCall.name === "create_checkout_intent" &&
        session?.state?.explicit_existing_authorization
    ) {
        const error = new Error(
            "The user explicitly requested an existing authorization. Attach that Intent or report its backend rejection; do not create another authorization."
        );
        error.code = "EXISTING_AUTHORIZATION_REQUIRED";
        error.status = 409;
        throw error;
    }

    const functionResponse = {

        name:
            functionCall.name,

        response:
            toolResult,

    };


    if (
        functionCall.id
    ) {

        functionResponse.id =
            functionCall.id;

    }


    return [

        ...history,

        {
            role:
                "user",

            parts: [

                {
                    functionResponse,

                },

            ],

        },

    ];

}


// =========================================================
// PERSIST BACKEND-INITIATED CONFIRMATION CALL
// =========================================================
//
// create_intent deterministically requires an approval gate.
// Record that backend-created call as model history before its
// eventual FunctionResponse so the next Gemini turn receives
// a valid function-call / function-response sequence.
//
function appendFunctionCallToHistory(
    history,
    functionCall
) {

    const modelFunctionCall = {

        name:
            functionCall.name,

        args:
            functionCall.args || {},

    };


    if (
        functionCall.id
    ) {

        modelFunctionCall.id =
            functionCall.id;

    }


    return [

        ...history,

        {
            role:
                "model",

            parts: [

                {
                    functionCall:
                        modelFunctionCall,

                },

            ],

        },

    ];

}


// =========================================================
// BUILD CONFIRMATION DETAILS
// =========================================================

async function buildConfirmation(
    functionCall
) {

    const {

        name,
        args = {},

    } = functionCall;


    // =====================================================
    // INTENT APPROVAL
    // =====================================================

    if (
        name ===
        "approve_intent"
    ) {

        try {

            const intent =
                getIntentById(
                    args.intent_id
                );


            return {

                action:
                    "approve_intent",

                title:
                    "Approve this authorization?",

                message:
                    `Approve permission to "${intent.scope}" with a maximum spend of ${formatMoney(
                        intent.max_amount,
                        intent.currency
                    )}?`,

                details: {

                    intent_id:
                        intent.id,

                    scope:
                        intent.scope,

                    max_amount:
                        intent.max_amount,

                    formatted_max_amount:
                        formatMoney(
                            intent.max_amount,
                            intent.currency
                        ),

                    currency:
                        intent.currency,

                    valid_until:
                        intent.valid_until,

                    usage_mode:
                        intent.usage_mode,

                    policy:
                        (() => {
                            try {
                                return intent.policy_json
                                    ? JSON.parse(intent.policy_json)
                                    : null;
                            } catch {
                                return null;
                            }
                        })(),

                },

            };

        }
        catch {

            return {

                action:
                    "approve_intent",

                title:
                    "Approve Intent?",

                message:
                    `Confirm approval of Intent ${args.intent_id}.`,

                details: {

                    intent_id:
                        args.intent_id,

                },

            };

        }

    }


    // =====================================================
    // PAYMENT CONFIRMATION
    // =====================================================

    if (
        ["initiate_payment", "initiate_checkout_payment"].includes(name)
    ) {
        const checkout = name === "initiate_checkout_payment"
            ? getCheckoutSession(args.checkout_id)
            : null;
        const cart = getCartById(checkout?.cart_id || args.cart_id);


        if (!cart) {

            const error =
                new Error(
                    "Cart not found"
                );

            error.code =
                "CART_NOT_FOUND";

            error.status =
                404;

            throw error;

        }


        if (
            cart.status !==
            "approved"
        ) {

            const error =
                new Error(
                    "Only an approved Cart can be paid"
                );

            error.code =
                "CART_NOT_APPROVED";

            error.status =
                409;

            throw error;

        }


        return {

            action:
                "initiate_payment",

            title:
                "Confirm payment",

            message:
                `You are about to pay ${formatMoney(
                    cart.amount,
                    cart.currency
                )} to ${cart.merchant}. Confirm payment?`,

            details: {

                cart_id:
                    cart.id,

                checkout_id:
                    checkout?.checkout_id,

                trace_id:
                    cart.trace_id,

                merchant:
                    cart.merchant,

                amount:
                    cart.amount,

                formatted_amount:
                    formatMoney(
                        cart.amount,
                        cart.currency
                    ),

                currency:
                    cart.currency,

                items:
                    cart.items,

                status:
                    cart.status,

            },

        };

    }


    // =====================================================
    // FALLBACK
    // =====================================================

    return {

        action:
            name,

        title:
            "Confirm action",

        message:
            `Confirm ${name}.`,

        details:
            sanitizeValue(
                args
            ),

    };
}


// =========================================================
// TEXT CONFIRMATION DETECTION
// =========================================================
//
// UI should ideally send:
//
// confirm: true
//
// But conversational text confirmation is also supported
// for development / Postman testing.
//

function looksLikeConfirmation(
    message,
    action = null
) {

    if (
        typeof message !==
        "string"
    ) {

        return false;

    }


    const value =
        message
            .trim()
            .toLowerCase();


    const confirmations =
        new Set([

            "yes",
            "yes confirm",
            "confirm",
            "confirmed",
            "approve",
            "approved",
            "haan",
            "ha",
            "haan karo",
            "kar do",
            "kardo",

        ]);


    if (confirmations.has(value)) return true;

    const paymentConfirmations = new Set(["pay", "pay now", "yes pay", "confirm payment"]);
    const approvalConfirmations = new Set(["approve intent", "approve authorization", "yes approve"]);

    if (["initiate_payment", "initiate_checkout_payment"].includes(action)) {
        return paymentConfirmations.has(value);
    }

    if (action === "approve_intent") {
        return approvalConfirmations.has(value);
    }

    return false;
}


// =========================================================
// CANCELLATION DETECTION
// =========================================================

function looksLikeCancellation(
    message
) {

    if (
        typeof message !==
        "string"
    ) {

        return false;

    }


    const value =
        message
            .trim()
            .toLowerCase();


    const cancellations =
        new Set([

            "no",
            "cancel",
            "stop",
            "don't",
            "do not",
            "no thanks",
            "decline",
            "reject",
            "nahi",
            "mat karo",

        ]);


    return cancellations.has(
        value
    );
}


// =========================================================
// PROCESS GEMINI RESULT
// =========================================================

async function processGeminiResult({

    session,

    result,

    toolSteps = 0,

    mutationCount = 0,

    clientAction = null,

    policyViolation = null,

}) {

    if (
        toolSteps >
        MAX_TOOL_STEPS
    ) {

        const error =
            new Error(
                "Gemini tool execution limit exceeded"
            );

        error.code =
            "GEMINI_TOOL_LOOP_LIMIT";

        throw error;

    }


    // Always persist latest Gemini history.
    session.history =
        result.history ||
        session.history;


    touchSession(
        session
    );


    // =====================================================
    // NORMAL TEXT
    // =====================================================

    if (
        result.type ===
        "text"
    ) {

        return {

            session_id:
                session.id,

            type:
                "message",

            message:
                result.text ||
                "I could not generate a response.",

            policy_violation:
                policyViolation,

            action:
                clientAction,

        };

    }


    // =====================================================
    // FUNCTION CALL
    // =====================================================

    if (
        result.type !==
        "function_call"
    ) {

        const error =
            new Error(
                "Unsupported Gemini response type"
            );

        error.code =
            "INVALID_GEMINI_RESPONSE";

        throw error;

    }


    const functionCall =
        result.call;


    // =====================================================
    // RESOLVE TOOL CALL AGAINST TRUSTED SESSION STATE
    // =====================================================

    const resolvedFunctionCall =
        resolveToolCallForSession(
            functionCall,
            session
        );


    // =====================================================
    // EXPLICIT CONFIRMATION GATE
    // =====================================================

    if (
        CONFIRMATION_REQUIRED_TOOLS.has(
            resolvedFunctionCall.name
        )
    ) {

        const confirmation =
            await buildConfirmation(
                resolvedFunctionCall
            );


        session.pendingConfirmation = {

            source:
                "gemini_tool",

            call:
                resolvedFunctionCall,

            history:
                result.history,

            confirmation,

        };


        touchSession(
            session
        );


        return {

            session_id:
                session.id,

            type:
                "confirmation_required",

            message:
                confirmation.message,

            confirmation,

            action:
                null,

        };

    }


    // =====================================================
    // PREVENT MULTIPLE MUTATIONS IN ONE USER TURN
    // =====================================================
    //
    // Example:
    //
    // create_intent
    //     ↓
    // automatically create_cart
    //
    // We do not want financial state transitions chained
    // aggressively without user interaction.
    //

    if (
        mutationCount >= 1 &&
        MUTATING_TOOLS.has(
            resolvedFunctionCall.name
        )
    ) {

        const confirmation =
            await buildConfirmation(
                resolvedFunctionCall
            );


        session.pendingConfirmation = {

            call:
                resolvedFunctionCall,

            history:
                result.history,

            confirmation,

        };


        return {

            session_id:
                session.id,

            type:
                "confirmation_required",

            message:
                confirmation.message,

            confirmation,

            action:
                null,

        };

    }


    // =====================================================
    // EXECUTE TOOL
    // =====================================================

    const toolResult =
        await executeToolSafely(
            resolvedFunctionCall
        );


    const nextClientAction =

        extractClientAction(
            resolvedFunctionCall,
            toolResult
        ) ||

        clientAction;


    updateSessionState(
        session,
        resolvedFunctionCall,
        toolResult
    );


    // =====================================================
    // INTENT APPROVAL GATE
    // =====================================================
    //
    // A newly-created Intent is always pending. Approval is
    // therefore a deterministic backend workflow step, not a
    // decision that needs another Gemini inference.
    //
    if (
        ["create_intent", "create_checkout_intent"].includes(functionCall.name) &&
        toolResult.success
    ) {

        const intent =
            toolResult.data;


        const approvalCall = {

            id:
                null,

            name:
                "approve_intent",

            args: {

                intent_id:
                    intent.id,

            },

        };


const confirmation =
            await buildConfirmation(
                approvalCall
            );


        const historyWithIntentResult =
            appendFunctionResultToHistory(
                result.history,
                functionCall,
                toolResult
            );


        session.history =
            historyWithIntentResult;


        session.pendingConfirmation = {

            call:
                approvalCall,

            history:
                appendFunctionCallToHistory(
                    historyWithIntentResult,
                    approvalCall
                ),

            confirmation,

        };


        touchSession(
            session
        );


        return {

            session_id:
                session.id,

            type:
                "confirmation_required",

            message:
                `Intent created for "${intent.scope}" with a maximum authorization of ${formatMoney(
                    intent.max_amount,
                    intent.currency
                )}. Do you approve this authorization?`,

            confirmation,

            action:
                null,

        };

    }


    // =====================================================
    // GET TRACE — GROUNDED EXPLANATION PATH
    // =====================================================

    if (
        resolvedFunctionCall.name ===
        "get_trace"
    ) {
        // ---------------------------------------------
        // Tool failed
        // ---------------------------------------------

        if (
            !toolResult.success
        ) {

            const nextResult =
                await sendFunctionResult(

                    result.history,

                    resolvedFunctionCall,

                    toolResult

                );


            return processGeminiResult({

                session,

                result:
                    nextResult,

                toolSteps:
                    toolSteps + 1,

                mutationCount,

                clientAction:
                    null,

            });

        }


        // ---------------------------------------------
        // Compact trusted data for Gemini
        // ---------------------------------------------

        const traceContext =
            buildTraceContextForGemini(
                toolResult.data
            );


        const groundedResult = {

            success:
                true,

            data:
                traceContext,

        };


        // =================================================
        // IMPORTANT:
        //
        // Unlike create_intent/create_cart/initiate_payment,
        // we WANT Gemini #2 here.
        //
        // Gemini takes authoritative trace data and explains
        // it naturally to the user.
        // =================================================

        const nextResult =
            await sendFunctionResult(

                result.history,

                resolvedFunctionCall,

                groundedResult

            );


        return processGeminiResult({

            session,

            result:
                nextResult,

            toolSteps:
                toolSteps + 1,

            mutationCount,

            clientAction:
                null,

        });

    }


    const fastMessage =
        buildFastToolResponse(
            resolvedFunctionCall,
            toolResult
        );


    if (fastMessage) {

        session.history =
            appendFunctionResultToHistory(
                result.history,
                resolvedFunctionCall,
                toolResult
            );


        touchSession(
            session
        );


        return {

            session_id:
                session.id,

            type:
                "message",

            message:
                fastMessage,

            data:
                resolvedFunctionCall.name ===
                "create_cart"
                    ? {

                        cart_id:
                            toolResult.data.id,

                        trace_id:
                            toolResult.data.trace_id,

                        amount:
                            toolResult.data.amount,

                        currency:
                            toolResult.data.currency,

                        status:
                            toolResult.data.status,

                        remaining_amount:
                            toolResult.data.cap_validation.remaining_after ??
                            toolResult.data.cap_validation.remaining_amount,

                    }
                    : undefined,

            action:
                nextClientAction,

        };

    }


    const nextMutationCount =

        MUTATING_TOOLS.has(
            resolvedFunctionCall.name
        )

            ? mutationCount + 1

            : mutationCount;


    const nextPolicyViolation =
        policyViolation ||
        buildPolicyViolation(
            toolResult
        );


    // =====================================================
    // SEND RESULT BACK TO GEMINI
    // =====================================================

    const nextResult =
        await sendFunctionResult(

            result.history,

            resolvedFunctionCall,

            toolResult

        );


    return processGeminiResult({

        session,

        result:
            nextResult,

        toolSteps:
            toolSteps + 1,

        mutationCount:
            nextMutationCount,

        clientAction:
            nextClientAction,

        policyViolation:
            nextPolicyViolation,

    });

}


// =========================================================
// EXECUTE PENDING CONFIRMATION
// =========================================================

async function executePendingConfirmation(
    session
) {

    const pending =
        session.pendingConfirmation;


    if (!pending) {

        const error =
            new Error(
                "There is no pending action to confirm"
            );

        error.code =
            "NO_PENDING_CONFIRMATION";

        throw error;

    }


    // Clear BEFORE execution so retries do not accidentally
    // execute the same confirmed action repeatedly.
    session.pendingConfirmation =
        null;


    const toolResult =
        await executeToolSafely(
            pending.call
        );


    const clientAction =
        extractClientAction(

            pending.call,

            toolResult

        );


updateSessionState(
        session,
        pending.call,
        toolResult
    );


    // =========================================================
    // INITIATE PAYMENT FAST PATH
    // =========================================================
    //
    // Successful payment initiation returns a Razorpay checkout
    // action directly. No second Gemini inference needed.
    // =========================================================

    if (
        ["initiate_payment", "initiate_checkout_payment"].includes(
            pending.call.name
        )
    ) {

        // The payment fast path skips a second Gemini call, but
        // Gemini history must still immediately close the original
        // FunctionCall before the next user message is sent.
        session.history =
            appendFunctionResultToHistory(
                pending.history,
                pending.call,
                toolResult
            );

        if (
            !toolResult.success
        ) {

            return {

                session_id:
                    session.id,

                type:
                    "message",

                message:
                    toolResult.error?.message ||
                    "Payment could not be initiated.",

                error:
                    toolResult.error,

                action:
                    null,

            };

        }


        const payment =
            toolResult.data;


        touchSession(
            session
        );


        return {

            session_id:
                session.id,

            type:
                "action",

            message:
                `Payment of ${formatMoney(
                    payment.amount,
                    payment.currency
                )} is ready for secure checkout.`,

            data: {

                payment_id:
                    payment.id,

                cart_id:
                    payment.cart_id,

                trace_id:
                    payment.trace_id,

                amount:
                    payment.amount,

                currency:
                    payment.currency,

                status:
                    payment.status,

            },

            action:
                clientAction,

        };

    }


    const fastMessage =
        buildFastToolResponse(
            pending.call,
            toolResult
        );


    if (fastMessage) {

        session.history =
            appendFunctionResultToHistory(
                pending.history,
                pending.call,
                toolResult
            );


        touchSession(
            session
        );


        return {

            session_id:
                session.id,

            type:
                "message",

            message:
                fastMessage,

            data:
                pending.call.name ===
                "create_cart"
                    ? {

                        cart_id:
                            toolResult.data.id,

                        trace_id:
                            toolResult.data.trace_id,

                        amount:
                            toolResult.data.amount,

                        currency:
                            toolResult.data.currency,

                        status:
                            toolResult.data.status,

                        remaining_amount:
                            toolResult.data.cap_validation.remaining_after ??
                            toolResult.data.cap_validation.remaining_amount,

                    }
                    : undefined,

            action:
                clientAction,

        };

    }


    const nextResult =
        await sendFunctionResult(

            pending.history,

            pending.call,

            toolResult

        );


    return processGeminiResult({

        session,

        result:
            nextResult,

        toolSteps:
            1,

        mutationCount:
            MUTATING_TOOLS.has(
                pending.call.name
            )
                ? 1
                : 0,

        clientAction,

        policyViolation:
            buildPolicyViolation(toolResult),

    });

}


// =========================================================
// CANCEL PENDING CONFIRMATION
// =========================================================

async function cancelPendingConfirmation(
    session
) {

    const pending =
        session.pendingConfirmation;


    if (!pending) {

        return {

            session_id:
                session.id,

            type:
                "message",

            message:
                "There is no pending action to cancel.",

            action:
                null,

        };

    }


    session.pendingConfirmation =
        null;


    // =========================================================
    // INITIATE PAYMENT CANCELLATION FAST PATH
    // =========================================================

    if (
        ["initiate_payment", "initiate_checkout_payment"].includes(
            pending.call.name
        )
    ) {

        // Cancellation also closes Gemini's pending FunctionCall.
        // No payment service or Razorpay call is made here.
        const cancellationResult = {

            success:
                false,

            tool:
                pending.call.name,

            error: {

                code:
                    "USER_CANCELLED",

                message:
                    "User cancelled the payment.",

            },

        };


        session.history =
            appendFunctionResultToHistory(
                pending.history,
                pending.call,
                cancellationResult
            );

        touchSession(
            session
        );


        return {

            session_id:
                session.id,

            type:
                "message",

            message:
                "Payment cancelled. No payment was initiated.",

            action:
                null,

        };

    }


    const cancelledResult = {

        success:
            false,

        tool:
            pending.call.name,

        error: {

            code:
                "USER_CANCELLED",

            message:
                "The user explicitly cancelled this action.",

        },

    };


    const nextResult =
        await sendFunctionResult(

            pending.history,

            pending.call,

            cancelledResult

        );


    return processGeminiResult({

        session,

        result:
            nextResult,

        toolSteps:
            1,

        mutationCount:
            0,

        clientAction:
            null,

    });

}


// =========================================================
// MAIN CHAT HANDLER
// =========================================================

export async function handleChatMessage({

    sessionId = null,

    userMessage = "",

    confirm = false,

    cancel = false,

}) {

    const session =
        getOrCreateSession(
            sessionId
        );


    // =====================================================
    // PENDING ACTION EXISTS
    // =====================================================

    if (
        session.pendingConfirmation
    ) {

        // Explicit UI confirmation
        // OR supported text confirmation.

        if (
            confirm === true ||
            looksLikeConfirmation(
                userMessage,
                session.pendingConfirmation.call?.name
            )
        ) {

            return executePendingConfirmation(
                session
            );

        }


        if (
            cancel === true ||
            looksLikeCancellation(
                userMessage
            )
        ) {

            return cancelPendingConfirmation(
                session
            );

        }


        // Do NOT allow conversation to silently move around
        // an unresolved financial confirmation.

        const pending =
            session
                .pendingConfirmation
                .confirmation;


        return {

            session_id:
                session.id,

            type:
                "confirmation_required",

            message:
                pending.message,

            confirmation:
                pending,

            action:
                null,

        };

    }


    // =====================================================
    // NORMAL CHAT MESSAGE
    // =====================================================

    if (
        typeof userMessage !==
            "string" ||
        userMessage.trim().length ===
            0
    ) {

        const error =
            new Error(
                "message is required"
            );

        error.status = 400;

        error.code =
            "INVALID_CHAT_MESSAGE";

        throw error;

    }

    // This flag applies only to the current user turn and its tool loop.
    // It prevents a failed attachment from being silently replaced by a new
    // checkout Intent when the user said “this/same/existing authorization”.
    session.state.explicit_existing_authorization =
        /\b(this|same|existing|current)\s+authorization\b|\busing\s+(this|the same|my existing)\s+authorization\b/i.test(userMessage);


    const result =
        await runChatTurn(

            session.history,

            userMessage,

            buildAuthorizationContext(session)

        );


    return processGeminiResult({

        session,

        result,

        toolSteps:
            0,

        mutationCount:
            0,

        clientAction:
            null,

    });

}


// =========================================================
// DELETE CHAT SESSION
// =========================================================

export function deleteChatSession(
    sessionId
) {

    if (!sessionId) {

        return false;

    }


    return sessions.delete(
        sessionId
    );
}
