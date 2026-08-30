import { ChevronDown, Copy } from "lucide-react";
import type { TraceData } from "../../types/trace";

function TechnicalRow({ label, value }: { label: string; value?: string | number | null }) {
  if (value === null || typeof value === "undefined" || value === "") return null;

  return (
    <div className="grid gap-1 border-b border-slate-100 py-2 last:border-0 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="break-all font-mono text-xs text-slate-700">{String(value)}</dd>
    </div>
  );
}

export default function TechnicalDetails({ trace }: { trace: TraceData }) {
  async function copyTraceId() {
    await navigator.clipboard?.writeText(trace.trace_id);
  }

  return (
    <details className="group rounded-3xl border border-slate-200 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 text-sm font-semibold text-slate-800 marker:hidden">
        <span>Technical details</span>
        <ChevronDown className="size-4 transition group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="border-t border-slate-100 px-6 py-5">
        <p className="mb-4 text-sm leading-6 text-slate-500">Internal references and cryptographic records are provided for audit and debugging.</p>
        <dl>
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1"><TechnicalRow label="Trace ID" value={trace.trace_id} /></div>
            <button type="button" onClick={() => void copyTraceId()} className="mt-2 rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" aria-label="Copy trace ID"><Copy className="size-3.5" /></button>
          </div>
          <TechnicalRow label="Intent ID" value={trace.intent?.id} />
          <TechnicalRow label="Intent hash" value={trace.intent?.mandate_hash} />
          {trace.carts.map((cart, index) => (
            <div key={cart.id} className="mt-4 rounded-xl bg-slate-50 px-3">
              <TechnicalRow label={`Purchase ${index + 1} ID`} value={cart.id} />
              <TechnicalRow label="Parent hash" value={cart.parent_hash} />
              <TechnicalRow label="Mandate hash" value={cart.mandate_hash} />
            </div>
          ))}
          {trace.payments.map((payment, index) => (
            <div key={payment.id} className="mt-4 rounded-xl bg-slate-50 px-3">
              <TechnicalRow label={`Payment ${index + 1} ID`} value={payment.id} />
              <TechnicalRow label="Razorpay order ID" value={payment.razorpay_order_id} />
              <TechnicalRow label="Razorpay payment ID" value={payment.razorpay_payment_id} />
              <TechnicalRow label="Parent hash" value={payment.parent_hash} />
              <TechnicalRow label="Mandate hash" value={payment.mandate_hash} />
            </div>
          ))}
        </dl>
      </div>
    </details>
  );
}
