import { CircleAlert, PencilLine, PlusCircle } from "lucide-react";
import type { PolicyViolation } from "../../types/chat";
import { formatMoney } from "../../utils/presentation";

interface PolicyViolationCardProps {
  violation: PolicyViolation;
  disabled?: boolean;
  onModifyPurchase: () => void;
  onRequestNewAuthorization: () => void;
}

function PolicyViolationCard({
  violation,
  disabled = false,
  onModifyPurchase,
  onRequestNewAuthorization,
}: PolicyViolationCardProps) {
  const details = violation.details;
  const currency = details?.currency || "INR";

  if (violation.code === "SCOPE_NOT_ALLOWED") {
    return <section className="mt-3 w-full max-w-md overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm" aria-label="Authorization scope policy block">
      <div className="flex items-start gap-3 border-b border-amber-100 bg-amber-50 px-4 py-4 text-amber-950"><div className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-200 text-amber-900"><CircleAlert className="size-5" /></div><div><p className="text-sm font-semibold">Purchase outside authorization</p><p className="mt-0.5 text-xs text-amber-800">Policy block — payment was not initiated</p></div></div>
      <div className="space-y-3 px-4 py-4"><DetailRow label="Authorized for" value={details?.scope || details?.allowed_categories?.join(", ") || "Approved products"} /><DetailRow label="Requested product" value={details?.product_name || "Trusted catalog product"} /><DetailRow label="Product category" value={details?.requested_category || "Outside approved scope"} />{typeof details?.requested_amount === "number" && <DetailRow label="Purchase amount" value={formatMoney(details.requested_amount, currency)} />}<p className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm leading-5 text-slate-600">This trusted product is outside the purchase scope you approved. Available budget cannot be used across a different scope.</p></div>
      <div className="grid gap-2 border-t border-slate-100 bg-slate-50 p-3 sm:grid-cols-2"><button type="button" disabled={disabled} onClick={onModifyPurchase} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"><PencilLine className="size-4" />Choose another product</button><button type="button" disabled={disabled} onClick={onRequestNewAuthorization} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"><PlusCircle className="size-4" />Create new authorization</button></div>
    </section>;
  }

  if (violation.code !== "CAP_EXCEEDED") return null;

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
        <DetailRow label="Authorized" value={formatMoney(details?.authorized_amount, currency)} />
        {typeof details?.committed_amount === "number" && <DetailRow label="Already committed" value={formatMoney(details.committed_amount, currency)} />}
        {typeof details?.remaining_amount === "number" && <DetailRow label="Available" value={formatMoney(details.remaining_amount, currency)} />}
        <DetailRow label="Purchase amount" value={formatMoney(details?.requested_amount, currency)} />
        <DetailRow label="Amount over limit" value={formatMoney(details?.excess_amount, currency)} emphasized />
        <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm leading-5 text-slate-600">
          This purchase was blocked before payment because it exceeds your available authorization.
        </p>
      </div>

      <div className="grid gap-2 border-t border-slate-100 bg-slate-50 p-3 sm:grid-cols-2">
        <button type="button" disabled={disabled} onClick={onModifyPurchase} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">
          <PencilLine className="size-4" aria-hidden="true" />Modify purchase
        </button>
        <button type="button" disabled={disabled} onClick={onRequestNewAuthorization} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400">
          <PlusCircle className="size-4" aria-hidden="true" />Create new authorization
        </button>
      </div>
    </section>
  );
}

function DetailRow({ label, value, emphasized = false }: { label: string; value: string; emphasized?: boolean }) {
  return <div className="flex justify-between gap-5 text-sm"><span className="text-slate-500">{label}</span><span className={emphasized ? "font-semibold text-amber-800" : "font-medium text-slate-900"}>{value}</span></div>;
}

export default PolicyViolationCard;
