import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useCart } from "../context/CartContext";
import CartItem from "../components/commerce/CartItem";
import CartSummary from "../components/commerce/CartSummary";

export default function CartPage() {
  const { state: cart } = useCart();
  const navigate = useNavigate();

  const handleCheckout = () => {
    // Phase 7B: navigate to trusted checkout preview
    navigate("/checkout");
  };

  if (cart.itemCount === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-md text-center">
          <Link to="/shop" className="mb-8 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-950">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Continue Shopping
          </Link>
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100">
            <svg className="size-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2v-4" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 11l5-5-5-5" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-slate-950">Your cart is empty</h1>
          <p className="mt-2 text-slate-500">Looks like you haven't added any products yet.</p>
          <Link
            to="/shop"
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-6 py-3 text-base font-semibold text-white transition hover:bg-slate-800"
          >
            Shop Products
            <ArrowLeft className="size-4 -rotate-90" aria-hidden="true" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link to="/shop" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-950">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Continue Shopping
      </Link>

      <h1 className="mb-8 text-3xl font-bold tracking-tight text-slate-950">Your Cart</h1>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
              <h2 className="text-lg font-semibold text-slate-950">
                {cart.itemCount} item{cart.itemCount !== 1 ? "s" : ""}
              </h2>
            </div>
            <div className="divide-y divide-slate-100 p-5 sm:p-6">
              {cart.items.map((item) => (
                <CartItem key={item.product.id} item={item} />
              ))}
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-lg font-semibold text-slate-950">Secure Checkout</h3>
            <p className="mt-2 text-sm text-slate-500">
              Checkout with Mandate Ledger requires explicit authorization before any payment is processed.
              You'll review and approve the exact amount before payment.
            </p>
          </div>
        </div>

        <CartSummary cart={cart} onCheckout={handleCheckout} />
      </div>
    </div>
  );
}
