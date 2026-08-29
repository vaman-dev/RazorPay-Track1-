import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="space-y-4">
            <Link to="/" className="flex items-center gap-2" aria-label="Mandate Ledger Home">
              <div className="grid size-9 place-items-center rounded-xl bg-slate-950 text-white">
                <ShieldCheck className="size-5" aria-hidden="true" />
              </div>
              <span className="font-semibold text-slate-950">Mandate Ledger</span>
            </Link>
            <p className="text-sm text-slate-500">
              Delegate purchases without giving up control.
            </p>
          </div>

          <nav className="space-y-3" aria-label="Product">
            <h3 className="text-sm font-semibold text-slate-950">Product</h3>
            <Link to="/shop" className="block text-sm text-slate-500 hover:text-slate-950">
              Shop Products
            </Link>
            <Link to="/assistant" className="block text-sm text-slate-500 hover:text-slate-950">
              AI Assistant
            </Link>
          </nav>

          <nav className="space-y-3" aria-label="Company">
            <h3 className="text-sm font-semibold text-slate-950">Company</h3>
            <a href="#" className="block text-sm text-slate-500 hover:text-slate-950">
              About
            </a>
            <a href="#" className="block text-sm text-slate-500 hover:text-slate-950">
              Security
            </a>
            <a href="#" className="block text-sm text-slate-500 hover:text-slate-950">
              Contact
            </a>
          </nav>

          <nav className="space-y-3" aria-label="Legal">
            <h3 className="text-sm font-semibold text-slate-950">Legal</h3>
            <a href="#" className="block text-sm text-slate-500 hover:text-slate-950">
              Privacy Policy
            </a>
            <a href="#" className="block text-sm text-slate-500 hover:text-slate-950">
              Terms of Service
            </a>
          </nav>
        </div>

        <div className="mt-8 border-t border-slate-200 pt-8 text-center text-sm text-slate-400">
          <p>&copy; {new Date().getFullYear()} Mandate Ledger. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}