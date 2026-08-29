import type { Product, TrustedCheckout } from "../types/commerce";
import type { PolicyViolation, RazorpayCheckoutAction } from "../types/chat";

const API_BASE = "/products";
const COMMERCE_API_BASE = "/commerce";

export class CommerceApiError extends Error {
  status?: number;
  code?: string;
  policyViolation?: PolicyViolation;
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new CommerceApiError(data.message || "Request failed");
    error.name = data.error || "API_ERROR";
    error.code = data.error;
    error.status = response.status;
    error.policyViolation = data.policy_violation;
    throw error;
  }
  return data.data as T;
}

export async function getProducts(): Promise<Product[]> {
  return fetchJson<Product[]>(`${API_BASE}`);
}

export async function getProductById(id: string): Promise<Product | undefined> {
  try {
    return await fetchJson<Product>(`${API_BASE}/${encodeURIComponent(id)}`);
  } catch (error) {
    if ((error as any).status === 404) return undefined;
    throw error;
  }
}

export async function getProductsByCategory(category: Product["category"]): Promise<Product[]> {
  return fetchJson<Product[]>(`${API_BASE}?category=${encodeURIComponent(category)}`);
}

export async function getFeaturedProducts(): Promise<Product[]> {
  return fetchJson<Product[]>(`${API_BASE}?featured=true`);
}

export interface CheckoutPreviewRequest {
  items: Array<{ product_id: string; quantity: number }>;
}

export type CheckoutPreviewResponse = TrustedCheckout;

export async function getCheckoutPreview(request: CheckoutPreviewRequest): Promise<CheckoutPreviewResponse> {
  return fetchJson<CheckoutPreviewResponse>(`${COMMERCE_API_BASE}/checkout-preview`, {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function getCheckout(checkoutId: string): Promise<TrustedCheckout> {
  return fetchJson<TrustedCheckout>(`${COMMERCE_API_BASE}/checkout/${encodeURIComponent(checkoutId)}`);
}

export interface CommerceIntent {
  id: string;
  trace_id: string;
  scope: string;
  max_amount: number;
  currency: string;
  valid_until: string;
  status: string;
}

export async function createCheckoutIntent(checkoutId: string, validUntil: string, maxAmount: number): Promise<CommerceIntent> {
  const data = await fetchJson<{ intent: CommerceIntent }>(`${COMMERCE_API_BASE}/checkout/${encodeURIComponent(checkoutId)}/intent`, {
    method: "POST",
    body: JSON.stringify({ valid_until: validUntil, max_amount: maxAmount }),
  });
  return data.intent;
}

export async function approveCheckoutIntent(checkoutId: string): Promise<{ intent: CommerceIntent }> {
  return fetchJson(`${COMMERCE_API_BASE}/checkout/${encodeURIComponent(checkoutId)}/approve-intent`, { method: "POST" });
}

export async function commitCheckoutCart(checkoutId: string): Promise<{ intent: CommerceIntent; cart: { id: string; trace_id: string; amount: number; currency: string; status: string } }> {
  return fetchJson(`${COMMERCE_API_BASE}/checkout/${encodeURIComponent(checkoutId)}/cart`, { method: "POST" });
}

export async function initializeCheckoutPayment(checkoutId: string): Promise<{ payment: { id: string; trace_id: string; cart_id: string; amount: number; currency: string }; action: RazorpayCheckoutAction }> {
  return fetchJson(`${COMMERCE_API_BASE}/checkout/${encodeURIComponent(checkoutId)}/payment`, { method: "POST" });
}
