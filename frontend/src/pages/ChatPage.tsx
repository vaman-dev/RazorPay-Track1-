import { type FormEvent, useRef, useState } from "react";
import { Bot, ExternalLink, Send, ShieldCheck, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import ConfirmationCard from "../components/chat/ConfirmationCard";
import PolicyViolationCard from "../components/chat/PolicyViolationCard";
import PaymentStatusCard from "../components/payment/PaymentStatusCard";
import {
  cancelChatAction,
  confirmChatAction,
  sendChatMessage,
} from "../services/chatApi";
import { openRazorpayCheckout } from "../services/razorpay";
import { getTrace } from "../services/traceApi";
import type { ChatMessage, ChatResponse, RazorpayCheckoutAction } from "../types/chat";
import { customerFacingText } from "../utils/presentation";

function createMessageId() {
  return crypto.randomUUID();
}

function ChatPage() {
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  function addBackendResponse(response: ChatResponse) {
    const messageId = createMessageId();

    setSessionId(response.session_id);
    setMessages((currentMessages) => [
      ...currentMessages,
      {
        id: messageId,
        role: "assistant",
        content: response.message,
        confirmation:
          response.type === "confirmation_required" ? response.confirmation : null,
        confirmationResolved: false,
        policyViolation: response.policy_violation ?? null,
        traceId: isRazorpayCheckoutAction(response.action) ? response.action.trace_id : undefined,
        paymentAmount: isRazorpayCheckoutAction(response.action) ? response.action.checkout.amount : undefined,
        paymentCurrency: isRazorpayCheckoutAction(response.action) ? response.action.checkout.currency : undefined,
      },
    ]);

    return messageId;
  }

  function isRazorpayCheckoutAction(
    action: ChatResponse["action"],
  ): action is RazorpayCheckoutAction {
    return action?.type === "razorpay_checkout";
  }

  function updatePaymentStatus(
    messageId: string,
    paymentStatus: NonNullable<ChatMessage["paymentStatus"]>,
    paymentStatusDetail?: string,
    context?: Pick<ChatMessage, "paymentAvailableAmount" | "paymentUsageMode" | "paymentChainValid">,
  ) {
    setMessages((currentMessages) =>
      currentMessages.map((message) =>
        message.id === messageId
          ? { ...message, paymentStatus, paymentStatusDetail, ...context }
          : message,
      ),
    );
  }

  function openPaymentCheckout(action: RazorpayCheckoutAction, messageId: string) {
    setIsCheckoutOpen(true);
    updatePaymentStatus(messageId, "opening");

    try {
      openRazorpayCheckout(action, {
        onSubmitted: () => {
          updatePaymentStatus(messageId, "submitted");
          setIsCheckoutOpen(false);
          void verifyPaymentStatus(messageId, action);
        },
        onDismissed: () => {
          updatePaymentStatus(messageId, "dismissed");
          setIsCheckoutOpen(false);
        },
        onFailed: (message) => {
          updatePaymentStatus(messageId, "verifying", "Payment attempt failed. Verifying the server record…");
          setIsCheckoutOpen(false);
          void verifyPaymentStatus(messageId, action, message);
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to open Razorpay Checkout.";
      updatePaymentStatus(messageId, "failed", message);
      setIsCheckoutOpen(false);
    }
  }

  async function verifyPaymentStatus(
    messageId: string,
    action: RazorpayCheckoutAction,
    clientFailureDetail?: string,
  ) {
    const attempts = 8;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const trace = await getTrace(action.trace_id);
        const payment = trace.payments.find((entry) => entry.id === action.payment_id);

        if (payment?.status === "captured") {
          updatePaymentStatus(messageId, "captured", undefined, {
            paymentAvailableAmount: Number(trace.summary.remaining_amount ?? 0),
            paymentUsageMode: trace.intent?.usage_mode,
            paymentChainValid: trace.integrity.chain_valid,
          });
          return;
        }

        if (payment?.status === "failed") {
          updatePaymentStatus(
            messageId,
            "failed",
            payment.failure_detail || "The payment attempt was recorded, but no successful capture exists in Mandate Ledger.",
            {
              paymentAvailableAmount: Number(trace.summary.remaining_amount ?? 0),
              paymentUsageMode: trace.intent?.usage_mode,
              paymentChainValid: trace.integrity.chain_valid,
            },
          );
          return;
        }
      } catch {
        // A later poll can still receive the webhook-finalized ledger record.
      }

      await new Promise((resolve) => window.setTimeout(resolve, 1500));
    }

    if (clientFailureDetail) {
      updatePaymentStatus(messageId, "verifying", "Payment attempt failed. Awaiting server confirmation.");
    }
  }

  function handleClientAction(response: ChatResponse, messageId: string) {
    if (isRazorpayCheckoutAction(response.action)) {
      openPaymentCheckout(response.action, messageId);
    }
  }

  function markConfirmationResolved(messageId: string) {
    setMessages((currentMessages) =>
      currentMessages.map((message) =>
        message.id === messageId ? { ...message, confirmationResolved: true } : message,
      ),
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const message = input.trim();
    if (!message || isLoading || isCheckoutOpen) return;

    setMessages((currentMessages) => [
      ...currentMessages,
      { id: createMessageId(), role: "user", content: message },
    ]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await sendChatMessage(message, sessionId ?? undefined);
      const messageId = addBackendResponse(response);
      handleClientAction(response, messageId);
    } catch (error) {
      addErrorMessage(error, "Unable to send your message. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleConfirm(messageId: string) {
    if (!sessionId || isLoading || isCheckoutOpen) return;

    setIsLoading(true);

    try {
      const response = await confirmChatAction(sessionId);
      markConfirmationResolved(messageId);
      const responseMessageId = addBackendResponse(response);
      handleClientAction(response, responseMessageId);
    } catch (error) {
      addErrorMessage(error, "Unable to confirm this action.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCancel(messageId: string) {
    if (!sessionId || isLoading || isCheckoutOpen) return;

    setIsLoading(true);

    try {
      const response = await cancelChatAction(sessionId);
      markConfirmationResolved(messageId);
      addBackendResponse(response);
    } catch (error) {
      addErrorMessage(error, "Unable to cancel this action.");
    } finally {
      setIsLoading(false);
    }
  }

  function addErrorMessage(error: unknown, fallbackMessage: string) {
    const content = customerFacingText(error instanceof Error ? error.message : fallbackMessage);

    setMessages((currentMessages) => [
      ...currentMessages,
      { id: createMessageId(), role: "error", content },
    ]);
  }

  function prefillComposer(message: string) {
    setInput(message);
    window.requestAnimationFrame(() => composerRef.current?.focus());
  }

  function modifyPurchase(authorizedAmount?: number, currency = "INR") {
    const amountText = typeof authorizedAmount === "number"
      ? new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(authorizedAmount / 100)
      : "my authorized budget";
    prefillComposer(`Show me an option within my ${amountText} authorization.`);
  }

  function requestNewAuthorization(requestedAmount?: number, currency = "INR") {
    const amountText = typeof requestedAmount === "number"
      ? new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(requestedAmount / 100)
      : "this purchase amount";
    prefillComposer(`Create a new authorization for ${amountText} for this purchase.`);
  }

  function retryPayment() {
    prefillComposer("Try payment again for this purchase.");
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col px-4 py-6 sm:px-6">
        <header className="flex items-center gap-3 border-b border-slate-200 pb-5">
          <div className="grid size-10 place-items-center rounded-xl bg-slate-950 text-white">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-lg font-semibold tracking-tight">Mandate Ledger</p>
            <p className="text-sm text-slate-500">Secure purchase assistant</p>
          </div>
        </header>

        <section className="flex flex-1 flex-col py-8" aria-label="Chat conversation">
          {messages.length === 0 ? (
            <div className="my-auto max-w-2xl">
              <p className="text-sm font-medium text-slate-500">How can I help?</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                Tell me what you would like to buy.
              </h1>
              <p className="mt-3 text-slate-600">
                I can help you find an option and guide you through an authorized purchase.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {messages.map((message) => {
                const isUser = message.role === "user";
                const isError = message.role === "error";

                return (
                  <article
                    key={message.id}
                    className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}
                  >
                    <div
                      className={`grid size-8 shrink-0 place-items-center rounded-full ${
                        isUser ? "bg-slate-950 text-white" : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {isUser ? (
                        <UserRound className="size-4" aria-hidden="true" />
                      ) : (
                        <Bot className="size-4" aria-hidden="true" />
                      )}
                    </div>
                    <div
                      className={`flex min-w-0 flex-col ${
                        isUser ? "max-w-[85%] items-end sm:max-w-[75%]" : "w-full max-w-[calc(100%-2.75rem)] items-start sm:max-w-[80%]"
                      }`}
                    >
                      <div
                        className={`max-w-full break-words rounded-2xl px-4 py-3 text-sm leading-7 ${
                          isUser
                            ? "rounded-tr-sm bg-slate-950 text-white"
                            : isError
                              ? "rounded-tl-sm bg-red-50 text-red-700"
                              : "rounded-tl-sm bg-white text-slate-800 shadow-sm ring-1 ring-slate-200"
                        }`}
                      >
                        {isUser ? (
                          <p className="whitespace-pre-wrap">{message.content}</p>
                        ) : (
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeSanitize]}
                            components={{
                              p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                              strong: ({ children }) => <strong className="font-semibold text-slate-950">{children}</strong>,
                              ul: ({ children }) => <ul className="my-3 list-disc space-y-1 pl-5">{children}</ul>,
                              ol: ({ children }) => <ol className="my-3 list-decimal space-y-1 pl-5">{children}</ol>,
                              li: ({ children }) => <li className="pl-1">{children}</li>,
                              code: ({ children }) => (
                                <code className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-800">
                                  {children}
                                </code>
                              ),
                              blockquote: ({ children }) => (
                                <blockquote className="border-l-4 border-slate-300 pl-4 my-3 italic text-slate-600">
                                  {children}
                                </blockquote>
                              ),
                            }}
                          >
                            {customerFacingText(message.content)}
                          </ReactMarkdown>
                        )}
                      </div>

                      {message.confirmation && (
                        <ConfirmationCard
                          confirmation={message.confirmation}
                          disabled={isLoading || isCheckoutOpen}
                          resolved={message.confirmationResolved}
                          onConfirm={() => handleConfirm(message.id)}
                          onCancel={() => handleCancel(message.id)}
                        />
                      )}

                      {message.policyViolation && (
                        <PolicyViolationCard
                          violation={message.policyViolation}
                          disabled={isLoading || isCheckoutOpen}
                          onModifyPurchase={() => modifyPurchase(
                            message.policyViolation?.details?.authorized_amount,
                            message.policyViolation?.details?.currency,
                          )}
                          onRequestNewAuthorization={() => requestNewAuthorization(
                            message.policyViolation?.details?.requested_amount,
                            message.policyViolation?.details?.currency,
                          )}
                        />
                      )}

                      {message.paymentStatus && (
                        <PaymentStatusCard
                          status={message.paymentStatus}
                          detail={message.paymentStatusDetail}
                          amount={message.paymentAmount}
                          currency={message.paymentCurrency}
                          traceId={message.traceId}
                          availableAmount={message.paymentAvailableAmount}
                          usageMode={message.paymentUsageMode}
                          chainValid={message.paymentChainValid}
                          onRetry={message.paymentStatus === "failed" ? retryPayment : undefined}
                        />
                      )}

                      {message.traceId && !message.paymentStatus && (
                        <Link
                          to={`/dashboard/${encodeURIComponent(message.traceId)}`}
                          className="mt-3 inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
                        >
                          View transaction proof
                          <ExternalLink className="size-3.5" aria-hidden="true" />
                        </Link>
                      )}
                    </div>
                  </article>
                );
              })}
              {isLoading && (
                <div className="flex items-center gap-3 text-sm text-slate-500" role="status">
                  <div className="grid size-8 place-items-center rounded-full bg-slate-200 text-slate-700">
                    <Bot className="size-4" aria-hidden="true" />
                  </div>
                  <span>Mandate Ledger is thinking…</span>
                </div>
              )}
            </div>
          )}
        </section>

        <form onSubmit={handleSubmit} className="sticky bottom-0 z-20 bg-slate-50 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-4">
          <label className="sr-only" htmlFor="chat-message">
            Your message
          </label>
          <div className="flex items-end gap-2 rounded-2xl border border-slate-300 bg-white p-2 shadow-sm focus-within:border-slate-500 focus-within:ring-4 focus-within:ring-slate-200">
            <textarea
              id="chat-message"
              ref={composerRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="e.g. I want to buy running shoes under ₹3,000"
              rows={1}
              disabled={isLoading || isCheckoutOpen}
              className="min-h-11 flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading || isCheckoutOpen}
              className="grid size-10 place-items-center rounded-xl bg-slate-950 text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              aria-label="Send message"
            >
              <Send className="size-4" aria-hidden="true" />
            </button>
          </div>
          {sessionId && <p className="mt-2 text-xs text-slate-400">Session active</p>}
        </form>
      </div>
    </main>
  );
}

export default ChatPage;
