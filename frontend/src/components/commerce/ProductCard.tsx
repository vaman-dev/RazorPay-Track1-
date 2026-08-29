import { Link } from "react-router-dom";
import { ShoppingCart, Star } from "lucide-react";
import type { Product } from "../../types/commerce";
import { useCart } from "../../context/CartContext";

function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price / 100);
}

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addItem } = useCart();

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      <Link
        to={`/product/${product.slug}`}
        className="relative aspect-square overflow-hidden"
        aria-label={`View ${product.name}`}
      >
        <img
          src={product.image}
          alt={product.name}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
        {product.featured && (
          <span className="absolute left-2 top-2 rounded-full bg-slate-950/90 px-2 py-0.5 text-xs font-medium text-white">
            Featured
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
            {product.category}
          </span>
          {product.rating && (
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <Star className="size-3 fill-yellow-400 text-yellow-400" aria-hidden="true" />
              <span>{product.rating.toFixed(1)}</span>
              {product.reviewCount && (
                <span className="text-slate-400">({product.reviewCount})</span>
              )}
            </div>
          )}
        </div>

        <Link to={`/product/${product.slug}`} className="mt-2 block">
          <h3 className="text-base font-semibold text-slate-950 line-clamp-1 group-hover:text-slate-700">
            {product.name}
          </h3>
        </Link>

        <p className="mt-1 line-clamp-2 text-sm text-slate-500">{product.shortDescription}</p>

        <div className="mt-auto flex items-center justify-between pt-4">
          <span className="text-lg font-semibold text-slate-950">{formatPrice(product.price)}</span>
          <button
            onClick={() => addItem(product)}
            disabled={product.stock === 0}
            className="flex h-9 items-center justify-center gap-1.5 rounded-xl bg-slate-950 px-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
            aria-label={`Add ${product.name} to cart`}
          >
            <ShoppingCart className="size-4" aria-hidden="true" />
            Add
          </button>
        </div>
      </div>
    </article>
  );
}