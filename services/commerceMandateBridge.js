import { approveIntent, createCart, createIntent, getIntentById } from "./consentManager.js";
import { createPaymentForCart } from "./paymentService.js";
import { getCheckoutSession, updateCheckoutSession } from "./checkoutSessionService.js";
import { validateIntentScope } from "./scopePolicyService.js";
import { writeAuditEvent } from "./ledger.js";
import { getIntentBudgetState } from "./spendCapController.js";

function checkoutScope(checkout) {
  const itemNames = checkout.items.map((item) => item.name).join(", ");
  return `Purchase ${itemNames} from ${checkout.merchant}`;
}

function mandateCartInput(checkout, intentId) {
  return {
    intent_id: intentId,
    merchant: checkout.merchant,
    items: checkout.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unit_amount: item.unit_amount,
    })),
    amount: checkout.amount,
    currency: checkout.currency,
  };
}

export function createCommerceIntent(checkoutId, validUntil, requestedMaxAmount = null, usageMode = "reusable_budget") {
  const checkout = getCheckoutSession(checkoutId);

  if (checkout.intent_id) {
    const error = new Error("An authorization has already been created for this checkout.");
    error.status = 409;
    error.code = "CHECKOUT_INTENT_ALREADY_CREATED";
    throw error;
  }

  // The checkout amount is always server-derived. A user may explicitly set a
  // different authorization cap, but it is never a browser-controlled price.
  const maxAmount = requestedMaxAmount ?? checkout.amount;

  if (!Number.isInteger(maxAmount) || maxAmount <= 0) {
    const error = new Error("max_amount must be a positive integer in paise");
    error.status = 400;
    error.code = "INVALID_MAX_AMOUNT";
    throw error;
  }

  if (!["single_use", "reusable_budget"].includes(usageMode)) {
    const error = new Error("usage_mode must be single_use or reusable_budget");
    error.status = 400;
    error.code = "INVALID_USAGE_MODE";
    throw error;
  }

  const intent = createIntent({
    scope: checkoutScope(checkout),
    max_amount: maxAmount,
    currency: checkout.currency,
    valid_until: validUntil,
    usage_mode: usageMode,
    policy: {
      categories: [...new Set(checkout.items.map((item) => item.category).filter(Boolean))],
    },
  });

  updateCheckoutSession(checkoutId, {
    intent_id: intent.id,
    trace_id: intent.trace_id,
  });

  return intent;
}

export function attachCommerceIntent(checkoutId, intentId) {
  const checkout = getCheckoutSession(checkoutId);
  if (checkout.intent_id) {
    const error = new Error("This checkout already has an authorization selected.");
    error.status = 409;
    error.code = "CHECKOUT_INTENT_ALREADY_CREATED";
    throw error;
  }
  const intent = getIntentById(intentId);
  if (!intent) {
    const error = new Error("Intent not found");
    error.status = 404;
    error.code = "INTENT_NOT_FOUND";
    throw error;
  }
  if (intent.status !== "approved") {
    const error = new Error("Only an explicitly approved Intent can be attached.");
    error.status = 409;
    error.code = "INTENT_NOT_APPROVED";
    throw error;
  }
  if (new Date(intent.valid_until).getTime() <= Date.now()) {
    const error = new Error("The Intent has expired.");
    error.status = 409;
    error.code = "INTENT_EXPIRED";
    throw error;
  }
  if (intent.currency !== checkout.currency) {
    const error = new Error("Intent currency does not match the trusted checkout currency.");
    error.status = 422;
    error.code = "CURRENCY_MISMATCH";
    throw error;
  }
  try {
    validateIntentScope(intent, checkout);
  } catch (error) {
    if (error.code === "SCOPE_NOT_ALLOWED") {
      writeAuditEvent({
        traceId: intent.trace_id,
        entityType: "intent",
        entityId: intent.id,
        event: "scope_rejected",
        previousStatus: intent.status,
        newStatus: intent.status,
        reasonCode: "SCOPE_NOT_ALLOWED",
        detail: "Trusted commerce checkout was outside the authorized Intent scope.",
        metadata: error.details,
      });
      error.details = { ...error.details, trace_id: intent.trace_id, intent_id: intent.id };
    }
    throw error;
  }
  const budget = getIntentBudgetState(intent.id, intent);
  if ((intent.usage_mode || "single_use") === "single_use" && budget.committed_amount > 0) {
    const error = new Error("Single-use Intent has already been committed.");
    error.status = 409;
    error.code = "INTENT_ALREADY_COMMITTED";
    error.details = { ...budget, intent_id: intent.id, usage_mode: "single_use" };
    throw error;
  }
  if (checkout.amount > budget.remaining_amount) {
    const error = new Error("Checkout amount exceeds the remaining authorization.");
    error.status = 422;
    error.code = "CAP_EXCEEDED";
    error.details = {
      ...budget,
      requested_amount: checkout.amount,
      excess_amount: checkout.amount - budget.remaining_amount,
    };
    throw error;
  }
  updateCheckoutSession(checkoutId, { intent_id: intent.id, trace_id: intent.trace_id });
  return intent;
}

