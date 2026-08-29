import express from "express";
import { computeCheckoutPreview } from "../services/commerceCheckoutService.js";
import {
  createCheckoutSession,
  getPublicCheckoutSession,
} from "../services/checkoutSessionService.js";
import {
  approveCommerceIntent,
  attachCommerceIntent,
  commitCommerceCart,
  createCommerceIntent,
  initializeCommercePayment,
} from "../services/commerceMandateBridge.js";

const router = express.Router();

router.post("/checkout-preview", async (req, res, next) => {
  try {
    const { items } = req.body || {};

    if (!items || !Array.isArray(items)) {
      const error = new Error("Items array is required");
      error.code = "INVALID_ITEMS";
      error.status = 400;
      throw error;
    }

    const preview = computeCheckoutPreview(items);
    const checkout = createCheckoutSession(preview);

    return res.status(200).json({
      success: true,
      data: checkout,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/checkout/:checkoutId", (req, res, next) => {
  try {
    return res.status(200).json({ success: true, data: getPublicCheckoutSession(req.params.checkoutId) });
  } catch (error) {
    next(error);
  }
});

router.post("/checkout/:checkoutId/intent", (req, res, next) => {
  try {
    const intent = createCommerceIntent(
      req.params.checkoutId,
      req.body?.valid_until,
      req.body?.max_amount,
    );
    return res.status(201).json({ success: true, data: { intent } });
  } catch (error) {
    next(error);
  }
});

router.post("/checkout/:checkoutId/attach-intent", (req, res, next) => {
  try {
    const intent = attachCommerceIntent(req.params.checkoutId, req.body?.intent_id);
    return res.status(200).json({ success: true, data: { intent } });
  } catch (error) {
    if (error.code === "SCOPE_NOT_ALLOWED") {
      return res.status(error.status || 422).json({ success: false, error: error.code, message: error.message, policy_violation: { code: error.code, message: error.message, details: error.details } });
    }
    next(error);
  }
});

router.post("/checkout/:checkoutId/approve-intent", (req, res, next) => {
  try {
    const intent = approveCommerceIntent(req.params.checkoutId);
    return res.status(200).json({ success: true, data: { intent } });
  } catch (error) {
    if (error.code === "CAP_EXCEEDED" || error.code === "SCOPE_NOT_ALLOWED") {
      return res.status(error.status || 409).json({
        success: false,
        error: error.code,
        message: error.message,
        policy_violation: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      });
    }
    next(error);
  }
});

router.post("/checkout/:checkoutId/cart", (req, res, next) => {
  try {
    const result = commitCommerceCart(req.params.checkoutId);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    if (error.code === "CAP_EXCEEDED" || error.code === "SCOPE_NOT_ALLOWED") {
      return res.status(error.status || 409).json({ success: false, error: error.code, message: error.message, policy_violation: { code: error.code, message: error.message, details: error.details } });
    }
    next(error);
  }
});

router.post("/checkout/:checkoutId/payment", async (req, res, next) => {
  try {
    const payment = await initializeCommercePayment(req.params.checkoutId);
    return res.status(200).json({
      success: true,
      data: {
        payment,
        idempotent_reuse: Boolean(payment.already_exists),
        action: {
          type: "razorpay_checkout",
          payment_id: payment.id,
          trace_id: payment.trace_id,
          cart_id: payment.cart_id,
          checkout: payment.checkout,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
