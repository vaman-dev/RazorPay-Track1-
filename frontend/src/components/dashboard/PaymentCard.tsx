import type { TracePayment } from "../../types/trace";

function PaymentCard({ payment }: { payment: TracePayment | undefined }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold tracking-[0.14em] text-slate-500">PAYMENT</p><p className={`mt-2 text-sm font-semibold capitalize ${payment?.status === "captured" ? "text-emerald-700" : payment?.status === "failed" ? "text-red-700" : "text-amber-700"}`}>{payment?.status || "Not initiated"}</p><p className="mt-2 break-all text-sm text-slate-700">{payment?.razorpay_payment_id || payment?.razorpay_order_id || "Payment gateway record pending."}</p>{payment?.failure_detail && <p className="mt-3 text-xs text-red-700">{payment.failure_detail}</p>}</section>;
}
export default PaymentCard;
