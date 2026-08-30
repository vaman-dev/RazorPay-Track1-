import {
    GoogleGenAI,
    Type,
    FunctionCallingConfigMode,
    ThinkingLevel,
} from "@google/genai";

// =========================================================
// ENVIRONMENT VALIDATION
// =========================================================

if (!process.env.GEMINI_API_KEY) {

    throw new Error(
        "GEMINI_API_KEY is missing from environment variables"
    );

}


// =========================================================
// CLIENT SETUP
// =========================================================

const ai =
    new GoogleGenAI({

        apiKey:
            process.env.GEMINI_API_KEY,

    });


const MODEL =
    process.env.GEMINI_MODEL ||
    "gemini-2.5-flash";


// =========================================================
// SAFE HISTORY WINDOW
// =========================================================
//
// Gemini requires every FunctionResponse to immediately follow
// its matching model FunctionCall. A plain Array.slice() can
// start a request at a FunctionResponse and orphan that call.
// Keep the latency-oriented history window, but only begin it
// at an ordinary user message so tool-call pairs remain intact.
//
function hasFunctionResponse(
    content
) {

    return Boolean(
        content?.parts?.some(
            (part) =>
                Boolean(
                    part.functionResponse
                )
        )
    );

}


function isSafeHistoryBoundary(
    content
) {

    return (
        content?.role === "user" &&
        !hasFunctionResponse(
            content
        )
    );

}


function getSafeHistoryWindow(
    history,
    maxEntries = 6
) {

    const firstCandidate =
        Math.max(
            0,
            history.length - maxEntries
        );


    for (
        let index = firstCandidate;
        index < history.length;
        index += 1
    ) {

        if (
            isSafeHistoryBoundary(
                history[index]
            )
        ) {

            return history.slice(
                index
            );

        }

    }


    // The recent history consists only of a tool-call sequence.
    // Preserve all of it rather than sending an invalid orphaned
    // FunctionResponse to Gemini.
    return history;

}


// =========================================================
// CANONICAL GEMINI HISTORY
// =========================================================
//
// The GenAI SDK accepts either Content[] or Part[] as request input,
// but a conversation cannot mix them. Persist only Content objects:
// { role, parts }. This also normalizes SDK candidate content before it
// becomes session history, so a raw Part can never poison a later turn.

function normalizeHistoryEntry(
    entry,
    fallbackRole = "user"
) {

    if (
        !entry ||
        typeof entry !== "object" ||
        Array.isArray(entry)
    ) {

        const error =
            new Error(
                "Conversation history contains an invalid entry"
            );

        error.code =
            "INVALID_CHAT_HISTORY_ENTRY";

        throw error;

    }


    const parts =
        Array.isArray(entry.parts)
            ? entry.parts
            : [entry];


    const role =
        entry.role === "model" ||
        entry.role === "user"
            ? entry.role
            : fallbackRole;


    return {

        role,

        parts,

    };
}


function normalizeHistory(
    history
) {

    if (
        !Array.isArray(history)
    ) {

        const error =
            new Error(
                "Conversation history must be an array"
            );

        error.code =
            "INVALID_CHAT_HISTORY";

        throw error;

    }


    return history.map(
        (entry) =>
            normalizeHistoryEntry(
                entry,
                entry?.functionCall
                    ? "model"
                    : "user"
            )
    );
}


function assertFunctionCallPrecedesResponse(
    history,
    functionCall
) {

    const previousContent =
        history.at(-1);


    const matchingCallExists =
        previousContent?.role === "model" &&
        previousContent.parts.some(
            (part) =>
                part.functionCall?.name ===
                functionCall.name &&
                (!functionCall.id ||
                    part.functionCall?.id === functionCall.id)
        );


    if (!matchingCallExists) {

        const error =
            new Error(
                "Function response requires its matching model function call"
            );

        error.code =
            "ORPHANED_FUNCTION_RESPONSE";

        throw error;

    }
}


// =========================================================
// SYSTEM INSTRUCTION
// =========================================================
//
// Gemini is NOT the authorization authority.
//
// Gemini:
// - understands user intent
// - proposes tool calls
// - explains backend results
//
// Mandate Ledger:
// - validates authorization
// - enforces spend caps
// - verifies cryptographic integrity
// - creates Razorpay orders
//
// Razorpay:
// - executes payment
//

