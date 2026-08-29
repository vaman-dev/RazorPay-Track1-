import { ShieldCheck } from "lucide-react";
import type { CommerceCart } from "../../types/commerce";

function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price / 100);
}

interface CartSummaryProps {
  cart: CommerceCart;
  onCheckout: () => void;
  disabled?: boolean;
}

export default function CartSummary({ cart, onCheckout, disabled = false }: CartSummaryProps) {
  if (cart.itemCount === 0) return null;

  return (
    <aside className="sticky top-24">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Order Summary</h2>

        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">Subtotal ({cart.itemCount} items)</dt>
            <dd className="font-medium text-slate-950">{formatPrice(cart.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Shipping</dt>
            <dd className="font-medium text-slate-950">Free</dd>
          </div>
          <div className="flex justify-between border-t border-slate-100 pt-3">
            <dt className="font-semibold text-slate-950">Total</dt>
            <dd className="font-semibold text-slate-950">{formatPrice(cart.subtotal)}</dd>
          </div>
        </dl>

        <button
          onClick={onCheckout}
          disabled={disabled}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
        >
          <ShieldCheck className="size-4" aria-hidden="true" />
          Checkout with Mandate Ledger
        </button>

        <p className="mt-3 text-center text-xs text-slate-500">
          Secure checkout requires explicit authorization before payment.
        </p>
      </div>
    </aside>
  );
}