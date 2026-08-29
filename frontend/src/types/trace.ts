export type MoneyAmount = number | string;

export interface TraceIntent {
  id: string;
  trace_id: string;
  scope: string;
  max_amount: MoneyAmount;
  currency: string;
  valid_until: string | null;
  usage_mode?: "single_use" | "reusable_budget";
  policy_json?: string | null;
  mandate_hash: string;
  status: string;
  created_at: string;
  signature_present: boolean;
}

export interface TraceCartItem {
  name?: string;
  quantity?: number;
  unit_amount?: MoneyAmount;
  [key: string]: unknown;
}

export interface TraceCart {
  id: string;
  trace_id: string;
  intent_id: string;
  merchant: string;
  items: TraceCartItem[] | string | null;
  amount: MoneyAmount;
  currency: string;
  parent_hash: string;
  mandate_hash: string;
  status: string;
  created_at: string;
  signature_present: boolean;
}

export interface TracePayment {
  id: string;
  trace_id: string;
  cart_id: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  amount: MoneyAmount;
  currency: string;
  parent_hash: string;
  mandate_hash: string;
  status: string;
  failure_code: string | null;
  failure_detail: string | null;
  created_at: string;
  updated_at: string | null;
  signature_present: boolean;
}

export interface TraceAuditEntry {
  id: number;
  trace_id: string;
  entity_type: string;
  entity_id: string;
  event: string;
  previous_status: string | null;
  new_status: string | null;
  reason_code: string | null;
  detail: string | null;
  metadata: Record<string, unknown> | string | null;
  timestamp: string;
}

interface LinkCheck {
  valid: boolean;
}

interface EntityCheck {
  id?: string;
  valid: boolean;
  error: string | null;
  verifiable?: boolean;
}

export interface TraceIntegrity {
  trace_consistent: boolean;
  intent_cart_links_valid: boolean;
  cart_payment_links_valid: boolean;
  intent_cart_links: LinkCheck[];
  cart_payment_links: LinkCheck[];
  cryptographic: {
    intent_valid: boolean;
    carts_valid: boolean;
    payments_valid: boolean;
    valid: boolean;
    details: {
      intent: EntityCheck;
      carts: EntityCheck[];
      payments: EntityCheck[];
    };
  };
  chain_valid: boolean;
}

export interface TraceSummary {
  intent_status: string | null;
  authorized_amount: MoneyAmount | null;
  committed_amount?: MoneyAmount;
  remaining_amount?: MoneyAmount | null;
  cart_count?: number;
  payment_count?: number;
  failed_payment_count?: number;
  currency: string | null;
  carts: { total: number; approved: number; rejected: number };
  payments: { total: number; captured: number; failed: number; captured_amount: number };
  audit_events: number;
  chain_valid: boolean;
}

export interface TraceData {
  trace_id: string;
  summary: TraceSummary;
  integrity: TraceIntegrity;
  intent: TraceIntent | null;
  carts: TraceCart[];
  payments: TracePayment[];
  audit_timeline: TraceAuditEntry[];
}

export interface TraceApiEnvelope {
  success: boolean;
  message?: string;
  error?: string;
  data: TraceData;
}
