import type { TraceData } from "../../types/trace";
import { formatMoney } from "../../utils/presentation";

function SpendSummary({ trace }: { trace: TraceData }) {
  const authorized = Number(trace.summary.authorized_amount || 0);
  const committed = Number(trace.summary.committed_amount ?? trace.carts.filter((cart) => cart.status === "approved").reduce((sum, cart) => sum + Number(cart.amount), 0));
  const remaining = Number(trace.summary.remaining_amount ?? Math.max(authorized - committed, 0));
  const percentage = authorized ? Math.min((committed / authorized) * 100, 100) : 0;
  const currency = trace.summary.currency || "INR";
  const reusable = trace.intent?.usage_mode === "reusable_budget";
  const singleUseConsumed = !reusable && trace.summary.carts.approved > 0;
  return <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold tracking-[0.16em] text-slate-500">AUTHORIZATION</p><h2 className="mt-1 text-xl font-semibold tracking-tight">{reusable ? "Reusable budget usage" : "Single-use authorization"}</h2></div>{singleUseConsumed && <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white">USED</span>}</div>
    <div className="mt-5 space-y-3 text-sm"><Row label="Authorized maximum" value={formatMoney(authorized, currency)} /><Row label="Purchase committed" value={formatMoney(committed, currency)} /><Row label={reusable ? "Available authorization" : "Unused amount"} value={formatMoney(remaining, currency)} emphasis={reusable} /></div>
    <div className="mt-6 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-slate-950 transition-all" style={{ width: `${percentage}%` }} /></div>
    <p className="mt-2 text-xs text-slate-500">{percentage.toFixed(1)}% of authorization used</p>
    {singleUseConsumed && <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2.5 text-sm leading-5 text-slate-600">This authorization has already been used. The unused amount cannot authorize another purchase.</p>}
  </section>;
}
function Row({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) { return <div className="flex items-baseline justify-between gap-4"><span className="text-slate-500">{label}</span><span className={emphasis ? "font-semibold text-emerald-700" : "font-medium text-slate-900"}>{value}</span></div>; }
export default SpendSummary;
