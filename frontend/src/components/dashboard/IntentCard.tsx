import type { TraceIntent } from "../../types/trace";

function IntentCard({ intent }: { intent: TraceIntent | null }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold tracking-[0.14em] text-slate-500">INTENT</p><p className="mt-2 text-sm font-semibold capitalize text-emerald-700">{intent?.status || "Not created"}</p><p className="mt-2 text-sm text-slate-700">{intent?.scope || "No authorization record available."}</p>{intent?.valid_until && <p className="mt-3 text-xs text-slate-500">Valid until {new Date(intent.valid_until).toLocaleString()}</p>}</section>;
}
export default IntentCard;
