import { CheckCircle2, Copy, ShieldCheck } from "lucide-react";
import type { TraceData } from "../../types/trace";

interface TransactionHeaderProps {
  trace: TraceData;
  onCopyTraceId: () => void;
}

function formatMoney(amount: number | string, currency = "INR") {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(Number(amount) / 100);
}

function TransactionHeader({ trace, onCopyTraceId }: TransactionHeaderProps) {
  const capturedAmount = trace.summary.payments.captured_amount;
  const latestPayment = trace.payments.at(-1);
  const status = latestPayment?.status || "pending";
  const reusable = trace.intent?.usage_mode === "reusable_budget";
  const title = reusable
    ? "Reusable authorization"
    : status === "captured" && trace.integrity.chain_valid
    ? "Verified transaction"
    : status === "failed"
      ? "Failed payment trace"
      : "Transaction trace";

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-start sm:justify-between sm:p-8">
        <div className="flex gap-4">
          <div className={`grid size-12 shrink-0 place-items-center rounded-2xl ${trace.integrity.chain_valid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
            {trace.integrity.chain_valid ? <CheckCircle2 className="size-6" /> : <ShieldCheck className="size-6" />}
          </div>
          <div>
            <p className="text-xs font-bold tracking-[0.16em] text-slate-500">TRANSACTION PROOF</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
              {title}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span className="font-mono text-xs">{trace.trace_id}</span>
              <button type="button" onClick={onCopyTraceId} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Copy trace ID">
                <Copy className="size-3.5" />
              </button>
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-slate-950 px-5 py-4 text-white sm:min-w-48">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{reusable ? "Authorization status" : "Payment status"}</p>
          <p className="mt-1 text-lg font-semibold capitalize">{reusable ? trace.intent?.status || "pending" : status}</p>
          {capturedAmount > 0 && <p className="mt-1 text-sm text-slate-300">{formatMoney(capturedAmount, trace.summary.currency || "INR")} captured</p>}
          {reusable && <p className="mt-1 text-sm text-slate-300">{trace.summary.carts.approved} Carts · {trace.summary.payments.captured} captured · {trace.summary.payments.failed} failed</p>}
        </div>
      </div>
    </section>
  );
}

export default TransactionHeader;
