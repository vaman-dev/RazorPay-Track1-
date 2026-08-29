import type { Product } from "../types/commerce";
import { getProducts as getProductsData, getProductById as getProductByIdData } from "../data/products";

export async function getProducts(): Promise<Product[]> {
  return getProductsData();
}

export async function getProductById(id: string): Promise<Product | undefined> {
  return getProductByIdData(id);
}

export async function getProductsByCategory(category: Product["category"]): Promise<Product[]> {
  const allProducts = await getProducts();
  return allProducts.filter((product) => product.category === category);
}

export async function getFeaturedProducts(): Promise<Product[]> {
  const allProducts = await getProducts();
  return allProducts.filter((product) => product.featured);
}