import { ShieldCheck } from "lucide-react";
import type { CheckoutPreviewResponse } from "../../services/commerceApi";

function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price / 100);
}

interface CheckoutSummaryProps {
  preview: CheckoutPreviewResponse;
  onAuthorize: () => void;
  disabled?: boolean;
}

export default function CheckoutSummary({ preview, onAuthorize, disabled = false }: CheckoutSummaryProps) {
  return (
    <aside className="sticky top-24">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Order Summary</h2>

        <dl className="mt-4 space-y-3 text-sm">
          {preview.items.map((item) => (
            <div key={item.product_id} className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium text-slate-950 truncate">{item.name}</p>
                <p className="text-xs text-slate-500">{item.merchant}</p>
                <p className="mt-0.5 text-sm text-slate-700">Qty: {item.quantity}</p>
              </div>
              <span className="shrink-0 font-medium text-slate-950">{formatPrice(item.line_amount)}</span>
            </div>
          ))}

          <div className="flex justify-between border-t border-slate-100 pt-3">
            <dt className="font-semibold text-slate-950">Total ({preview.itemCount} items)</dt>
            <dd className="font-semibold text-slate-950">{formatPrice(preview.amount)}</dd>
          </div>
        </dl>

        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="size-5 text-emerald-600 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-medium text-slate-950">Mandate Ledger Authorization</p>
              <p className="text-sm text-slate-500">Secure checkout requires explicit authorization before payment.</p>
            </div>
          </div>
        </div>

        <button
          onClick={onAuthorize}
          disabled={disabled}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
        >
          <ShieldCheck className="size-4" aria-hidden="true" />
          Authorize with Mandate Ledger
        </button>
      </div>
    </aside>
  );
}