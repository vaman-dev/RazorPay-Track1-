import type { TraceApiEnvelope, TraceData } from "../types/trace";

export async function getTrace(traceId: string): Promise<TraceData> {
  const response = await fetch(`/trace/${encodeURIComponent(traceId)}`);
  const body = (await response.json().catch(() => null)) as TraceApiEnvelope | null;

  if (!response.ok || !body?.success) {
    throw new Error(body?.message || body?.error || "Unable to load this transaction trace.");
  }

  return body.data;
}
