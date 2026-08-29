function createPolicyError(code, message, details) {
  const error = new Error(message);
  error.status = 422;
  error.code = code;
  error.details = details;
  return error;
}

export function parseIntentPolicy(policyJson) {
  if (!policyJson) return {};
  if (typeof policyJson === "object") return policyJson;

  try {
    return JSON.parse(policyJson);
  } catch {
    throw createPolicyError("INTENT_POLICY_INVALID", "Intent scope policy is invalid", {});
  }
}

export function validateIntentScope(intent, checkout) {
  const policy = parseIntentPolicy(intent.policy_json);
  const items = checkout?.items;

  if (!Array.isArray(items) || items.length === 0) {
    throw createPolicyError("SCOPE_CONTEXT_REQUIRED", "Trusted product scope data is required", {});
  }

  for (const item of items) {
    if (policy.categories?.length && !policy.categories.includes(item.category)) {
      throw createPolicyError("SCOPE_NOT_ALLOWED", "Product is outside the authorized Intent scope", {
        scope: intent.scope,
        allowed_categories: policy.categories,
        requested_category: item.category,
        product_id: item.product_id,
        product_name: item.name,
      });
    }

    if (policy.merchant_ids?.length && !policy.merchant_ids.includes(item.merchant_id)) {
      throw createPolicyError("SCOPE_NOT_ALLOWED", "Merchant is outside the authorized Intent scope", {
        scope: intent.scope,
        allowed_merchant_ids: policy.merchant_ids,
        requested_merchant_id: item.merchant_id,
        product_id: item.product_id,
        product_name: item.name,
      });
    }

    if (policy.product_ids?.length && !policy.product_ids.includes(item.product_id)) {
      throw createPolicyError("SCOPE_NOT_ALLOWED", "Product is outside the authorized Intent scope", {
        scope: intent.scope,
        allowed_product_ids: policy.product_ids,
        requested_product_id: item.product_id,
        product_name: item.name,
      });
    }
  }

  return { allowed: true, policy };
}
