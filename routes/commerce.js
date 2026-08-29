import express from "express";
import { computeCheckoutPreview } from "../services/commerceCheckoutService.js";

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

    return res.status(200).json({
      success: true,
      data: preview,
    });
  } catch (error) {
    next(error);
  }
});

export default router;