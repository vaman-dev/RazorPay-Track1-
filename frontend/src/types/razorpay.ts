import type { RazorpayCheckoutAction } from "./chat";

export interface RazorpayPaymentResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface RazorpayPaymentFailure {
  error?: {
    description?: string;
  };
}

export interface RazorpayCheckoutOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description: string;
  theme: { color: string };
  handler: (response: RazorpayPaymentResponse) => void;
  modal: {
    ondismiss: () => void;
  };
}

export interface RazorpayInstance {
  open: () => void;
  on: (event: "payment.failed", handler: (response: RazorpayPaymentFailure) => void) => void;
}

export type RazorpayConstructor = new (options: RazorpayCheckoutOptions) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

export interface RazorpayCallbacks {
  onSubmitted: (response: RazorpayPaymentResponse) => void;
  onDismissed: () => void;
  onFailed: (message: string) => void;
}

export type { RazorpayCheckoutAction };
