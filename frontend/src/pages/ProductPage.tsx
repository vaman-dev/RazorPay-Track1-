import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Minus, Plus, ShieldCheck, Star, Truck, RotateCcw, Shield } from "lucide-react";
import { getProductById } from "../services/commerceApi";
import { useCart } from "../context/CartContext";
import type { Product } from "../types/commerce";

function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price / 100);
}

export default function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const { addItem } = useCart();

  useEffect(() => {
    if (slug) {
      setIsLoading(true);
      setProduct(null);
      getProductById(slug).then((p) => {
        if (p) setProduct(p);
      }).finally(() => {
        setIsLoading(false);
      });
    }
  }, [slug]);

  if (!product) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="text-center">
          {isLoading ? <p className="text-slate-500">Loading product...</p> : <><h1 className="text-2xl font-semibold text-slate-950">Product not found</h1><p className="mt-2 text-slate-500">This product may no longer be available.</p><Link to="/shop" className="mt-6 inline-flex rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">Browse products</Link></>}
        </div>
      </div>
    );
  }

  const handleAddToCart = () => {
    addItem(product, quantity);
  };

  const maxQuantity = product.stock;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link to="/shop" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-950">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to Shop
      </Link>

      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <div className="aspect-square rounded-2xl bg-slate-100 overflow-hidden">
            <img
              src={product.image}
              alt={product.name}
              className="h-full w-full object-cover"
            />
          </div>
          {product.images && product.images.length > 1 && (
            <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
              {product.images.map((image, index) => (
                <button
                  key={index}
                  className="h-20 w-20 shrink-0 rounded-xl border-2 overflow-hidden transition border-slate-200 hover:border-slate-400"
                  aria-label={`View image ${index + 1}`}
                >
                  <img src={image} alt={`${product.name} ${index + 1}`} className="h-full w-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
              {product.category}
            </span>
            <p className="mt-2 text-sm text-slate-500">{product.merchant}</p>
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            {product.name}
          </h1>

          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold text-slate-950">{formatPrice(product.price)}</span>
            {product.rating && (
              <div className="flex items-center gap-1.5 text-slate-500">
                <Star className="size-4 fill-yellow-400 text-yellow-400" aria-hidden="true" />
                <span className="font-medium">{product.rating.toFixed(1)}</span>
                {product.reviewCount && (
                  <span className="text-slate-400">({product.reviewCount} reviews)</span>
                )}
              </div>
            )}
          </div>

          <p className="text-slate-600 leading-relaxed">{product.description}</p>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center gap-3 text-sm text-slate-700">
              <Truck className="size-5 text-slate-400" aria-hidden="true" />
              <span>Free shipping</span>
            </div>
            <div className="mt-3 flex items-center gap-3 text-sm text-slate-700">
              <RotateCcw className="size-5 text-slate-400" aria-hidden="true" />
              <span>30-day returns</span>
            </div>
            <div className="mt-3 flex items-center gap-3 text-sm text-slate-700">
              <Shield className="size-5 text-slate-400" aria-hidden="true" />
              <span>Secure checkout with Mandate Ledger</span>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="quantity" className="block text-sm font-medium text-slate-950">
                Quantity
              </label>
              <div className="mt-2 flex items-center gap-3">
                <div className="flex items-center border border-slate-200 rounded-xl">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                    className="h-12 w-12 grid place-items-center text-slate-500 hover:text-slate-950 hover:bg-slate-50 rounded-l-xl transition disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="size-4" aria-hidden="true" />
                  </button>
                  <input
                    id="quantity"
                    type="number"
                    value={quantity}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val) && val >= 1 && val <= maxQuantity) {
                        setQuantity(val);
                      }
                    }}
                    min={1}
                    max={maxQuantity}
                    className="w-16 border-x border-slate-200 bg-white text-center text-base font-medium outline-none"
                    aria-label="Quantity"
                  />
                  <button
                    onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
                    disabled={quantity >= maxQuantity}
                    className="h-12 w-12 grid place-items-center text-slate-500 hover:text-slate-950 hover:bg-slate-50 rounded-r-xl transition disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Increase quantity"
                  >
                    <Plus className="size-4" aria-hidden="true" />
                  </button>
                </div>
                <span className="text-sm text-slate-500">In stock: {product.stock}</span>
              </div>
            </div>

            <button
              onClick={handleAddToCart}
              disabled={product.stock === 0}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-6 py-3 text-base font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
            >
              <ShieldCheck className="size-5" aria-hidden="true" />
              Add to Cart
            </button>
          </div>

          <p className="text-sm text-slate-500 text-center">
            Secure AI-assisted checkout available through Mandate Ledger
          </p>
        </div>
      </div>
    </div>
  );
}
