import { Filter } from "lucide-react";
import type { ProductCategory } from "../../types/commerce";

interface ProductFiltersProps {
  value: ProductCategory | "All";
  onChange: (value: ProductCategory | "All") => void;
  variant: "compact" | "sidebar";
}

const categories: ProductCategory[] = ["Footwear", "Electronics", "Accessories"];

export default function ProductFilters({ value, onChange, variant }: ProductFiltersProps) {
  if (variant === "compact") return <div className="flex items-center gap-2"><Filter className="size-5 text-slate-400" aria-hidden="true" /><select value={value} onChange={(event) => onChange(event.target.value as ProductCategory | "All")} className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200" aria-label="Filter by category"><option value="All">All Categories</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></div>;
  return <aside className="hidden w-48 shrink-0 lg:block"><h3 className="text-sm font-semibold text-slate-950">Categories</h3><nav className="mt-3 space-y-1" aria-label="Product categories"><FilterButton active={value === "All"} onClick={() => onChange("All")}>All</FilterButton>{categories.map((category) => <FilterButton key={category} active={value === category} onClick={() => onChange(category)}>{category}</FilterButton>)}</nav></aside>;
}

function FilterButton({ active, children, onClick }: { active: boolean; children: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${active ? "bg-slate-950 text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-950"}`}>{children}</button>;
}
