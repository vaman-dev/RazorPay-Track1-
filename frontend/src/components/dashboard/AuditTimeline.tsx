import { CheckCircle2 } from "lucide-react";
import type { TraceAuditEntry } from "../../types/trace";
import { customerFacingText, humanizeStatus } from "../../utils/presentation";
function formatTime(timestamp: string) { const date = new Date(timestamp); return Number.isNaN(date.getTime()) ? timestamp : date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "medium" }); }
function AuditTimeline({ entries }: { entries: TraceAuditEntry[] }) {
  return <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><p className="text-xs font-bold tracking-[0.16em] text-slate-500">APPEND-ONLY RECORD</p><h2 className="mt-1 text-xl font-semibold tracking-tight">Audit timeline</h2>
    <ol className="mt-6 space-y-0">{entries.length ? entries.map((entry, index) => <li key={entry.id} className="relative flex gap-4 pb-6 last:pb-0"><div className="relative z-10 grid size-6 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700"><CheckCircle2 className="size-3.5" /></div>{index < entries.length - 1 && <div className="absolute left-3 top-6 h-[calc(100%-12px)] border-l border-slate-200" />}<div className="min-w-0 pt-0.5"><p className="text-sm font-semibold text-slate-900">{humanizeStatus(entry.event)}</p><p className="mt-1 text-xs text-slate-500">{formatTime(entry.timestamp)} · {humanizeStatus(entry.entity_type)}</p>{entry.detail && <p className="mt-2 break-words text-sm text-slate-600">{customerFacingText(entry.detail)}</p>}</div></li>) : <li className="text-sm text-slate-500">No audit events are available for this transaction.</li>}</ol>
  </section>;
}
export default AuditTimeline;