const SYSTEM_INSTRUCTION = `
You are the conversational interface for Mandate Ledger,
a bounded, gated, auditable payment authorization system.

You help users create and understand:

Intent → Cart → Payment

You are an orchestration and explanation layer.
You are NOT the authorization authority and you do not directly move money.

MANDATORY RULES:

1. Never claim that a payment succeeded, failed, or was captured unless
   a backend tool result explicitly confirms that state.

2. Before requesting create_intent:
   - clearly state the purchase goal,
   - clearly state the maximum authorized spend,
   - clearly state the currency,
   - and obtain confirmation from the user.

3. Never invent an expiration timestamp.
   If the user has not provided or confirmed the validity period needed
   for the Intent, ask for it before requesting create_intent.
   Do not call create_intent with a guessed, default, historical, or placeholder
   valid_until value. No valid_until means ask one short question and make no
   tool call.

4. Never request approve_intent unless the user has explicitly approved
   the pending Intent in the conversation.

5. Before requesting initiate_payment:
   - show the exact Cart amount,
   - show the currency,
   - explain that payment execution will begin,
   - and obtain explicit user confirmation.

6. Never infer payment confirmation from vague messages.
   The user must clearly confirm the payment action.

7. When explaining whether a purchase is authorized, use actual values
   returned by Mandate Ledger tools, including:
   - max_amount
   - requested_amount
   - remaining_amount
   - status
   - chain_valid

8. Never invent authorization values, payment states, hashes,
   signatures, trace information, or Razorpay identifiers.

9. If a backend tool returns an error such as:
   - CAP_EXCEEDED
   - CART_TOTAL_MISMATCH
   - INTENT_ALREADY_COMMITTED
   - INVALID_WEBHOOK_SIGNATURE
   - integrity verification failure
   explain the failure clearly and do not attempt to bypass it.

10. A failed backend authorization check is final for that attempted
    action. You may suggest a legitimate alternative, such as creating
    a new Intent with different user-approved limits.

11. Never call Razorpay directly.

12. Never claim that you personally approved an Intent.
    Intent approval belongs to the user and is enforced by Mandate Ledger.

13. A chain should only be described as cryptographically verified when
    trace data explicitly reports chain_valid = true.

14. Use INR unless another currency has explicitly been provided or
    confirmed by the user.

15. Monetary values used by tools are represented in the smallest
   currency unit. For INR this means paise:
   ₹1 = 100 paise.

16. Intent usage mode is a user authorization choice:
   - use single_use for one committed purchase (the default),
   - use reusable_budget only when the user explicitly asks to authorize
     multiple purchases under one cumulative budget.
   Never silently convert an existing single-use Intent into reusable_budget.

17. For catalog purchases, use search_products and create_checkout_preview.
    Never invent a catalog product price, category, merchant, or product ID.
    Use create_checkout_intent / attach_checkout_intent and
    commit_checkout_cart for the trusted commerce workflow.

18. Every Cart is immutable and represents only the newly requested purchase.
    For a reusable Intent, never include earlier Cart items or their amounts in
    a later Cart. The backend alone calculates cumulative committed and
    remaining amounts.

19. EXISTING AUTHORIZATION RULE: When the user says “this authorization”,
    “same authorization”, “existing authorization”, or equivalent, resolve
    and attempt to attach that exact approved Intent. Never create a new
    checkout Intent as a fallback. If attachment fails, report the backend
    rejection and offer a separate new-authorization request.

CART POLICY AUTHORITY RULE:

- When the user explicitly asks to add items to a cart, create a cart,
  or commit a purchase, invoke create_cart with the requested item data.

- Do not approve, reject, or pre-filter a Cart by comparing it with an
  Intent spend cap yourself. Mandate Ledger backend validation is the
  authoritative source for the allow or block decision.

- If create_cart returns CAP_EXCEEDED, explain the backend rejection
  clearly, do not initiate payment, and do not automatically increase
  the authorization.

TRACE AND PAYMENT TRUTH RULES:

- When the user asks whether a payment succeeded, failed, is pending,
  was authorized, or why it was allowed/blocked, use get_trace.

- Never claim that payment succeeded based only on:
  browser checkout,
  previous conversation,
  initiate_payment result,
  Razorpay order creation,
  or client-side success UI.

- Payment is successfully completed only when the authoritative
  trace reports payment status "captured".

- A payment with status "created" or "pending" is NOT captured yet.

- When explaining authorization, use actual trace values such as:
  Intent max_amount,
  Cart amount,
  remaining amount,
  statuses,
  and integrity.chain_valid.

- Only say that the cryptographic mandate chain is verified when
  integrity.chain_valid is true.

- Never invent trace values.
`;


