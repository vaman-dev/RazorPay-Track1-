import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { getProducts } from "../services/commerceApi";
import ProductGrid from "../components/commerce/ProductGrid";
import ProductFilters from "../components/commerce/ProductFilters";
import ProductSearch from "../components/commerce/ProductSearch";
import type { Product, ProductCategory } from "../types/commerce";

export default function ShopPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get("q") || "");
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | "All">("All");

  useEffect(() => {
    getProducts().then(setProducts);
  }, []);

  useEffect(() => {
    setSearchQuery(searchParams.get("q") || "");
  }, [searchParams]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.shortDescription.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.merchant.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === "All" || product.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-950">Shop</h1>
        <p className="mt-1 text-slate-500">Find what you need.</p>
      </div>

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <ProductSearch value={searchQuery} onChange={setSearchQuery} />
        <ProductFilters value={selectedCategory} onChange={setSelectedCategory} variant="compact" />
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <ProductFilters value={selectedCategory} onChange={setSelectedCategory} variant="sidebar" />

        <div className="flex-1">
          <p className="mb-4 text-sm text-slate-500">
            {filteredProducts.length} product{filteredProducts.length !== 1 ? "s" : ""} found
          </p>
          <ProductGrid
            products={filteredProducts}
            emptyMessage={
              <div className="py-12 text-center">
                <p className="text-slate-500">No products match your filters.</p>
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedCategory("All");
                  }}
                  className="mt-2 text-sm font-medium text-slate-950 underline"
                >
                  Clear filters
                </button>
              </div>
            }
          />
        </div>
      </div>
    </div>
  );
}
