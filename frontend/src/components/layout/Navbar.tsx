import { type FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useCart } from "../../context/CartContext";
import { ShieldCheck, ShoppingCart, Search, Bot } from "lucide-react";

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useCart();
  const [searchQuery, setSearchQuery] = useState("");

  const isActive = (path: string) => location.pathname === path;

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = searchQuery.trim();
    navigate(query ? `/shop?q=${encodeURIComponent(query)}` : "/shop");
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2" aria-label="Mandate Ledger Home">
          <div className="grid size-9 place-items-center rounded-xl bg-slate-950 text-white">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </div>
          <span className="font-semibold text-slate-950">Mandate Ledger</span>
        </Link>

        <nav className="hidden md:flex md:items-center md:gap-6">
          <Link
            to="/shop"
            className={`text-sm font-medium transition-colors ${isActive("/shop") ? "text-slate-950" : "text-slate-500 hover:text-slate-950"}`}
          >
            Shop
          </Link>
          <Link
            to="/assistant"
            className={`text-sm font-medium transition-colors ${isActive("/assistant") ? "text-slate-950" : "text-slate-500 hover:text-slate-950"}`}
          >
            AI Assistant
          </Link>
        </nav>

        <div className="flex items-center gap-4">
          <form onSubmit={handleSearch} className="hidden sm:flex relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search products..."
              className="h-10 w-64 rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-200 placeholder:text-slate-400"
              aria-label="Search products"
            />
          </form>

          <Link
            to="/assistant"
            className="hidden sm:flex items-center gap-1.5 rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            aria-label="Ask AI Assistant"
          >
            <Bot className="size-4" aria-hidden="true" />
            Ask Mandate AI
          </Link>

          <Link
            to="/cart"
            className="relative grid size-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            aria-label={`Cart ${state.itemCount > 0 ? `with ${state.itemCount} items` : "empty"}`}
          >
            <ShoppingCart className="size-5" aria-hidden="true" />
            {state.itemCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-950 px-1.5 text-[10px] font-semibold text-white">
                {state.itemCount > 99 ? "99+" : state.itemCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500 text-center sm:py-1.5">
        Secure checkout powered by Mandate Ledger &mdash; Explicit authorization before payment
      </div>
    </header>
  );
}