// =========================================================
// TOOL DECLARATIONS
// =========================================================
//
// These are declarations only.
//
// geminiService.js DOES NOT execute these functions.
//
// Later:
//
// chatOrchestrator.js
//
// will map:
//
// create_intent
//      → createIntent()
//
// approve_intent
//      → approveIntent()
//
// create_cart
//      → createCart()
//
// get_trace
//      → getTraceById()
//
// initiate_payment
//      → createPaymentForCart()
//

const tools = [

    {

        functionDeclarations: [

            // =================================================
            // CREATE INTENT
            // =================================================

            {

                name:
                    "create_intent",

                description:
                    "Create a bounded Intent Mandate describing what the user is allowing, the maximum authorized amount, currency, and expiration time. Use only after those values have been confirmed by the user.",

                parameters: {

                    type:
                        Type.OBJECT,

                    properties: {

                        scope: {

                            type:
                                Type.STRING,

                            description:
                                "Plain-language authorization scope, for example 'buy running shoes'.",

                        },


                        max_amount: {

                            type:
                                Type.INTEGER,

                            minimum:
                                1,

                            description:
                                "Maximum amount the user authorizes, expressed in the smallest currency unit. For INR use paise.",

                        },


                        currency: {

                            type:
                                Type.STRING,

                            description:
                                "Three-letter currency code such as INR.",

                        },


                        valid_until: {

                            type:
                                Type.STRING,

                            format:
                                "date-time",

                            description:
                                "ISO 8601 timestamp representing when this authorization expires.",

                        },

                        usage_mode: {

                            type:
                                Type.STRING,

                            enum: [
                                "single_use",
                                "reusable_budget",
                            ],

                            description:
                                "single_use for one committed purchase; reusable_budget only when the user explicitly authorizes multiple purchases under the same cumulative limit.",

                        },

                        policy: {

                            type: Type.OBJECT,

                            description:
                                "Structured, enforceable authorization policy. Provide it whenever the user limits category, merchant, or product.",

                            properties: {
                                categories: { type: Type.ARRAY, items: { type: Type.STRING } },
                                merchant_ids: { type: Type.ARRAY, items: { type: Type.STRING } },
                                product_ids: { type: Type.ARRAY, items: { type: Type.STRING } },
                            },

                        },

                    },

                    required: [

                        "scope",
                        "max_amount",
                        "currency",
                        "valid_until",

                    ],

                },

            },


            // =================================================
            // APPROVE INTENT
            // =================================================

            {

                name:
                    "approve_intent",

                description:
                    "Approve an existing pending Intent Mandate. Request this only after the user explicitly confirms that exact Intent.",

                parameters: {

                    type:
                        Type.OBJECT,

                    properties: {

                        intent_id: {

                            type:
                                Type.STRING,

                            description:
                                "Mandate Ledger Intent identifier beginning with int_.",

                        },

                    },

                    required: [

                        "intent_id",

                    ],

                },

            },


            // =================================================
            // CREATE CART
            // =================================================

            {

                name:
                    "create_cart",

                description:
                    "Create a Cart Mandate for a finalized proposed purchase under an approved Intent. Mandate Ledger independently validates line-item arithmetic, spend limits, Intent state, and cryptographic integrity.",

                parameters: {

                    type:
                        Type.OBJECT,

                    properties: {

                        intent_id: {

                            type:
                                Type.STRING,

                            description:
                                "Approved Intent identifier that authorizes this Cart.",

                        },


                        merchant: {

                            type:
                                Type.STRING,

                            description:
                                "Merchant or seller for this purchase.",

                        },


                        items: {

                            type:
                                Type.ARRAY,

                            description:
                                "Finalized products included in this Cart.",

                            items: {

                                type:
                                    Type.OBJECT,

                                properties: {

                                    name: {

                                        type:
                                            Type.STRING,

                                        description:
                                            "Product name.",

                                    },


                                    quantity: {

                                        type:
                                            Type.INTEGER,

                                        minimum:
                                            1,

                                        description:
                                            "Positive integer quantity.",

                                    },


                                    unit_amount: {

                                        type:
                                            Type.INTEGER,

                                        minimum:
                                            1,

                                        description:
                                            "Price per unit in the smallest currency unit. For INR use paise.",

                                    },

                                },

                                required: [

                                    "name",
                                    "quantity",
                                    "unit_amount",

                                ],

                            },

                        },


                        amount: {

                            type:
                                Type.INTEGER,

                            minimum:
                                1,

                            description:
                                "Total Cart amount in the smallest currency unit. It must exactly equal the sum of quantity × unit_amount across all items. Mandate Ledger verifies this independently.",

                        },


                        currency: {

                            type:
                                Type.STRING,

                            description:
                                "Three-letter currency code such as INR.",

                        },

                    },

                    required: [

                        "intent_id",
                        "merchant",
                        "items",
                        "amount",
                        "currency",

                    ],

                },

            },


            // =================================================
            // TRUSTED COMMERCE TOOLS
            // =================================================

            {
                name: "search_products",
                description: "Search the trusted product catalog. Use this before creating a catalog purchase; never invent catalog product data.",
                parameters: {
                    type: Type.OBJECT,
                    properties: {
                        query: { type: Type.STRING, description: "Optional product search text." },
                        category: { type: Type.STRING, description: "Optional exact catalog category, for example Footwear." },
                    },
                },
            },

            {
                name: "create_checkout_preview",
                description: "Create an immutable, server-priced trusted checkout snapshot from catalog product IDs. Ignore any price supplied by the user.",
                parameters: {
                    type: Type.OBJECT,
                    properties: {
                        items: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    product_id: { type: Type.STRING },
                                    quantity: { type: Type.INTEGER, minimum: 1 },
                                },
                                required: ["product_id", "quantity"],
                            },
                        },
                    },
                    required: ["items"],
                },
            },

            {
                name: "create_checkout_intent",
                description: "Create a new, scope-bound Intent from a trusted checkout only when the user explicitly asks for a new authorization. The backend derives policy categories and currency from the checkout.",
                parameters: {
                    type: Type.OBJECT,
                    properties: {
                        checkout_id: { type: Type.STRING },
                        max_amount: { type: Type.INTEGER, minimum: 1, description: "Optional cumulative cap in paise." },
                        valid_until: { type: Type.STRING, format: "date-time" },
                        usage_mode: { type: Type.STRING, enum: ["single_use", "reusable_budget"], description: "The explicitly requested authorization mode." },
                    },
                    required: ["checkout_id", "valid_until", "usage_mode"],
                },
            },

            {
                name: "attach_checkout_intent",
                description: "Attach an approved existing Intent to a trusted checkout. A single_use Intent can attach once; reusable_budget can attach repeatedly within its remaining budget.",
                parameters: {
                    type: Type.OBJECT,
                    properties: { checkout_id: { type: Type.STRING }, intent_id: { type: Type.STRING } },
                    required: ["checkout_id", "intent_id"],
                },
            },

            {
                name: "commit_checkout_cart",
                description: "Commit exactly this trusted checkout as one new Cart. It must contain only the new purchase, never earlier Cart items.",
                parameters: {
                    type: Type.OBJECT,
                    properties: { checkout_id: { type: Type.STRING } },
                    required: ["checkout_id"],
                },
            },

            {
                name: "initiate_checkout_payment",
                description: "Initiate payment for an approved trusted checkout only after explicit payment confirmation.",
                parameters: {
                    type: Type.OBJECT,
                    properties: { checkout_id: { type: Type.STRING } },
                    required: ["checkout_id"],
                },
            },


            // =================================================
            // GET TRACE
            // =================================================

            {

                name:
                    "get_trace",

                description:
                    "Retrieve the complete Mandate Ledger transaction trace including Intent, Cart, Payment, audit timeline, parent-hash linkage, and cryptographic integrity results. Use this to provide grounded explanations.",

                parameters: {

                    type:
                        Type.OBJECT,

                    properties: {

                        trace_id: {

                            type:
                                Type.STRING,

                            description:
                                "Transaction trace identifier beginning with trace_.",

                        },

                    },

                    required: [

                        "trace_id",

                    ],

                },

            },


            // =================================================
            // INITIATE PAYMENT
            // =================================================

            {

                name:
                    "initiate_payment",

                description:
                    "Initiate Razorpay payment processing for an approved Cart. Only request this tool after the exact Cart amount and currency have been shown and the user has explicitly confirmed payment.",

                parameters: {

                    type:
                        Type.OBJECT,

                    properties: {

                        cart_id: {

                            type:
                                Type.STRING,

                            description:
                                "Approved Cart Mandate identifier beginning with cart_.",

                        },

                    },

                    required: [

                        "cart_id",

                    ],

                },

            },

        ],

    },

];


