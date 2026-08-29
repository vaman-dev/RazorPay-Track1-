import { Minus, Plus } from "lucide-react";

interface QuantitySelectorProps {
  value: number;
  min?: number;
  max: number;
  onChange: (quantity: number) => void;
  label?: string;
}

export default function QuantitySelector({
  value,
  min = 1,
  max,
  onChange,
  label = "Quantity",
}: QuantitySelectorProps) {
  const canDecrease = value > min;
  const canIncrease = value < max;

  return (
    <div className="flex items-center rounded-xl border border-slate-200 bg-white">
      <button type="button" onClick={() => onChange(value - 1)} disabled={!canDecrease} className="grid size-10 place-items-center rounded-l-xl text-slate-500 transition hover:bg-slate-50 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50" aria-label={`Decrease ${label}`}>
        <Minus className="size-4" aria-hidden="true" />
      </button>
      <input aria-label={label} type="number" min={min} max={max} value={value} onChange={(event) => {
        const next = Number.parseInt(event.target.value, 10);
        if (Number.isFinite(next)) onChange(Math.max(min, Math.min(max, next)));
      }} className="h-10 w-12 border-x border-slate-200 text-center text-sm font-medium outline-none" />
      <button type="button" onClick={() => onChange(value + 1)} disabled={!canIncrease} className="grid size-10 place-items-center rounded-r-xl text-slate-500 transition hover:bg-slate-50 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50" aria-label={`Increase ${label}`}>
        <Plus className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
