import { Search, X } from "lucide-react";

interface ProductSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export default function ProductSearch({ value, onChange }: ProductSearchProps) {
  return <div className="relative flex-1"><Search className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-slate-400" aria-hidden="true" /><input type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder="Search products..." className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-10 text-base outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200" aria-label="Search products" />{value && <button type="button" onClick={() => onChange("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label="Clear search"><X className="size-5" aria-hidden="true" /></button>}</div>;
}
