import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, ArrowLeft, CheckCircle, LoaderCircle } from "lucide-react";
import CheckoutSummary from "../components/commerce/CheckoutSummary";
import ConfirmationCard from "../components/chat/ConfirmationCard";
import PolicyViolationCard from "../components/chat/PolicyViolationCard";
import PaymentStatusCard from "../components/payment/PaymentStatusCard";
import { useCart } from "../context/CartContext";
import { approveCheckoutIntent, commitCheckoutCart, CommerceApiError, createCheckoutIntent, getCheckoutPreview, initializeCheckoutPayment, type CheckoutPreviewResponse, type CommerceIntent } from "../services/commerceApi";
import { openRazorpayCheckout } from "../services/razorpay";
import { getTrace } from "../services/traceApi";
import type { PolicyViolation, RazorpayCheckoutAction } from "../types/chat";
import type { CheckoutStage } from "../types/commerce";

function defaultValidity() {
  const value = new Date(Date.now() + 24 * 60 * 60 * 1000);
  value.setMinutes(value.getMinutes() - value.getTimezoneOffset());
  return value.toISOString().slice(0, 16);
}

function formatPrice(amount: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount / 100);
}

export default function CheckoutPage() {
  const { state: cart, clearCart } = useCart();
  const navigate = useNavigate();
  const [preview, setPreview] = useState<CheckoutPreviewResponse | null>(null);
  const [intent, setIntent] = useState<CommerceIntent | null>(null);
  const [stage, setStage] = useState<CheckoutStage>("review");
  const [validUntil, setValidUntil] = useState(defaultValidity);
  const [maximumSpend, setMaximumSpend] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [policyViolation, setPolicyViolation] = useState<PolicyViolation | null>(null);
  const [paymentAction, setPaymentAction] = useState<RazorpayCheckoutAction | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<"opening" | "submitted" | "verifying" | "captured" | "dismissed" | "failed" | null>(null);
  const [paymentDetail, setPaymentDetail] = useState<string>();
  const [checkoutExpired, setCheckoutExpired] = useState(false);

  function handleCheckoutError(requestError: unknown, fallback: string) {
    const apiError = requestError as CommerceApiError;
    if (apiError.code === "CHECKOUT_SESSION_NOT_FOUND" || apiError.code === "CHECKOUT_SESSION_EXPIRED") {
      setCheckoutExpired(true); setPreview(null); setError(null); return;
    }
    setError(requestError instanceof Error ? requestError.message : fallback);
  }

  async function refreshCheckout() {
    if (!cart.itemCount) return;
    setIsLoading(true); setError(null); setCheckoutExpired(false);
    try {
      const trustedCheckout = await getCheckoutPreview({ items: cart.items.map((item) => ({ product_id: item.product.id, quantity: item.quantity })) });
      setPreview(trustedCheckout); setIntent(null); setStage("review"); setMaximumSpend(String(trustedCheckout.amount / 100));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to refresh checkout.");
    } finally { setIsLoading(false); }
  }

  useEffect(() => {
    let mounted = true;
    if (!cart.itemCount) {
      navigate("/cart", { replace: true });
      return undefined;
    }
    void (async () => {
      try {
        setIsLoading(true);
        const trustedCheckout = await getCheckoutPreview({ items: cart.items.map((item) => ({ product_id: item.product.id, quantity: item.quantity })) });
        if (mounted) { setPreview(trustedCheckout); setMaximumSpend(String(trustedCheckout.amount / 100)); setError(null); setCheckoutExpired(false); }
      } catch (requestError) {
        if (mounted) setError(requestError instanceof Error ? requestError.message : "Failed to load checkout preview.");
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [cart.itemCount, cart.items, navigate]);

  const intentConfirmation = useMemo(() => !preview || !intent ? null : ({
    action: "approve_intent",
    title: "Approve authorization?",
    details: { scope: intent.scope, merchant: preview.merchant, max_amount: intent.max_amount, currency: intent.currency, valid_until: intent.valid_until },
  }), [intent, preview]);

  const paymentConfirmation = useMemo(() => !preview ? null : ({
    action: "initiate_payment",
    title: "Confirm payment",
    details: { merchant: preview.merchant, amount: preview.amount, currency: preview.currency },
  }), [preview]);

  async function startAuthorization() {
    if (!preview) return;
    const maxAmount = Math.round(Number(maximumSpend) * 100);
    if (!validUntil || Number.isNaN(new Date(validUntil).getTime())) {
      setError("Select a future authorization expiry before continuing.");
      return;
    }
    if (!Number.isInteger(maxAmount) || maxAmount <= 0) {
      setError("Enter a valid maximum authorization amount.");
      return;
    }
    setIsBusy(true); setError(null); setPolicyViolation(null);
    try {
      const created = await createCheckoutIntent(preview.checkout_id, new Date(validUntil).toISOString(), maxAmount);
      setIntent(created); setStage("authorization_pending");
    } catch (requestError) {
      handleCheckoutError(requestError, "Unable to create authorization.");
    } finally { setIsBusy(false); }
  }

  async function approveAuthorization() {
    if (!preview) return;
    setIsBusy(true); setError(null);
    try {
      await approveCheckoutIntent(preview.checkout_id);
      await commitCheckoutCart(preview.checkout_id);
      setStage("payment_confirmation");
    } catch (requestError) {
      const apiError = requestError as CommerceApiError;
      setPolicyViolation(apiError.policyViolation ?? null);
      if (!apiError.policyViolation) handleCheckoutError(requestError, "Unable to approve the authorization or commit the Cart.");
    } finally { setIsBusy(false); }
  }

  async function confirmPayment() {
    if (!preview) return;
    setIsBusy(true); setError(null);
    try {
      const result = await initializeCheckoutPayment(preview.checkout_id);
      setPaymentAction(result.action); setStage("payment_processing"); openPaymentCheckout(result.action);
    } catch (requestError) {
      handleCheckoutError(requestError, "Unable to initialize payment."); setStage("payment_confirmation");
    } finally { setIsBusy(false); }
  }

  function openPaymentCheckout(action: RazorpayCheckoutAction) {
    setPaymentStatus("opening");
    try {
      openRazorpayCheckout(action, {
        onSubmitted: () => { setPaymentStatus("submitted"); setStage("payment_verifying"); void verifyPayment(action); },
        onDismissed: () => { setPaymentStatus("dismissed"); setStage("payment_confirmation"); },
        onFailed: () => { setPaymentStatus("verifying"); setPaymentDetail("Payment attempt failed. Verifying the server record…"); setStage("payment_verifying"); void verifyPayment(action, true); },
      });
    } catch (checkoutError) {
      setPaymentStatus("failed"); setPaymentDetail(checkoutError instanceof Error ? checkoutError.message : "Unable to open Razorpay Checkout."); setStage("failed");
    }
  }

  async function verifyPayment(action: RazorpayCheckoutAction, clientFailed = false) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        const trace = await getTrace(action.trace_id);
        const payment = trace.payments.find((entry) => entry.id === action.payment_id);
        if (payment?.status === "captured") {
          setPaymentStatus("captured"); setStage("captured"); clearCart();
          navigate(`/order/${encodeURIComponent(preview?.checkout_id || "")}/${encodeURIComponent(action.trace_id)}`, { replace: true });
          return;
        }
        if (payment?.status === "failed") {
          setPaymentStatus("failed"); setPaymentDetail(payment.failure_detail || "The payment attempt was recorded, but no successful capture exists in Mandate Ledger."); setStage("failed"); return;
        }
      } catch { /* a later poll may observe the verified webhook state */ }
      await new Promise((resolve) => window.setTimeout(resolve, 1500));
    }
    if (clientFailed) setPaymentDetail("Payment attempt failed. Awaiting server confirmation.");
  }

  if (isLoading) return <LoadingState />;
  if (!preview) return <ErrorState message={error || "Unable to load checkout."} expired={checkoutExpired} onRefresh={() => void refreshCheckout()} />;

  return <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
    <Link to="/cart" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-950"><ArrowLeft className="size-4" />Back to Cart</Link>
    <header className="mb-8"><h1 className="text-3xl font-bold tracking-tight text-slate-950">Secure Checkout</h1><p className="mt-1 text-slate-500">Your commerce total is server-verified before Mandate Ledger authorization.</p></header>
    <div className="grid gap-8 lg:grid-cols-3"><div className="space-y-6 lg:col-span-2">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="border-b border-slate-200 px-5 py-4 sm:px-6"><h2 className="text-lg font-semibold text-slate-950">Trusted order · {preview.itemCount} item{preview.itemCount === 1 ? "" : "s"}</h2></div><div className="divide-y divide-slate-100 px-5 sm:px-6">{preview.items.map((item) => <div key={item.product_id} className="flex justify-between gap-4 py-5"><div><p className="font-medium text-slate-950">{item.name}</p><p className="mt-0.5 text-sm text-slate-500">{item.merchant} · Qty {item.quantity}</p><p className="mt-1 text-sm text-slate-600">{formatPrice(item.unit_amount)} each</p></div><p className="shrink-0 font-semibold text-slate-950">{formatPrice(item.line_amount)}</p></div>)}</div></section>
      {stage === "review" && <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"><h2 className="font-semibold text-slate-950">Authorization details</h2><p className="mt-1 text-sm text-slate-500">The cart total is trusted by the server. Choose a maximum spend limit and approve it explicitly.</p><label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="maximum-spend">Maximum authorization (INR)</label><input id="maximum-spend" type="number" min="1" step="0.01" value={maximumSpend} onChange={(event) => setMaximumSpend(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-950" /><label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="valid-until">Valid until</label><input id="valid-until" type="datetime-local" value={validUntil} min={new Date().toISOString().slice(0, 16)} onChange={(event) => setValidUntil(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-950" /></section>}
      {intentConfirmation && stage === "authorization_pending" && <ConfirmationCard confirmation={intentConfirmation} disabled={isBusy} onConfirm={() => void approveAuthorization()} onCancel={() => navigate("/cart")} />}
      {paymentConfirmation && stage === "payment_confirmation" && <ConfirmationCard confirmation={paymentConfirmation} disabled={isBusy} onConfirm={() => void confirmPayment()} onCancel={() => setPaymentStatus("dismissed")} />}
      {policyViolation && <PolicyViolationCard violation={policyViolation} disabled={isBusy} onModifyPurchase={() => navigate("/cart")} onRequestNewAuthorization={() => navigate("/cart")} />}
      {paymentStatus && <PaymentStatusCard status={paymentStatus} detail={paymentDetail} amount={preview.amount} currency={preview.currency} traceId={paymentAction?.trace_id || preview.trace_id || undefined} onRetry={paymentStatus === "failed" ? () => void confirmPayment() : undefined} />}
      {error && <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertCircle className="size-5 shrink-0" />{error}</div>}
    </div><CheckoutSummary preview={preview} onAuthorize={() => void startAuthorization()} disabled={isBusy || stage !== "review"} /></div>
    <div className="mt-8 rounded-2xl bg-slate-50 p-5"><div className="flex gap-3"><CheckCircle className="mt-0.5 size-5 shrink-0 text-emerald-600" /><p className="text-sm text-slate-600"><strong className="text-slate-950">Trusted checkout:</strong> products, quantities and total are loaded from a server-side checkout session. Payment starts only after authorization and payment confirmation.</p></div></div>
  </div>;
}

function LoadingState() { return <div className="grid min-h-96 place-items-center"><div className="flex flex-col items-center gap-3 text-slate-500"><LoaderCircle className="size-8 animate-spin" /><p>Loading trusted checkout…</p></div></div>; }
function ErrorState({ message, expired = false, onRefresh }: { message: string; expired?: boolean; onRefresh?: () => void }) { return <div className="mx-auto max-w-md px-4 py-20 text-center"><AlertCircle className="mx-auto size-9 text-red-600" /><h1 className="mt-4 text-2xl font-semibold">{expired ? "Checkout expired" : "Unable to load checkout"}</h1><p className="mt-2 text-slate-500">{expired ? "Your product selection is still available, but its trusted checkout snapshot has expired." : message}</p><div className="mt-6 flex justify-center gap-3">{expired && <button type="button" onClick={onRefresh} className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Refresh secure checkout</button>}<Link to="/cart" className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-800">Return to cart</Link></div></div>; }
