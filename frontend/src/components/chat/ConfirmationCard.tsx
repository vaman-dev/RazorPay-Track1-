import { Check, CreditCard, ShieldCheck, X } from "lucide-react";
import type { ChatConfirmation } from "../../types/chat";
import { formatMoney, friendlyRestriction } from "../../utils/presentation";

interface ConfirmationCardProps {
  confirmation: ChatConfirmation;
  disabled?: boolean;
  resolved?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmationCard({
  confirmation,
  disabled = false,
  resolved = false,
  onConfirm,
  onCancel,
}: ConfirmationCardProps) {
  const details = confirmation.details;
  const isIntent = confirmation.action === "approve_intent";
  const isPayment = ["initiate_payment", "initiate_checkout_payment"].includes(confirmation.action);
  const isPurchase = ["create_cart", "commit_checkout_cart"].includes(confirmation.action);
  const amount = isIntent ? details?.max_amount : details?.amount;
  const formattedAmount = isPayment
    ? details?.formatted_amount
    : isIntent
      ? details?.formatted_max_amount
      : details?.formatted_amount;
  const amountText = typeof amount === "number"
    ? formatMoney(amount, details?.currency, 2)
    : formattedAmount || null;
  const safeTitle = isIntent
    ? "Approve this authorization?"
    : isPayment
      ? "Confirm payment"
      : isPurchase
        ? "Confirm this purchase?"
        : "Confirm this action?";
  const subtitle = isIntent
    ? "Review the authorization before approving"
    : isPayment
      ? "Payment begins only after your confirmation"
      : isPurchase
        ? "Review the purchase commitment"
        : "Your confirmation is required";
  const confirmLabel = isIntent
    ? "Approve authorization"
    : isPayment
      ? amountText ? `Pay ${amountText}` : "Confirm payment"
      : isPurchase
        ? "Confirm purchase"
        : "Confirm";

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
            {safeTitle}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
        </div>
      </div>

      <div className="space-y-3 px-4 py-4">
        {details?.scope && <DetailRow label="Scope" value={details.scope} />}
        {details?.merchant && <DetailRow label="Merchant" value={details.merchant} />}
        {amountText && (
          <DetailRow
            label={isIntent ? "Maximum authorization" : isPayment ? "Payment amount" : "Purchase amount"}
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
          <DetailRow label="Allowed merchants" value={friendlyRestriction(details.policy.merchant_ids.length, "merchant")} />
        ) : null}
        {!isPayment && details?.policy?.product_ids?.length ? (
          <DetailRow label="Allowed products" value={friendlyRestriction(details.policy.product_ids.length, "product")} />
        ) : null}
        {details?.valid_until && (
          <DetailRow
            label="Valid until"
            value={new Date(details.valid_until).toLocaleString()}
          />
        )}
        {isPurchase && details?.items?.length ? (
          <div className="rounded-xl bg-slate-50 p-3">
            {details.items.map((item, index) => (
              <div key={`${item.name || "Product"}-${index}`} className="flex justify-between gap-4 text-sm">
                <span className="font-medium text-slate-900">{item.name || "Trusted product"}</span>
                <span className="shrink-0 text-slate-500">Qty {item.quantity || 1}</span>
              </div>
            ))}
          </div>
        ) : null}
        {isIntent && details?.usage_mode === "reusable_budget" && (
          <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm leading-5 text-slate-600">
            This authorization can cover multiple purchases up to the approved cumulative limit.
          </p>
        )}
        {isIntent && details?.usage_mode === "single_use" && (
          <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm leading-5 text-slate-600">
            This authorization can be used for one purchase only.
          </p>
        )}
        {isPurchase && details?.usage_mode === "single_use" && (
          <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-sm leading-5 text-amber-900">
            Confirming this purchase will use your single-use authorization.
          </p>
        )}
        {isPayment && (
          <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm leading-5 text-slate-600">
            Secure Razorpay Checkout will open after confirmation.
          </p>
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
          {confirmLabel}
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
