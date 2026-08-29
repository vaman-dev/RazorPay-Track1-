import { CircleAlert, PencilLine, PlusCircle } from "lucide-react";
import type { PolicyViolation } from "../../types/chat";

interface PolicyViolationCardProps {
  violation: PolicyViolation;
  disabled?: boolean;
  onModifyPurchase: () => void;
  onRequestNewAuthorization: () => void;
}

function formatMoney(amount?: number, currency = "INR") {
  if (typeof amount !== "number") return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(amount / 100);
}

function PolicyViolationCard({
  violation,
  disabled = false,
  onModifyPurchase,
  onRequestNewAuthorization,
}: PolicyViolationCardProps) {
  if (violation.code !== "CAP_EXCEEDED") return null;

  const details = violation.details;
  const currency = details?.currency || "INR";

  return (
    <section className="mt-3 w-full max-w-md overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm" aria-label="Authorization policy block">
      <div className="flex items-start gap-3 border-b border-amber-100 bg-amber-50 px-4 py-4 text-amber-950">
        <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-200 text-amber-900">
          <CircleAlert className="size-5" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-semibold">Authorization limit exceeded</p>
          <p className="mt-0.5 text-xs text-amber-800">Policy block — payment was not initiated</p>
        </div>
      </div>

      <div className="space-y-3 px-4 py-4">
        <DetailRow label="Authorized amount" value={formatMoney(details?.authorized_amount, currency)} />
        <DetailRow label="Attempted purchase" value={formatMoney(details?.requested_amount, currency)} />
        <DetailRow label="Over authorization" value={formatMoney(details?.excess_amount, currency)} emphasized />
        <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm leading-5 text-slate-600">
          This purchase was blocked before payment initialization because it exceeds the user&apos;s approved spending mandate.
        </p>
      </div>

      <div className="grid gap-2 border-t border-slate-100 bg-slate-50 p-3 sm:grid-cols-2">
        <button type="button" disabled={disabled} onClick={onModifyPurchase} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">
          <PencilLine className="size-4" aria-hidden="true" />Modify purchase
        </button>
        <button type="button" disabled={disabled} onClick={onRequestNewAuthorization} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400">
          <PlusCircle className="size-4" aria-hidden="true" />Request new limit
        </button>
      </div>
    </section>
  );
}

function DetailRow({ label, value, emphasized = false }: { label: string; value: string; emphasized?: boolean }) {
  return <div className="flex justify-between gap-5 text-sm"><span className="text-slate-500">{label}</span><span className={emphasized ? "font-semibold text-amber-800" : "font-medium text-slate-900"}>{value}</span></div>;
}

export default PolicyViolationCard;
