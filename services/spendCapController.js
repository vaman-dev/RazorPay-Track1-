// Budget truth is derived from immutable approved Cart mandates. We never
// mutate a remaining-balance column, so payment retries cannot double-spend.
import db from "../db/db.js";

export function getIntentBudgetState(intentId, intent = null) {
  const parentIntent = intent || db.prepare("SELECT * FROM intents WHERE id = ?").get(intentId);
  if (!parentIntent) {
    const error = new Error("Parent Intent does not exist");
    error.status = 404;
    error.code = "INTENT_NOT_FOUND";
    throw error;
  }
  const row = db.prepare(`SELECT COALESCE(SUM(amount), 0) AS committed_amount FROM carts WHERE intent_id = ? AND status = 'approved'`).get(parentIntent.id);
  const committedAmount = Number(row?.committed_amount || 0);
  return {
    max_amount: Number(parentIntent.max_amount),
    committed_amount: committedAmount,
    remaining_amount: Math.max(Number(parentIntent.max_amount) - committedAmount, 0),
    currency: parentIntent.currency,
  };
}

export function validateCartAgainstIntent({ intent, amount, currency }) {
  if (!intent) {
    const error = new Error("Parent Intent does not exist");
    error.status = 404;
    error.code = "INTENT_NOT_FOUND";
    throw error;
  }
  if (intent.status !== "approved") {
    const error = new Error(`Cart cannot be created because Intent status is '${intent.status}'`);
    error.status = 409;
    error.code = "INTENT_NOT_APPROVED";
    error.details = { intent_status: intent.status };
    throw error;
  }
  const expiryTime = new Date(intent.valid_until).getTime();
  if (Number.isNaN(expiryTime) || expiryTime <= Date.now()) {
    const error = new Error("Intent has expired");
    error.status = 409;
    error.code = "INTENT_EXPIRED";
    error.details = { valid_until: intent.valid_until };
    throw error;
  }
  if (!Number.isInteger(amount) || amount <= 0) {
    const error = new Error("Cart amount must be a positive integer in paise");
    error.status = 400;
    error.code = "INVALID_CART_AMOUNT";
    throw error;
  }
  const normalizedCurrency = currency.trim().toUpperCase();
  if (normalizedCurrency !== intent.currency) {
    const error = new Error(`Cart currency ${normalizedCurrency} does not match Intent currency ${intent.currency}`);
    error.status = 422;
    error.code = "CURRENCY_MISMATCH";
    error.details = { intent_currency: intent.currency, cart_currency: normalizedCurrency };
    throw error;
  }

  const budget = getIntentBudgetState(intent.id, intent);
  if (amount > budget.remaining_amount) {
    const error = new Error("Cart amount exceeds the remaining Intent authorization");
    error.status = 422;
    error.code = "CAP_EXCEEDED";
    error.details = {
      authorized_amount: budget.max_amount,
      committed_amount: budget.committed_amount,
      remaining_amount: budget.remaining_amount,
      requested_amount: amount,
      excess_amount: amount - budget.remaining_amount,
      currency: normalizedCurrency,
    };
    throw error;
  }
  return {
    allowed: true,
    ...budget,
    requested_amount: amount,
    committed_after: budget.committed_amount + amount,
    remaining_after: budget.remaining_amount - amount,
  };
}
