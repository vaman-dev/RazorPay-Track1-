import express from "express";
import { getProducts, getProductById, getProductsByCategory, getFeaturedProducts } from "../services/catalogService.js";

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const { category, featured } = req.query;

    let productList = getProducts();

    if (category && typeof category === "string") {
      productList = getProductsByCategory(category);
    }

    if (featured === "true") {
      productList = getFeaturedProducts();
    }

    return res.status(200).json({
      success: true,
      data: productList,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:productId", async (req, res, next) => {
  try {
    const { productId } = req.params;

    if (!productId) {
      const error = new Error("Product ID is required");
      error.code = "INVALID_PRODUCT_ID";
      error.status = 400;
      throw error;
    }

    const product = getProductById(productId);

    if (!product) {
      const error = new Error(`Product not found: ${productId}`);
      error.code = "PRODUCT_NOT_FOUND";
      error.status = 404;
      throw error;
    }

    return res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
});

export default router;