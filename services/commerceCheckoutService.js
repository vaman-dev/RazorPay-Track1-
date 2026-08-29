import { validateProductExists, validateQuantity } from "./catalogService.js";

export function computeCheckoutPreview(items) {
  if (!Array.isArray(items) || items.length === 0) {
    const error = new Error("Cart cannot be empty");
    error.code = "EMPTY_CART";
    error.status = 400;
    throw error;
  }

  const validatedItems = [];
  const productIds = new Set();
  let merchant = null;
  let totalAmount = 0;
  let totalQuantity = 0;

  for (const item of items) {
    if (!item || typeof item !== "object") {
      const error = new Error("Each item must be an object");
      error.code = "INVALID_CART_ITEM";
      error.status = 400;
      throw error;
    }

    const { product_id, quantity } = item;

    if (!product_id || typeof product_id !== "string") {
      const error = new Error("Each item must have a valid product_id");
      error.code = "INVALID_PRODUCT_ID";
      error.status = 400;
      throw error;
    }

    if (productIds.has(product_id)) {
      const error = new Error(`Duplicate product in checkout: ${product_id}`);
      error.code = "DUPLICATE_PRODUCT";
      error.status = 400;
      throw error;
    }

    productIds.add(product_id);

    const product = validateProductExists(product_id);
    validateQuantity(product, quantity);

    if (merchant && merchant !== product.merchant) {
      const error = new Error("Checkout supports products from one merchant only");
      error.code = "MIXED_MERCHANT_CHECKOUT";
      error.status = 422;
      error.details = {
        expected_merchant: merchant,
        received_merchant: product.merchant,
      };
      throw error;
    }

    merchant = product.merchant;

    const unitAmount = product.price;
    const lineAmount = unitAmount * quantity;

    validatedItems.push({
      product_id: product.id,
      name: product.name,
      merchant: product.merchant,
      quantity,
      unit_amount: unitAmount,
      line_amount: lineAmount,
    });

    totalAmount += lineAmount;
    totalQuantity += quantity;
  }

  return {
    items: validatedItems,
    amount: totalAmount,
    currency: "INR",
    itemCount: totalQuantity,
  };
}