export function approveCommerceIntent(checkoutId) {
  const checkout = getCheckoutSession(checkoutId);

  if (!checkout.intent_id) {
    const error = new Error("Create an authorization before approving it.");
    error.status = 409;
    error.code = "CHECKOUT_INTENT_REQUIRED";
    throw error;
  }

  const selectedIntent = getIntentById(checkout.intent_id);
  const intent = selectedIntent?.status === "pending" ? approveIntent(checkout.intent_id) : selectedIntent;

  if (!intent) {
    const error = new Error("Intent not found");
    error.status = 404;
    error.code = "INTENT_NOT_FOUND";
    throw error;
  }

  return intent;
}

export function commitCommerceCart(checkoutId) {
  const checkout = getCheckoutSession(checkoutId);
  if (!checkout.intent_id) {
    const error = new Error("Create or attach an authorization before committing the Cart.");
    error.status = 409;
    error.code = "CHECKOUT_INTENT_REQUIRED";
    throw error;
  }
  if (checkout.cart_id) {
    const error = new Error("A Mandate Cart has already been committed for this checkout.");
    error.status = 409;
    error.code = "CHECKOUT_CART_ALREADY_COMMITTED";
    throw error;
  }
  const intent = getIntentById(checkout.intent_id);
  if (!intent) {
    const error = new Error("Intent not found");
    error.status = 404;
    error.code = "INTENT_NOT_FOUND";
    throw error;
  }
  if (intent.status !== "approved") {
    const error = new Error("Explicitly approve the Intent before committing a Cart.");
    error.status = 409;
    error.code = "INTENT_NOT_APPROVED";
    throw error;
  }
  try {
    validateIntentScope(intent, checkout);
  } catch (error) {
    if (error.code === "SCOPE_NOT_ALLOWED") {
      writeAuditEvent({
        traceId: intent.trace_id,
        entityType: "intent",
        entityId: intent.id,
        event: "scope_rejected",
        previousStatus: intent.status,
        newStatus: intent.status,
        reasonCode: "SCOPE_NOT_ALLOWED",
        detail: "Trusted commerce checkout was outside the authorized Intent scope.",
        metadata: error.details,
      });
      error.details = { ...error.details, trace_id: intent.trace_id, intent_id: intent.id };
    }
    throw error;
  }

  const cart = createCart(mandateCartInput(checkout, intent.id));

  updateCheckoutSession(checkoutId, {
    cart_id: cart.id,
    trace_id: cart.trace_id,
  });

  return { intent, cart };
}

export async function initializeCommercePayment(checkoutId) {
  const checkout = getCheckoutSession(checkoutId);

  if (!checkout.cart_id) {
    const error = new Error("Approve the authorization before confirming payment.");
    error.status = 409;
    error.code = "CHECKOUT_CART_REQUIRED";
    throw error;
  }

  const payment = await createPaymentForCart(checkout.cart_id);

  updateCheckoutSession(checkoutId, {
    payment_id: payment.id,
    trace_id: payment.trace_id,
  });

  return payment;
}
