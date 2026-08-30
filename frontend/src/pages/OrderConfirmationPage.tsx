import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2, ExternalLink, LoaderCircle } from "lucide-react";
import { getCheckout, type CheckoutPreviewResponse } from "../services/commerceApi";
import { getTrace } from "../services/traceApi";
import type { TraceData } from "../types/trace";
import { customerFacingText, formatMoney } from "../utils/presentation";

export default function OrderConfirmationPage() {
  const { checkoutId, traceId } = useParams();
  const [checkout, setCheckout] = useState<CheckoutPreviewResponse | null>(null);
  const [trace, setTrace] = useState<TraceData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!checkoutId || !traceId) return;

    void Promise.all([getCheckout(checkoutId), getTrace(traceId)])
      .then(([trustedCheckout, trustedTrace]) => {
        setCheckout(trustedCheckout);
        setTrace(trustedTrace);
      })
      .catch((requestError) => setError(customerFacingText(
        requestError instanceof Error ? requestError.message : "Unable to load this order.",
      )));
  }, [checkoutId, traceId]);

  if (error) {
    return <div className="mx-auto max-w-lg px-4 py-20 text-center"><h1 className="text-2xl font-semibold">Order confirmation unavailable</h1><p className="mt-2 text-slate-500">{error}</p><Link to="/shop" className="mt-6 inline-flex rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Continue shopping</Link></div>;
  }

  if (!checkout || !trace) {
    return <div className="grid min-h-96 place-items-center text-slate-500"><div className="flex items-center gap-2"><LoaderCircle className="size-5 animate-spin" />Loading order…</div></div>;
  }

  const authorized = trace.summary.authorized_amount;
  const committed = trace.summary.committed_amount;
  const remaining = trace.summary.remaining_amount;
  const reusable = trace.intent?.usage_mode === "reusable_budget";

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-emerald-100 bg-emerald-50 px-6 py-8 text-center">
          <CheckCircle2 className="mx-auto size-11 text-emerald-600" />
          <p className="mt-3 text-sm font-semibold uppercase tracking-wide text-emerald-700">Payment verified</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">Your order is confirmed</h1>
          <p className="mt-2 text-sm text-emerald-800">Transaction integrity: {trace.integrity.chain_valid ? "Verified" : "Needs attention"}</p>
        </div>

        <div className="space-y-5 p-6">
          {checkout.items.map((item) => (
            <div key={item.product_id} className="flex justify-between gap-4">
              <div><p className="font-medium text-slate-950">{item.name}</p><p className="text-sm text-slate-500">{item.merchant} · Qty {item.quantity}</p></div>
              <p className="font-semibold text-slate-950">{formatMoney(item.line_amount, checkout.currency)}</p>
            </div>
          ))}

          <div className="border-t border-slate-100 pt-5">
            <div className="flex justify-between font-semibold text-slate-950"><span>Total paid</span><span>{formatMoney(checkout.amount, checkout.currency)}</span></div>
            <dl className="mt-5 space-y-2 text-sm">
              <SummaryRow label="Authorization" value={reusable ? "Reusable budget" : "Single use"} />
              {authorized !== null && <SummaryRow label="Authorized maximum" value={formatMoney(authorized, checkout.currency)} />}
              {typeof committed !== "undefined" && <SummaryRow label="Committed" value={formatMoney(committed, checkout.currency)} />}
              {reusable && remaining !== null && typeof remaining !== "undefined" && <SummaryRow label="Available authorization" value={formatMoney(remaining, checkout.currency)} emphasized />}
              {!reusable && remaining !== null && typeof remaining !== "undefined" && <SummaryRow label="Unused amount" value={formatMoney(remaining, checkout.currency)} />}
            </dl>
            {!reusable && trace.summary.carts.approved > 0 && <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2.5 text-sm leading-5 text-slate-600">This single-use authorization has been used. The unused amount cannot authorize another purchase.</p>}
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <Link to="/shop" className="inline-flex rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50">Continue shopping</Link>
            <Link to={`/dashboard/${encodeURIComponent(traceId || "")}`} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">View transaction proof<ExternalLink className="size-4" /></Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function SummaryRow({ label, value, emphasized = false }: { label: string; value: string; emphasized?: boolean }) {
  return <div className="flex justify-between gap-4"><dt className="text-slate-500">{label}</dt><dd className={emphasized ? "font-semibold text-emerald-700" : "font-medium text-slate-950"}>{value}</dd></div>;
}
