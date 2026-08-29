import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Bot, ShieldCheck, CreditCard, CheckCircle } from "lucide-react";
import { getFeaturedProducts } from "../services/commerceApi";
import ProductGrid from "../components/commerce/ProductGrid";
import type { Product } from "../types/commerce";

export default function HomePage() {
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);

  useEffect(() => {
    getFeaturedProducts().then(setFeaturedProducts);
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-3xl text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-950 text-white">
          <ShieldCheck className="size-8" aria-hidden="true" />
        </div>
        <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
          Shop with AI. Stay within your limits.
        </h1>
        <p className="mt-4 text-lg text-slate-500">
          Delegate purchases without giving up control. Explicit authorization before every payment.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            to="/shop"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-6 py-3 text-base font-semibold text-white transition hover:bg-slate-800 sm:w-auto"
          >
            Shop Products
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          <Link
            to="/assistant"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-base font-semibold text-slate-950 transition hover:bg-slate-50 sm:w-auto"
          >
            <Bot className="size-4" aria-hidden="true" />
            Ask AI Assistant
          </Link>
        </div>
      </section>

      <section className="mt-16 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-slate-950">Featured Products</h2>
          <Link
            to="/shop"
            className="text-sm font-medium text-slate-950 hover:text-slate-700"
          >
            View all
            <ArrowRight className="size-4 ml-1 inline" aria-hidden="true" />
          </Link>
        </div>
        <ProductGrid products={featuredProducts.slice(0, 8)} emptyMessage="No featured products available." />
      </section>

      <section className="mt-16 rounded-2xl bg-slate-950 p-8 text-center text-white sm:p-12">
        <h2 className="text-2xl font-semibold sm:text-3xl">How it works</h2>
        <p className="mt-2 text-slate-300 max-w-2xl mx-auto">
          AI-assisted commerce with explicit authorization at every step.
        </p>
        <div className="mt-10 grid gap-8 sm:grid-cols-3">
          <Step icon={Bot} title="Express Intent" description="Tell the AI what you want to buy or browse the shop." />
          <Step icon={CreditCard} title="Authorize" description="Review and approve the exact amount before any payment." />
          <Step icon={CheckCircle} title="Verified Payment" description="Payment executes only after your explicit confirmation." />
        </div>
      </section>

      <section className="mt-16 border-t border-slate-200 pt-12">
        <h2 className="text-2xl font-semibold text-center text-slate-950">
          Intent &rarr; Cart &rarr; Payment &rarr; Proof
        </h2>
      </section>
    </div>
  );
}

function Step({ icon: Icon, title, description }: { icon: React.ComponentType<{ className?: string }>; title: string; description: string }) {
  return (
    <div className="space-y-3">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800 text-white">
        <Icon className="size-6" aria-hidden="true" />
      </div>
      <div className="text-center">
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-sm text-slate-300">{description}</p>
      </div>
    </div>
  );
}