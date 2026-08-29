import { CheckCircle2, CircleAlert, Clock3, ExternalLink, LoaderCircle, RotateCcw, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import type { ChatMessage } from "../../types/chat";

interface PaymentStatusCardProps {
  status: NonNullable<ChatMessage["paymentStatus"]>;
  detail?: string;
  amount?: number;
  currency?: string;
  traceId?: string;
  onRetry?: () => void;
}

function formatMoney(amount?: number, currency = "INR") {
  if (typeof amount !== "number") return null;
  return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(amount / 100);
}

function PaymentStatusCard({ status, detail, amount, currency, traceId, onRetry }: PaymentStatusCardProps) {
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
      title: "Verifying payment status",
      description: detail || "Payment attempt failed. Verifying the server record.",
      className: "border-amber-200 bg-amber-50 text-amber-900",
    },
    captured: {
      icon: <CheckCircle2 className="size-4" aria-hidden="true" />,
      title: "Payment captured",
      description: detail || "Mandate Ledger verified the captured payment.",
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
      description: detail || "The payment attempt was recorded, but no successful capture exists in Mandate Ledger.",
      className: "border-red-200 bg-red-50 text-red-800",
    },
  }[status];
  const amountText = formatMoney(amount, currency);

  return (
    <section className={`mt-3 w-full max-w-md rounded-2xl border px-4 py-3 ${content.className}`}>
      <div className="flex items-center gap-2 text-sm font-semibold">
        {content.icon}
        {content.title}
      </div>
      <p className="mt-1 text-sm opacity-80">{content.description}</p>
      {status === "failed" && amountText && <><p className="mt-3 text-sm font-semibold">{amountText} was not captured.</p><p className="mt-2 text-sm opacity-80">This Cart still reserves {amountText} of your authorization so the same purchase can be retried safely. It is not reserved again on retry.</p></>}
      {status === "failed" && <p className="mt-2 text-xs font-semibold uppercase tracking-wide opacity-70">Status: Failed</p>}
      {(status === "failed" || status === "captured") && (onRetry || traceId) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {status === "failed" && onRetry && <button type="button" onClick={onRetry} className="inline-flex items-center gap-2 rounded-lg border border-current/25 bg-white/60 px-3 py-2 text-xs font-semibold transition hover:bg-white disabled:opacity-50"><RotateCcw className="size-3.5" aria-hidden="true" />Try payment again</button>}
          {traceId && <Link to={`/dashboard/${encodeURIComponent(traceId)}`} className="inline-flex items-center gap-2 rounded-lg border border-current/25 bg-white/60 px-3 py-2 text-xs font-semibold transition hover:bg-white">View transaction proof<ExternalLink className="size-3.5" aria-hidden="true" /></Link>}
        </div>
      )}
    </section>
  );
}

export default PaymentStatusCard;
