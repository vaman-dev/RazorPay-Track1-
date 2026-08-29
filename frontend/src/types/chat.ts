export type ChatResponseType = "message" | "confirmation_required" | "action";

export type PolicyViolationCode =
  | "CAP_EXCEEDED"
  | "SCOPE_NOT_ALLOWED"
  | "INTENT_EXPIRED"
  | "PAYMENT_FAILED"
  | "INTEGRITY_FAILURE";

export interface PolicyViolationDetails {
  authorized_amount?: number;
  committed_amount?: number;
  remaining_amount?: number;
  requested_amount?: number;
  excess_amount?: number;
  currency?: string;
  trace_id?: string;
  scope?: string;
  allowed_categories?: string[];
  requested_category?: string;
  product_id?: string;
  product_name?: string;
}

export interface PolicyViolation {
  code: PolicyViolationCode;
  message: string;
  details?: PolicyViolationDetails;
}

export interface ChatRequest {
  message?: string;
  session_id?: string;
  confirm?: boolean;
  cancel?: boolean;
}

export interface ConfirmationDetails {
  intent_id?: string;
  trace_id?: string;
  cart_id?: string;
  scope?: string;
  merchant?: string;
  max_amount?: number;
  amount?: number;
  formatted_max_amount?: string;
  formatted_amount?: string;
  currency?: string;
  valid_until?: string;
  status?: string;
  items?: Array<{
    name?: string;
    quantity?: number;
    unit_amount?: number;
  }>;
}

export interface ChatConfirmation {
  action: "approve_intent" | "initiate_payment" | string;
  title?: string;
  message?: string;
  details?: ConfirmationDetails;
}

export interface RazorpayCheckoutAction {
  type: "razorpay_checkout";
  payment_id: string;
  trace_id: string;
  cart_id: string;
  checkout: {
    key_id: string;
    order_id: string;
    amount: number;
    currency: string;
  };
}

export type ChatClientAction = RazorpayCheckoutAction;

export interface ChatResponse {
  session_id: string;
  type: ChatResponseType;
  message: string;
  confirmation?: ChatConfirmation | null;
  policy_violation?: PolicyViolation | null;
  action?: ChatClientAction | null;
  data?: unknown;
}

export interface ChatApiEnvelope {
  success: boolean;
  data: ChatResponse;
  error?: string;
  message?: string;
}

export type ChatMessageRole = "user" | "assistant" | "error";

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  content: string;
  confirmation?: ChatConfirmation | null;
  confirmationResolved?: boolean;
  policyViolation?: PolicyViolation | null;
  paymentStatus?: "opening" | "submitted" | "verifying" | "captured" | "dismissed" | "failed";
  paymentStatusDetail?: string;
  paymentAmount?: number;
  paymentCurrency?: string;
  traceId?: string;
}
