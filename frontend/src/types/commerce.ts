export interface Product {
  id: string;
  name: string;
  slug: string;

  description: string;
  shortDescription: string;

  price: number;
  currency: "INR";

  merchant: string;
  category: ProductCategory;

  image: string;
  images?: string[];

  stock: number;

  rating?: number;
  reviewCount?: number;

  featured?: boolean;
}

export type ProductCategory =
  | "Footwear"
  | "Electronics"
  | "Accessories";

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface CommerceCart {
  items: CartItem[];
  subtotal: number;
  currency: "INR";
  itemCount: number;
}

export type CheckoutStage =
  | "review"
  | "authorization_pending"
  | "cart_committed"
  | "payment_confirmation"
  | "payment_processing"
  | "payment_verifying"
  | "captured"
  | "failed";

export interface TrustedCheckoutItem {
  product_id: string;
  name: string;
  merchant: string;
  category: ProductCategory;
  quantity: number;
  unit_amount: number;
  line_amount: number;
}

export interface TrustedCheckout {
  checkout_id: string;
  merchant: string;
  items: TrustedCheckoutItem[];
  amount: number;
  currency: "INR";
  itemCount: number;
  created_at: string;
  expires_at: string;
  intent_id: string | null;
  cart_id: string | null;
  payment_id: string | null;
  trace_id: string | null;
}
