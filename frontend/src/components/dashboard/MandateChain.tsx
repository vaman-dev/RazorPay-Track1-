import { ArrowRight, CheckCircle2 } from "lucide-react";
import type { TraceCart, TraceData, TraceIntent, TracePayment } from "../../types/trace";

function formatMoney(amount: number | string | undefined, currency = "INR") {
  return typeof amount === "undefined" ? "—" : new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(Number(amount) / 100);
}

function ChainNode({ label, entity, amount, currency }: { label: string; entity: TraceIntent | TraceCart | TracePayment | undefined | null; amount?: number | string; currency?: string }) {
  return <div className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
    <p className="text-xs font-bold tracking-[0.14em] text-slate-500">{label}</p>
    <p className="mt-2 text-sm font-semibold uppercase text-emerald-700">{entity?.status || "Not created"}</p>
    <p className="mt-1 text-xl font-semibold tracking-tight text-slate-950">{formatMoney(amount, currency)}</p>
  </div>;
}

function Link({ valid, label }: { valid: boolean; label: string }) {
  return <div className="flex shrink-0 flex-col items-center gap-1 text-emerald-700"><ArrowRight className="hidden size-5 sm:block" /><span className="text-center text-[10px] font-semibold leading-3">{valid ? <><CheckCircle2 className="mr-1 inline size-3" />{label}</> : "link unavailable"}</span></div>;
}

function MandateChain({ trace }: { trace: TraceData }) {
  const cart = trace.carts.at(-1);
  const payment = trace.payments.at(-1);
  return <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
    <div><p className="text-xs font-bold tracking-[0.16em] text-slate-500">AUTHORIZATION CHAIN</p><h2 className="mt-1 text-xl font-semibold tracking-tight">Intent → {trace.carts.length} Cart mandate{trace.carts.length === 1 ? "" : "s"} → Payment</h2></div>
    <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
      <ChainNode label="INTENT" entity={trace.intent} amount={trace.intent?.max_amount} currency={trace.intent?.currency} />
      <Link valid={trace.integrity.intent_cart_links_valid} label="hash link valid" />
      <ChainNode label="CART" entity={cart} amount={cart?.amount} currency={cart?.currency} />
      <Link valid={trace.integrity.cart_payment_links_valid} label="hash link valid" />
      <ChainNode label="PAYMENT" entity={payment} amount={payment?.amount} currency={payment?.currency} />
    </div>
    <p className={`mt-5 flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium ${trace.integrity.chain_valid ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}><CheckCircle2 className="size-4" />Cryptographic chain {trace.integrity.chain_valid ? "verified" : "requires attention"}</p>
  </section>;
}

export default MandateChain;
