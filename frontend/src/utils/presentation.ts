const ERROR_COPY: Record<string, string> = {
  CAP_EXCEEDED: "This purchase exceeds your available authorization.",
  SCOPE_NOT_ALLOWED: "This purchase is outside your approved authorization scope.",
  INTENT_NOT_APPROVED: "This authorization still needs your approval.",
  INTENT_EXPIRED: "This authorization has expired.",
  INTENT_ALREADY_COMMITTED: "This single-use authorization has already been used.",
  PAYMENT_FAILED: "Payment failed.",
  payment_failed: "Payment failed.",
  INTEGRITY_FAILURE: "Transaction integrity could not be verified.",
};

export function formatMoney(
  amount?: number | string | null,
  currency = "INR",
  maximumFractionDigits = 0,
) {
  if (amount === null || typeof amount === "undefined" || Number.isNaN(Number(amount))) {
    return "—";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits,
  }).format(Number(amount) / 100);
}

export function humanizeStatus(status?: string | null) {
  if (!status) return "Not available";

  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function customerFacingText(value?: string | null) {
  if (!value) return "";

  let text = value;

  Object.entries(ERROR_COPY).forEach(([code, copy]) => {
    text = text.replace(new RegExp(`\\b${code}\\b`, "g"), copy);
  });

  text = text
    .replace(/A payment order already exists for Cart\s+(?:cart|crt)_[\w-]+\.?/gi, "A payment order already exists for this purchase.")
    .replace(/Confirm\s+(?:commit_checkout_cart|create_cart)\.?/gi, "Confirm this purchase.")
    .replace(/Confirm\s+(?:initiate_checkout_payment|initiate_payment)\.?/gi, "Confirm this payment.")
    // Remove complete parentheticals that only expose internal references.
    .replace(/\s*\(\s*[*_`~]*\s*(?:int|cart|crt|pay|trace|chk|order)_[A-Za-z0-9-]+\s*[*_`~]*\s*\)/gi, "")
    .replace(/\s*\(\s*(?:the\s+)?internal reference\s*\)/gi, "")
    // Remove raw IDs outside parentheticals without leaving a visible placeholder.
    .replace(/[*_`~]*\b(?:int|cart|crt|pay|trace|chk|order)_[A-Za-z0-9-]+\b[*_`~]*/gi, "")
    // Paise commonly arrives wrapped in Markdown inside a parenthetical.
    .replace(/\s*\([^)]*\bpaise\b[^)]*\)/gi, "")
    .replace(/[*_`~]*\b([\d,]+)\s+paise\b[*_`~]*/gi, (_match, digits: string) => {
      const paise = Number(digits.replaceAll(",", ""));
      return Number.isFinite(paise) ? formatMoney(paise, "INR", 2) : "the stated amount";
    })
    // Normalize model-generated rupee strings such as ₹8000.00 to ₹8,000.
    .replace(/₹\s*([\d,]+)(?:\.(\d{1,2}))?/g, (_match, whole: string, decimal?: string) => {
      const rupees = Number(`${whole.replaceAll(",", "")}.${decimal || "0"}`);
      if (!Number.isFinite(rupees)) return _match;
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: decimal && Number(decimal) > 0 ? decimal.length : 0,
      }).format(rupees);
    })
    .replace(/chain_valid\s*[:=]\s*true/gi, "Transaction integrity: Verified")
    .replace(/chain_valid\s*[:=]\s*false/gi, "Transaction integrity could not be verified")
    .replace(/Current Authorization\s*\(\s*(?:Intent|authorization)\s*\)/gi, "Authorization")
    .replace(/\s*\(\s*status:\s*captured\s*\)/gi, "")
    .replace(/(?:has\s+)?successfully succeeded(?: and (?:been )?captured)?/gi, "was successful and has been verified")
    .replace(/Payment Status:\s*Captured/gi, "Payment: Successful")
    .replace(/Status:\s*Approved\s*\(\s*reusable_budget\s*\)/gi, "Status: Active reusable authorization")
    .replace(/Approved\s*\(\s*reusable_budget\s*\)/gi, "Active reusable authorization")
    .replace(/\breusable_budget\b/gi, "reusable budget")
    .replace(/Maximum Authorized Amount/gi, "Maximum authorization")
    .replace(/Committed Amount/gi, "Committed")
    .replace(/Remaining (?:Amount|Authorization)/gi, "Available authorization")
    .replace(/Number of purchase commitments:\s*(\d+)\s+approved cart\b/gi, "Purchases: $1")
    .replace(/Cryptographic Chain:\s*Verified\s*\(\s*Transaction integrity:\s*Verified\s*\)/gi, "Transaction integrity: Verified")
    .replace(/Transaction Proof Verified:\s*Yes,?\s*the cryptographic mandate chain is verified\s*\(\s*Transaction integrity:\s*Verified\s*\)\.?/gi, "Transaction integrity: Verified.")
    .replace(/\bCryptographic Chain:\s*Verified\b/gi, "Transaction integrity: Verified")
    .replace(/\(\s*Transaction integrity:\s*Verified\s*\)/gi, "")
    .replace(/\bIntent\b/g, "authorization")
    .replace(/\bCart approved\b/g, "Purchase committed")
    .replace(/\bCart mandate(s)?\b/gi, "purchase commitment$1")
    // Clean punctuation and whitespace left after removing technical fragments.
    .replace(/\(\s*\)/g, "")
    .replace(/[ \t]+([,.;:])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .trim();

  return text;
}

export function friendlyRestriction(count: number, singular: string) {
  return `${count} approved ${singular}${count === 1 ? "" : "s"}`;
}