// =========================================================
// RESPONSE PARSER
// =========================================================
//
// Converts Gemini response into one of:
//
// {
//     type: "text"
// }
//
// OR
//
// {
//     type: "function_call"
// }
//
// We deliberately allow only ONE financial function call
// per model step.
//
// This prevents:
//
// create_intent
// approve_intent
// create_cart
// initiate_payment
//
// from being chained automatically in one response.
//

function parseGeminiResponse(
    response,
    previousContents
) {

    const candidate =
        response.candidates?.[0];


    if (
        !candidate ||
        !candidate.content
    ) {

        return {

            type:
                "text",

            text:
                "",

            history:
                normalizeHistory(
                    previousContents
                ),

        };

    }


    const modelContent =
        normalizeHistoryEntry(
            candidate.content,
            "model"
        );


    const parts =
        modelContent.parts || [];


    const functionCallParts =
        parts.filter(
            (part) =>
                Boolean(
                    part.functionCall
                )
        );


    // =====================================================
    // SECURITY / ORCHESTRATION RULE
    // =====================================================
    //
    // Only one application tool may be requested at a time.
    //

    if (
        functionCallParts.length >
        1
    ) {

        const error =
            new Error(
                "Gemini requested multiple Mandate Ledger actions in one turn"
            );

        error.code =
            "MULTIPLE_TOOL_CALLS_NOT_ALLOWED";

        throw error;

    }


    const updatedHistory = [

        ...normalizeHistory(
            previousContents
        ),

        modelContent,

    ];


    // =====================================================
    // FUNCTION CALL
    // =====================================================

    if (
        functionCallParts.length ===
        1
    ) {

        const functionCall =
            functionCallParts[0]
                .functionCall;


        return {

            type:
                "function_call",


            call: {

                id:
                    functionCall.id ||
                    null,

                name:
                    functionCall.name,

                args:
                    functionCall.args ||
                    {},

            },


            // Contains:
            //
            // history
            // user message
            // model function call
            //
            // sendFunctionResult() receives this.

            history:
                updatedHistory,

        };

    }


    // =====================================================
    // TEXT RESPONSE
    // =====================================================

    const text =

        parts

            .filter(
                (part) =>
                    typeof part.text ===
                    "string"
            )

            .map(
                (part) =>
                    part.text
            )

            .join("");


    return {

        type:
            "text",

        text,

        history:
            updatedHistory,

    };

}


