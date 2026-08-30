import { CheckCircle2, CircleAlert, Clock3, ExternalLink, LoaderCircle, RotateCcw, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import type { ChatMessage } from "../../types/chat";
import { customerFacingText, formatMoney } from "../../utils/presentation";

interface PaymentStatusCardProps {
  status: NonNullable<ChatMessage["paymentStatus"]>;
  detail?: string;
  amount?: number;
  currency?: string;
  traceId?: string;
  availableAmount?: number;
  usageMode?: "single_use" | "reusable_budget";
  chainValid?: boolean;
  onRetry?: () => void;
}

function PaymentStatusCard({ status, detail, amount, currency, traceId, availableAmount, usageMode, chainValid, onRetry }: PaymentStatusCardProps) {
  const content = {
    opening: {
      icon: <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />,
      title: "Opening secure checkout",
      description: "Please complete payment in the Razorpay window.",
      className: "border-sky-200 bg-sky-50 text-sky-800",
    },
    submitted: {
      icon: <Clock3 className="size-4" aria-hidden="true" />,
      title: "Payment submitted",
      description: "Waiting for server-side verification.",
      className: "border-amber-200 bg-amber-50 text-amber-900",
    },
    verifying: {
      icon: <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />,
      title: "Verifying payment",
      description: customerFacingText(detail) || "We are confirming the payment with Mandate Ledger.",
      className: "border-amber-200 bg-amber-50 text-amber-900",
    },
    captured: {
      icon: <CheckCircle2 className="size-4" aria-hidden="true" />,
      title: "Payment successful",
      description: customerFacingText(detail) || "Mandate Ledger verified the payment.",
      className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    },
    dismissed: {
      icon: <XCircle className="size-4" aria-hidden="true" />,
      title: "Checkout closed",
      description: "No payment completion was submitted.",
      className: "border-slate-200 bg-slate-50 text-slate-700",
    },
    failed: {
      icon: <CircleAlert className="size-4" aria-hidden="true" />,
      title: "Payment failed",
      description: customerFacingText(detail) || "Your payment was not completed.",
      className: "border-red-200 bg-red-50 text-red-800",
    },
  }[status];
  const amountText = typeof amount === "number" ? formatMoney(amount, currency) : null;
  const availableText = typeof availableAmount === "number" ? formatMoney(availableAmount, currency) : null;

  return (
    <section className={`mt-3 w-full max-w-md rounded-2xl border px-4 py-3 ${content.className}`}>
      <div className="flex items-center gap-2 text-sm font-semibold">
        {content.icon}
        {content.title}
      </div>
      <p className="mt-1 text-sm opacity-80">{content.description}</p>
      {status === "failed" && amountText && <div className="mt-3 space-y-2 rounded-xl bg-white/55 p-3 text-sm"><div className="flex justify-between gap-4"><span className="opacity-75">Purchase reserved</span><strong>{amountText}</strong></div>{usageMode === "reusable_budget" && availableText && <div className="flex justify-between gap-4"><span className="opacity-75">Available authorization</span><strong>{availableText}</strong></div>}{usageMode === "single_use" && <p className="font-medium">This single-use authorization is committed to this purchase.</p>}{typeof chainValid === "boolean" && <div className="flex justify-between gap-4"><span className="opacity-75">Transaction integrity</span><strong>{chainValid ? "Verified" : "Needs attention"}</strong></div>}</div>}
      {status === "failed" && amountText && <p className="mt-2 text-sm opacity-80">The same payment can be retried without reserving your authorization again.</p>}
      {status === "captured" && typeof chainValid === "boolean" && <p className="mt-2 text-sm font-medium">Transaction integrity: {chainValid ? "Verified" : "Needs attention"}</p>}
      {(status === "failed" || status === "captured") && (onRetry || traceId) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {status === "failed" && onRetry && <button type="button" onClick={onRetry} className="inline-flex items-center gap-2 rounded-lg border border-current/25 bg-white/60 px-3 py-2 text-xs font-semibold transition hover:bg-white disabled:opacity-50"><RotateCcw className="size-3.5" aria-hidden="true" />Retry payment</button>}
          {traceId && <Link to={`/dashboard/${encodeURIComponent(traceId)}`} className="inline-flex items-center gap-2 rounded-lg border border-current/25 bg-white/60 px-3 py-2 text-xs font-semibold transition hover:bg-white">View transaction proof<ExternalLink className="size-3.5" aria-hidden="true" /></Link>}
        </div>
      )}
    </section>
  );
}

export default PaymentStatusCard;
