import { Check, CreditCard, ShieldCheck, X } from "lucide-react";
import type { ChatConfirmation } from "../../types/chat";

interface ConfirmationCardProps {
  confirmation: ChatConfirmation;
  disabled?: boolean;
  resolved?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function formatMoney(amount?: number, currency = "INR") {
  if (typeof amount !== "number") return null;

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount / 100);
}

function ConfirmationCard({
  confirmation,
  disabled = false,
  resolved = false,
  onConfirm,
  onCancel,
}: ConfirmationCardProps) {
  const details = confirmation.details;
  const isPayment = confirmation.action === "initiate_payment";
  const amount = isPayment ? details?.amount : details?.max_amount;
  const formattedAmount = isPayment
    ? details?.formatted_amount
    : details?.formatted_max_amount;
  const amountText = formattedAmount || formatMoney(amount, details?.currency);

  return (
    <section className="mt-3 w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-4">
        <div className="grid size-9 place-items-center rounded-xl bg-slate-950 text-white">
          {isPayment ? (
            <CreditCard className="size-4" aria-hidden="true" />
          ) : (
            <ShieldCheck className="size-4" aria-hidden="true" />
          )}
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-950">
            {confirmation.title ||
              (isPayment ? "Confirm payment" : "Authorization required")}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">Explicit approval required</p>
        </div>
      </div>

      <div className="space-y-3 px-4 py-4">
        {details?.scope && <DetailRow label="Scope" value={details.scope} />}
        {details?.merchant && <DetailRow label="Merchant" value={details.merchant} />}
        {amountText && (
          <DetailRow
            label={isPayment ? "Payment amount" : "Maximum spend"}
            value={amountText}
            emphasized
          />
        )}
        {!isPayment && details?.usage_mode && (
          <DetailRow
            label="Authorization type"
            value={details.usage_mode === "reusable_budget" ? "Reusable budget" : "Single use"}
          />
        )}
        {!isPayment && details?.policy?.categories?.length ? (
          <DetailRow label="Allowed categories" value={details.policy.categories.join(", ")} />
        ) : null}
        {!isPayment && details?.policy?.merchant_ids?.length ? (
          <DetailRow label="Allowed merchants" value={details.policy.merchant_ids.join(", ")} />
        ) : null}
        {!isPayment && details?.policy?.product_ids?.length ? (
          <DetailRow label="Allowed products" value={details.policy.product_ids.join(", ")} />
        ) : null}
        {details?.valid_until && (
          <DetailRow
            label="Valid until"
            value={new Date(details.valid_until).toLocaleString()}
          />
        )}
      </div>

      <div className="flex gap-2 border-t border-slate-100 bg-slate-50 p-3">
        <button
          type="button"
          disabled={disabled || resolved}
          onClick={onCancel}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <X className="size-4" aria-hidden="true" />
          Cancel
        </button>
        <button
          type="button"
          disabled={disabled || resolved}
          onClick={onConfirm}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          <Check className="size-4" aria-hidden="true" />
          {isPayment ? "Confirm payment" : "Approve"}
        </button>
      </div>

      {resolved && (
        <div className="border-t border-slate-100 px-4 py-2.5 text-center text-xs text-slate-500">
          Action completed
        </div>
      )}
    </section>
  );
}

function DetailRow({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <div className="flex justify-between gap-5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={`text-right ${emphasized ? "font-semibold text-slate-950" : "font-medium text-slate-900"}`}>
        {value}
      </span>
    </div>
  );
}

export default ConfirmationCard;