// =========================================================
// RUN CHAT TURN
// =========================================================

/**
 * Sends a normal user message to Gemini.
 *
 * This function:
 *
 * - sends conversation history
 * - provides Mandate Ledger tools
 * - returns either text or ONE proposed tool call
 *
 * It NEVER executes business logic.
 *
 *
 * @param {Array} history
 * Gemini Content[] history.
 *
 * @param {string} userMessage
 * New user message.
 */

async function runChatTurn(
    history = [],
    userMessage,
    trustedSessionContext = null
) {

    if (
        typeof userMessage !==
            "string" ||
        userMessage.trim().length ===
            0
    ) {

        const error =
            new Error(
                "userMessage is required"
            );

        error.code =
            "INVALID_CHAT_MESSAGE";

        throw error;

    }


    if (
        !Array.isArray(
            history
        )
    ) {

        const error =
            new Error(
                "Conversation history must be an array"
            );

        error.code =
            "INVALID_CHAT_HISTORY";

        throw error;

    }


    const userContent = {

        role:
            "user",

        parts: [

            {

                text:
                    userMessage.trim(),

            },

            ...(trustedSessionContext
                ? [{
                    text: `AUTHORITATIVE SESSION STATE (not user-provided; do not contradict it): ${JSON.stringify(trustedSessionContext)}. Reuse a compatible approved authorization when the user asks to use an existing authorization. Do not ask again for its maximum amount, currency, or validity period.`,
                }]
                : []),

        ],

    };


    const canonicalHistory =
        normalizeHistory(
            history
        );


    const trimmedHistory =
        getSafeHistoryWindow(
            canonicalHistory
        );

    const contents = [

        ...trimmedHistory,

        userContent,

    ];


    const start =
        performance.now();

    const response =
        await ai.models.generateContent({

            model:
                MODEL,

            contents,

            config: {

                systemInstruction:
                    SYSTEM_INSTRUCTION,

                tools,

                // Chat replies and tool calls are intentionally concise.
                // Keep generation bounded so the orchestration layer does
                // not wait for unnecessarily long model responses.
                maxOutputTokens: 512,

                thinkingConfig: {
                    thinkingLevel: ThinkingLevel.MINIMAL,
                },

                // VALIDATED allows normal text OR schema-valid
                // function calls.
                //
                // Backend remains authoritative either way.

                toolConfig: {

                    functionCallingConfig: {

                        mode:
                            FunctionCallingConfigMode
                                .VALIDATED,

                    },

                },

            },

        });

    console.log(
        `[Gemini] runChatTurn: ${
            (
                performance.now() -
                start
            ).toFixed(0)
        } ms`
    );


    return parseGeminiResponse(
        response,
        contents
    );

}


