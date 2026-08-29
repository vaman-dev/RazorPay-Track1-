import { createContext, useContext, useEffect, useReducer, type ReactNode } from "react";
import type { Product, CartItem, CommerceCart } from "../types/commerce";

type CartState = CommerceCart;

type CartAction =
  | { type: "ADD_ITEM"; product: Product; quantity: number }
  | { type: "REMOVE_ITEM"; productId: string }
  | { type: "INCREMENT_QUANTITY"; productId: string }
  | { type: "DECREMENT_QUANTITY"; productId: string }
  | { type: "SET_QUANTITY"; productId: string; quantity: number }
  | { type: "CLEAR_CART" };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD_ITEM": {
      if (action.product.stock <= 0) return state;
      const existingItem = state.items.find((item) => item.product.id === action.product.id);
      let newItems: CartItem[];
      if (existingItem) {
        newItems = state.items.map((item) =>
          item.product.id === action.product.id
            ? { ...item, quantity: Math.min(item.product.stock, item.quantity + action.quantity) }
            : item
        );
      } else {
        newItems = [...state.items, { product: action.product, quantity: Math.min(action.product.stock, action.quantity) }];
      }
      return computeCart(newItems);
    }
    case "REMOVE_ITEM": {
      const newItems = state.items.filter((item) => item.product.id !== action.productId);
      return computeCart(newItems);
    }
    case "INCREMENT_QUANTITY": {
      const newItems = state.items.map((item) =>
        item.product.id === action.productId
          ? { ...item, quantity: Math.min(item.product.stock, item.quantity + 1) }
          : item
      );
      return computeCart(newItems);
    }
    case "DECREMENT_QUANTITY": {
      const newItems = state.items
        .map((item) =>
          item.product.id === action.productId
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
        .filter((item) => item.quantity > 0);
      return computeCart(newItems);
    }
    case "SET_QUANTITY": {
      if (action.quantity <= 0) {
        const newItems = state.items.filter((item) => item.product.id !== action.productId);
        return computeCart(newItems);
      }
      const newItems = state.items.map((item) =>
        item.product.id === action.productId
          ? { ...item, quantity: Math.min(item.product.stock, action.quantity) }
          : item
      );
      return computeCart(newItems);
    }
    case "CLEAR_CART": {
      return computeCart([]);
    }
    default:
      return state;
  }
}

function computeCart(items: CartItem[]): CommerceCart {
  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  return {
    items,
    subtotal,
    currency: "INR",
    itemCount,
  };
}

const initialState: CartState = {
  items: [],
  subtotal: 0,
  currency: "INR",
  itemCount: 0,
};

const CART_STORAGE_KEY = "mandate-ledger-commerce-cart";

function loadPersistedCart(): CartState {
  if (typeof window === "undefined") return initialState;

  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(CART_STORAGE_KEY) || "[]") as unknown;
    if (!Array.isArray(parsed)) return initialState;
    const items = parsed.filter((item): item is CartItem => {
      const candidate = item as Partial<CartItem>;
      return Boolean(candidate.product?.id) && candidate.quantity !== undefined && Number.isInteger(candidate.quantity) && candidate.quantity > 0;
    }).map((item) => ({ ...item, quantity: Math.min(item.quantity, item.product.stock) })).filter((item) => item.quantity > 0);
    return computeCart(items);
  } catch {
    return initialState;
  }
}

const CartContext = createContext<{
  state: CartState;
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (productId: string) => void;
  incrementQuantity: (productId: string) => void;
  decrementQuantity: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
} | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, initialState, loadPersistedCart);

  useEffect(() => {
    window.sessionStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state.items));
  }, [state.items]);

  const addItem = (product: Product, quantity = 1) => dispatch({ type: "ADD_ITEM", product, quantity: Math.max(1, quantity) });
  const removeItem = (productId: string) => dispatch({ type: "REMOVE_ITEM", productId });
  const incrementQuantity = (productId: string) => dispatch({ type: "INCREMENT_QUANTITY", productId });
  const decrementQuantity = (productId: string) => dispatch({ type: "DECREMENT_QUANTITY", productId });
  const setQuantity = (productId: string, quantity: number) => dispatch({ type: "SET_QUANTITY", productId, quantity });
  const clearCart = () => dispatch({ type: "CLEAR_CART" });

  return (
    <CartContext.Provider value={{ state, addItem, removeItem, incrementQuantity, decrementQuantity, setQuantity, clearCart }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
