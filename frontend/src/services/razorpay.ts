import type { RazorpayCheckoutAction } from "../types/chat";
import type { RazorpayCallbacks } from "../types/razorpay";

export function openRazorpayCheckout(
  action: RazorpayCheckoutAction,
  callbacks: RazorpayCallbacks,
) {
  if (typeof window.Razorpay !== "function") {
    throw new Error("Razorpay Checkout could not be loaded. Check your internet connection and reload the page.");
  }

  const { key_id, order_id, amount, currency } = action.checkout;

  if (!key_id || !order_id || !amount || !currency) {
    throw new Error("Incomplete Razorpay checkout configuration received.");
  }

  let checkoutResolved = false;
  const razorpay = new window.Razorpay({
    key: key_id,
    amount,
    currency,
    order_id,
    name: "Mandate Ledger",
    description: `Authorized purchase for ${action.cart_id}`,
    theme: { color: "#0f172a" },
    handler(response) {
      checkoutResolved = true;
      callbacks.onSubmitted(response);
    },
    modal: {
      ondismiss() {
        if (!checkoutResolved) {
          checkoutResolved = true;
          callbacks.onDismissed();
        }
      },
    },
  });

  razorpay.on("payment.failed", (response) => {
    checkoutResolved = true;
    callbacks.onFailed(response.error?.description || "Unknown payment error.");
  });

  razorpay.open();
}