// =========================================================
// NORMALIZE FUNCTION RESULT
// =========================================================
//
// Gemini FunctionResponse expects an object.
//
// Successful service example:
//
// {
//     output: {...}
// }
//
// Failed service example:
//
// {
//     error: {
//         code: "CAP_EXCEEDED",
//         message: "..."
//     }
// }
//

function normalizeFunctionResult(
    functionResult
) {

    if (
        functionResult !== null &&
        typeof functionResult ===
            "object" &&
        !Array.isArray(
            functionResult
        )
    ) {

        return functionResult;

    }


    return {

        output:
            functionResult,

    };

}


// =========================================================
// SEND FUNCTION RESULT
// =========================================================

/**
 * Sends an executed backend tool result back to Gemini.
 *
 * IMPORTANT:
 *
 * history MUST already contain the model's FunctionCall.
 *
 * runChatTurn() guarantees this by returning:
 *
 * result.history
 *
 *
 * Example:
 *
 * const turn =
 *     await runChatTurn(
 *         history,
 *         message
 *     );
 *
 * if (
 *     turn.type ===
 *     "function_call"
 * ) {
 *
 *     const result =
 *         executeTool(
 *             turn.call
 *         );
 *
 *     const final =
 *         await sendFunctionResult(
 *             turn.history,
 *             turn.call,
 *             result
 *         );
 * }
 */

async function sendFunctionResult(

    history,

    functionCall,

    functionResult

) {

    if (
        !Array.isArray(
            history
        )
    ) {

        const error =
            new Error(
                "Conversation history must be an array"
            );

        error.code =
            "INVALID_CHAT_HISTORY";

        throw error;

    }


    if (
        !functionCall ||
        !functionCall.name
    ) {

        const error =
            new Error(
                "Function call information is required"
            );

        error.code =
            "INVALID_FUNCTION_CALL";

        throw error;

    }


    const functionResponse = {

        name:
            functionCall.name,

        response:
            normalizeFunctionResult(
                functionResult
            ),

    };


    // -----------------------------------------------------
    // FunctionCall.id is optional in Gemini.
    //
    // If Gemini supplies it, send the SAME id back.
    // -----------------------------------------------------

    if (
        functionCall.id
    ) {

        functionResponse.id =
            functionCall.id;

    }


    const toolResultContent = {

        role:
            "user",

        parts: [

            {

                functionResponse,

            },

        ],

    };


    const canonicalHistory =
        normalizeHistory(
            history
        );


    assertFunctionCallPrecedesResponse(
        canonicalHistory,
        functionCall
    );


    const trimmedHistory =
        getSafeHistoryWindow(
            canonicalHistory
        );

    const contents = [

        ...trimmedHistory,

        toolResultContent,

    ];


    const start =
        performance.now();

    const response =
        await ai.models.generateContent({

            model:
                MODEL,

            contents,

            config: {

                systemInstruction:
                    SYSTEM_INSTRUCTION,

                tools,

                // Function-result follow-ups use the same bounded,
                // low-latency generation settings as normal chat turns.
                maxOutputTokens: 512,

                thinkingConfig: {
                    thinkingLevel: ThinkingLevel.MINIMAL,
                },

                toolConfig: {

                    functionCallingConfig: {

                        mode:
                            FunctionCallingConfigMode
                                .VALIDATED,

                    },

                },

            },

        });

    console.log(
        `[Gemini] sendFunctionResult: ${
            (
                performance.now() -
                start
            ).toFixed(0)
        } ms`
    );


    return parseGeminiResponse(
        response,
        contents
    );

}


// =========================================================
// EXPORTS
// =========================================================

export {

    runChatTurn,

    sendFunctionResult,

    tools,

};
