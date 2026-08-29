import { ArrowLeft, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AuditTimeline from "../components/dashboard/AuditTimeline";
import CartCard from "../components/dashboard/CartCard";
import IntegrityPanel from "../components/dashboard/IntegrityPanel";
import IntentCard from "../components/dashboard/IntentCard";
import MandateChain from "../components/dashboard/MandateChain";
import PaymentCard from "../components/dashboard/PaymentCard";
import SpendSummary from "../components/dashboard/SpendSummary";
import ExecutionBranches from "../components/dashboard/ExecutionBranches";
import TransactionHeader from "../components/dashboard/TransactionHeader";
import { getTrace } from "../services/traceApi";
import type { TraceData } from "../types/trace";

function DashboardPage() {
  const { traceId } = useParams<{ traceId: string }>();
  const missingTraceId = !traceId;
  const [trace, setTrace] = useState<TraceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    if (!traceId) return;
    getTrace(traceId).then((data) => { if (isCurrent) setTrace(data); }).catch((loadError: unknown) => { if (isCurrent) setError(loadError instanceof Error ? loadError.message : "Unable to load this transaction trace."); }).finally(() => { if (isCurrent) setIsLoading(false); });
    return () => { isCurrent = false; };
  }, [traceId]);

  async function copyTraceId() { if (!trace) return; await navigator.clipboard?.writeText(trace.trace_id); setCopied(true); window.setTimeout(() => setCopied(false), 1600); }

  return <main className="min-h-screen bg-slate-50 text-slate-950"><div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10"><Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950"><ArrowLeft className="size-4" />Back to chat</Link>
    {isLoading && !missingTraceId && <section className="grid min-h-96 place-items-center rounded-3xl border border-slate-200 bg-white text-sm text-slate-500"><span className="flex items-center gap-2"><LoaderCircle className="size-4 animate-spin" />Loading transaction proof…</span></section>}
    {(missingTraceId || error) && <section className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-800"><h1 className="text-lg font-semibold">Transaction proof unavailable</h1><p className="mt-2 text-sm">{missingTraceId ? "A trace ID is required to view transaction proof." : error}</p><Link to="/" className="mt-5 inline-block rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">Return to chat</Link></section>}
    {trace && <div className="space-y-6"><TransactionHeader trace={trace} onCopyTraceId={copyTraceId} />{copied && <p className="-mt-3 text-right text-xs font-medium text-emerald-700">Trace ID copied</p>}<MandateChain trace={trace} /><div className="grid gap-6 lg:grid-cols-2"><SpendSummary trace={trace} /><IntegrityPanel trace={trace} /></div>{trace.intent?.usage_mode === "reusable_budget" ? <ExecutionBranches trace={trace} /> : <div className="grid gap-4 md:grid-cols-3"><IntentCard intent={trace.intent} /><CartCard cart={trace.carts.at(-1)} /><PaymentCard payment={trace.payments.at(-1)} /></div>}<AuditTimeline entries={trace.audit_timeline} /></div>}
  </div></main>;
}
export default DashboardPage;
