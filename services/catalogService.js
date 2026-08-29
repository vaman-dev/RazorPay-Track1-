import { products } from "../data/products.js";

export function getProducts() {
  return products;
}

export function getProductById(productId) {
  return products.find((product) => product.id === productId);
}

export function getProductsByCategory(category) {
  return products.filter((product) => product.category === category);
}

export function getFeaturedProducts() {
  return products.filter((product) => product.featured);
}

export function validateProductExists(productId) {
  const product = getProductById(productId);
  if (!product) {
    const error = new Error(`Product not found: ${productId}`);
    error.code = "PRODUCT_NOT_FOUND";
    error.status = 404;
    throw error;
  }
  return product;
}

export function validateQuantity(product, quantity) {
  if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity <= 0) {
    const error = new Error("Quantity must be a positive integer");
    error.code = "INVALID_QUANTITY";
    error.status = 400;
    throw error;
  }
  if (quantity > product.stock) {
    const error = new Error(`Insufficient stock. Available: ${product.stock}, Requested: ${quantity}`);
    error.code = "INSUFFICIENT_STOCK";
    error.status = 400;
    throw error;
  }
}