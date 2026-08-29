import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, LoaderCircle, AlertCircle, CheckCircle } from "lucide-react";
import { useCart } from "../context/CartContext";
import { getCheckoutPreview, type CheckoutPreviewResponse } from "../services/commerceApi";
import CheckoutSummary from "../components/commerce/CheckoutSummary";

export default function CheckoutPage() {
  const { state: cart } = useCart();
  const navigate = useNavigate();

  const [preview, setPreview] = useState<CheckoutPreviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadPreview() {
      if (cart.itemCount === 0) {
        navigate("/cart");
        return;
      }

      try {
        setIsLoading(true);
        const items = cart.items.map((item: { product: { id: string }; quantity: number }) => ({
          product_id: item.product.id,
          quantity: item.quantity,
        }));
        const data = await getCheckoutPreview({ items });
        if (isMounted) {
          setPreview(data);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          const message = err instanceof Error ? err.message : "Failed to load checkout preview";
          setError(message);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadPreview();

    return () => {
      isMounted = false;
    };
  }, [cart.items, cart.itemCount, navigate]);

  function formatPrice(price: number): string {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(price / 100);
  }

  const handleAuthorize = () => {
    navigate("/assistant");
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
          <p className="mt-2 text-slate-500">Add products to your cart before checkout.</p>
          <Link to="/shop" className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-6 py-3 text-base font-semibold text-white transition hover:bg-slate-800">
            Shop Products
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid min-h-96 place-items-center">
          <div className="flex flex-col items-center gap-4 text-center">
            <LoaderCircle className="size-8 animate-spin text-slate-400" />
            <p className="text-slate-500">Loading checkout preview…</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !preview) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-md text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <AlertCircle className="size-8 text-red-600" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-950">Unable to load checkout</h1>
          <p className="mt-2 text-slate-500">{error || "An unexpected error occurred."}</p>
          <Link to="/cart" className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-6 py-3 text-base font-semibold text-white transition hover:bg-slate-800">
            Back to Cart
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link to="/cart" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-950">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to Cart
      </Link>

      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-950">Secure Checkout</h1>
        <p className="mt-1 text-slate-500">Review your order and authorize payment with Mandate Ledger.</p>
      </header>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
              <h2 className="text-lg font-semibold text-slate-950">
                {preview.itemCount} item{preview.itemCount !== 1 ? "s" : ""}
              </h2>
            </div>
            <div className="divide-y divide-slate-100 p-5 sm:p-6">
              {preview.items.map((item: CheckoutPreviewResponse["items"][0]) => (
                <div key={item.product_id} className="py-4 flex gap-4">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100" aria-hidden="true">
                    <div className="h-full w-full bg-slate-200" />
                  </div>
                  <div className="flex flex-1 flex-col">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-950">{item.name}</p>
                        <p className="mt-0.5 text-sm text-slate-500">{item.merchant}</p>
                        <p className="mt-0.5 text-sm font-medium text-slate-950">{formatPrice(item.line_amount)}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-3">
                      <span className="text-sm text-slate-500">Qty: {item.quantity}</span>
                      <span className="text-sm font-medium text-slate-950">{formatPrice(item.unit_amount)} each</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <CheckoutSummary preview={preview} onAuthorize={handleAuthorize} />
      </div>

      <div className="mt-8 rounded-2xl bg-slate-50 p-5">
        <div className="flex items-start gap-3">
          <CheckCircle className="size-5 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <h3 className="font-semibold text-slate-950">What happens next?</h3>
            <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
              <li>You'll be redirected to the AI Assistant to create a payment authorization.</li>
              <li>Review and approve the exact amount (₹{formatPrice(preview.amount).replace("₹", "")}).</li>
              <li>Payment executes only after your explicit confirmation.</li>
              <li>Receive cryptographic proof of the transaction.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}