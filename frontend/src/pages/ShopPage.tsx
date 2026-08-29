import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Filter, X } from "lucide-react";
import { getProducts } from "../services/commerceApi";
import ProductGrid from "../components/commerce/ProductGrid";
import type { Product, ProductCategory } from "../types/commerce";

const CATEGORIES: ProductCategory[] = ["Footwear", "Electronics", "Accessories"];

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
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products..."
            className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-base outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 placeholder:text-slate-400"
            aria-label="Search products"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              aria-label="Clear search"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Filter className="size-5 text-slate-400" aria-hidden="true" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as ProductCategory | "All")}
            className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            aria-label="Filter by category"
          >
            <option value="All">All Categories</option>
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <aside className="hidden lg:block w-48 shrink-0">
          <h3 className="text-sm font-semibold text-slate-950">Categories</h3>
          <nav className="mt-3 space-y-1" aria-label="Product categories">
            <button
              onClick={() => setSelectedCategory("All")}
              className={`w-full text-left rounded-lg px-3 py-2 text-sm transition ${
                selectedCategory === "All"
                  ? "bg-slate-950 text-white"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-950"
              }`}
            >
              All
            </button>
            {CATEGORIES.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`w-full text-left rounded-lg px-3 py-2 text-sm transition ${
                  selectedCategory === category
                    ? "bg-slate-950 text-white"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-950"
                }`}
              >
                {category}
              </button>
            ))}
          </nav>
        </aside>

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
