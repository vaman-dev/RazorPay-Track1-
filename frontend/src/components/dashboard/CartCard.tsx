import type { TraceCart } from "../../types/trace";

function CartCard({ cart }: { cart: TraceCart | undefined }) {
  const itemCount = Array.isArray(cart?.items) ? cart.items.length : 0;
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold tracking-[0.14em] text-slate-500">CART</p><p className="mt-2 text-sm font-semibold capitalize text-emerald-700">{cart?.status || "Not created"}</p><p className="mt-2 text-sm text-slate-700">{cart?.merchant || "No cart committed."}</p>{cart && <p className="mt-3 text-xs text-slate-500">{itemCount} item{itemCount === 1 ? "" : "s"} committed</p>}</section>;
}
export default CartCard;
