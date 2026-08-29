import { Link } from "react-router-dom";
import { Trash2, Minus, Plus } from "lucide-react";
import type { CartItem } from "../../types/commerce";
import { useCart } from "../../context/CartContext";

function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price / 100);
}

interface CartItemProps {
  item: CartItem;
}

export default function CartItem({ item }: CartItemProps) {
  const { incrementQuantity, decrementQuantity, removeItem } = useCart();
  const lineTotal = item.product.price * item.quantity;

  return (
    <div className="flex gap-4 py-4">
      <Link to={`/product/${item.product.id}`} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100" aria-label={`View ${item.product.name}`}>
        <img src={item.product.image} alt={item.product.name} className="h-full w-full object-cover" loading="lazy" />
      </Link>

      <div className="flex flex-1 flex-col">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Link to={`/product/${item.product.id}`} className="font-medium text-slate-950 hover:text-slate-700">
              {item.product.name}
            </Link>
            <p className="mt-0.5 text-sm text-slate-500">{item.product.merchant}</p>
            <p className="mt-0.5 text-sm font-medium text-slate-950">{formatPrice(lineTotal)}</p>
          </div>
          <button
            onClick={() => removeItem(item.product.id)}
            className="shrink-0 text-slate-400 hover:text-red-500 transition"
            aria-label={`Remove ${item.product.name} from cart`}
          >
            <Trash2 className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div className="flex items-center gap-2 border border-slate-200 rounded-xl">
            <button
              onClick={() => decrementQuantity(item.product.id)}
              className="h-9 w-9 grid place-items-center text-slate-500 hover:text-slate-950 hover:bg-slate-50 rounded-l-xl transition"
              aria-label="Decrease quantity"
            >
              <Minus className="size-4" aria-hidden="true" />
            </button>
            <span className="w-10 text-center text-sm font-medium text-slate-950">{item.quantity}</span>
            <button
              onClick={() => incrementQuantity(item.product.id)}
              disabled={item.quantity >= item.product.stock}
              className="h-9 w-9 grid place-items-center text-slate-500 hover:text-slate-950 hover:bg-slate-50 rounded-r-xl transition disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Increase quantity"
            >
              <Plus className="size-4" aria-hidden="true" />
            </button>
          </div>
          <span className="text-sm text-slate-500">Stock: {item.product.stock}</span>
        </div>
      </div>
    </div>
  );
}
