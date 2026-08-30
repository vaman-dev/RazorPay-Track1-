import type { TraceData } from "../../types/trace";
import { formatMoney, humanizeStatus } from "../../utils/presentation";

function firstItemName(items: TraceData["carts"][number]["items"]) {
  if (Array.isArray(items)) return items[0]?.name || "Trusted purchase";
  if (typeof items === "string") {
    try {
      const parsed = JSON.parse(items) as Array<{ name?: string }>;
      return parsed[0]?.name || "Trusted purchase";
    } catch {
      return "Trusted purchase";
    }
  }
  return "Trusted purchase";
}

export default function ExecutionBranches({ trace }: { trace: TraceData }) {
  return <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-bold tracking-[0.16em] text-slate-500">PURCHASES</p><h2 className="mt-1 text-xl font-semibold tracking-tight">Purchase and payment history</h2><div className="mt-5 space-y-3">{trace.carts.map((cart, index) => {
    const payment = trace.payments.find((entry) => entry.cart_id === cart.id);
    return <div key={cart.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4 text-sm"><div><p className="font-semibold text-slate-950">{firstItemName(cart.items)} · {formatMoney(cart.amount, cart.currency)}</p><p className="mt-1 text-slate-500">{cart.merchant} · Purchase {index + 1}</p></div><p className={`font-semibold ${payment?.status === "captured" ? "text-emerald-700" : payment?.status === "failed" ? "text-red-700" : "text-amber-700"}`}>{payment ? humanizeStatus(payment.status) : "Payment not started"}</p></div>;
  })}</div></section>;
}
