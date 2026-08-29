import crypto from "crypto";

// Checkout sessions are intentionally separate from Mandate Ledger records.
// They hold an immutable, server-calculated commerce snapshot for this MVP.
const sessions = new Map();
const SESSION_TTL_MS = 30 * 60 * 1000;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function expired(session) {
  return new Date(session.expires_at).getTime() <= Date.now();
}

function cleanupExpiredSessions() {
  for (const [id, session] of sessions) {
    if (expired(session)) sessions.delete(id);
  }
}

export function createCheckoutSession(preview) {
  cleanupExpiredSessions();

  const now = new Date();
  const session = {
    checkout_id: `chk_${crypto.randomUUID()}`,
    merchant: preview.merchant,
    items: clone(preview.items),
    amount: preview.amount,
    currency: preview.currency,
    itemCount: preview.itemCount,
    created_at: now.toISOString(),
    expires_at: new Date(now.getTime() + SESSION_TTL_MS).toISOString(),
    intent_id: null,
    cart_id: null,
    payment_id: null,
    trace_id: null,
  };

  sessions.set(session.checkout_id, session);
  return clone(session);
}

export function getCheckoutSession(checkoutId) {
  const session = sessions.get(checkoutId);

  if (!session || expired(session)) {
    sessions.delete(checkoutId);
    const error = new Error("Checkout session was not found or has expired. Please review your cart again.");
    error.status = 404;
    error.code = "CHECKOUT_SESSION_NOT_FOUND";
    throw error;
  }

  return session;
}

export function updateCheckoutSession(checkoutId, updates) {
  const session = getCheckoutSession(checkoutId);
  Object.assign(session, updates);
  sessions.set(checkoutId, session);
  return clone(session);
}

export function getPublicCheckoutSession(checkoutId) {
  const session = getCheckoutSession(checkoutId);
  return clone(session);
}
