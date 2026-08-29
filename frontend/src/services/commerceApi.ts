import type { Product } from "../types/commerce";

const API_BASE = "/products";
const COMMERCE_API_BASE = "/commerce";

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.message || "Request failed");
    error.name = data.error || "API_ERROR";
    (error as any).status = response.status;
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

export interface CheckoutPreviewResponse {
  items: Array<{
    product_id: string;
    name: string;
    merchant: string;
    quantity: number;
    unit_amount: number;
    line_amount: number;
  }>;
  amount: number;
  currency: "INR";
  itemCount: number;
}

export async function getCheckoutPreview(request: CheckoutPreviewRequest): Promise<CheckoutPreviewResponse> {
  return fetchJson<CheckoutPreviewResponse>(`${COMMERCE_API_BASE}/checkout-preview`, {
    method: "POST",
    body: JSON.stringify(request),
  });
}