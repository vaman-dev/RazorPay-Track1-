import { CheckCircle2, CircleAlert } from "lucide-react";
import type { TraceData } from "../../types/trace";
function IntegrityPanel({ trace }: { trace: TraceData }) {
  const items = [
    ["Full chain valid", trace.integrity.chain_valid], ["Trace consistent", trace.integrity.trace_consistent], ["Intent signature verified", trace.integrity.cryptographic.intent_valid], ["Intent → Cart link verified", trace.integrity.intent_cart_links_valid], ["Cart signature verified", trace.integrity.cryptographic.carts_valid], ["Cart → Payment link verified", trace.integrity.cart_payment_links_valid], ["Payment signature verified", trace.integrity.cryptographic.payments_valid],
  ];
  return <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold tracking-[0.16em] text-slate-500">INTEGRITY</p><h2 className="mt-1 text-xl font-semibold tracking-tight">Integrity verification</h2></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${trace.integrity.chain_valid ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>{trace.integrity.chain_valid ? "VERIFIED" : "INVALID"}</span></div>
    <ul className="mt-5 space-y-3">{items.map(([label, valid]) => <li key={String(label)} className="flex items-center gap-3 text-sm text-slate-700">{valid ? <CheckCircle2 className="size-4 shrink-0 text-emerald-600" /> : <CircleAlert className="size-4 shrink-0 text-red-600" />}<span>{String(label)}</span></li>)}</ul>
  </section>;
}
export default IntegrityPanel;
