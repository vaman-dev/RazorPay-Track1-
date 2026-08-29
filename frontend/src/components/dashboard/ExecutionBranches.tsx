import type { TraceData } from "../../types/trace";

function money(value: number | string, currency: string) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(Number(value) / 100);
}

export default function ExecutionBranches({ trace }: { trace: TraceData }) {
  return <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-bold tracking-[0.16em] text-slate-500">EXECUTION BRANCHES</p><h2 className="mt-1 text-xl font-semibold tracking-tight">Cart mandates and payments</h2><div className="mt-5 space-y-3">{trace.carts.map((cart, index) => {
    const payment = trace.payments.find((entry) => entry.cart_id === cart.id);
    return <div key={cart.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4 text-sm"><div><p className="font-semibold text-slate-950">Cart #{index + 1} · {money(cart.amount, cart.currency)}</p><p className="mt-1 text-slate-500">{cart.merchant} · Cart <span className="font-medium capitalize">{cart.status}</span></p></div><p className={`font-semibold uppercase ${payment?.status === "captured" ? "text-emerald-700" : payment?.status === "failed" ? "text-red-700" : "text-amber-700"}`}>Payment {payment?.status || "not initiated"}</p></div>;
  })}</div></section>;
}
