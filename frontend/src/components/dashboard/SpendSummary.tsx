import type { TraceData } from "../../types/trace";

function formatMoney(amount: number, currency: string) { return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(amount / 100); }

function SpendSummary({ trace }: { trace: TraceData }) {
  const authorized = Number(trace.summary.authorized_amount || 0);
  const committed = Number(trace.carts.at(-1)?.amount || 0);
  const remaining = Math.max(authorized - committed, 0);
  const percentage = authorized ? Math.min((committed / authorized) * 100, 100) : 0;
  const currency = trace.summary.currency || "INR";
  return <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-bold tracking-[0.16em] text-slate-500">AUTHORIZATION</p><h2 className="mt-1 text-xl font-semibold tracking-tight">Spend-cap usage</h2>
    <div className="mt-5 space-y-3 text-sm"><Row label="Authorized" value={formatMoney(authorized, currency)} /><Row label="Committed" value={formatMoney(committed, currency)} /><Row label="Remaining" value={formatMoney(remaining, currency)} emphasis /></div>
    <div className="mt-6 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-slate-950 transition-all" style={{ width: `${percentage}%` }} /></div>
    <p className="mt-2 text-xs text-slate-500">{percentage.toFixed(1)}% of authorization used</p>
  </section>;
}
function Row({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) { return <div className="flex items-baseline justify-between gap-4"><span className="text-slate-500">{label}</span><span className={emphasis ? "font-semibold text-emerald-700" : "font-medium text-slate-900"}>{value}</span></div>; }
export default SpendSummary;
