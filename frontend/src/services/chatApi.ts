import type { ChatApiEnvelope, ChatRequest, ChatResponse } from "../types/chat";

async function postChat(payload: ChatRequest): Promise<ChatResponse> {
  const response = await fetch("/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = (await response.json().catch(() => null)) as ChatApiEnvelope | null;

  if (!response.ok || !body?.success) {
    throw new Error(body?.message || "Unable to complete the request. Please try again.");
  }

  return body.data;
}

export async function sendChatMessage(
  message: string,
  sessionId?: string,
): Promise<ChatResponse> {
  return postChat({
    message,
    ...(sessionId ? { session_id: sessionId } : {}),
  });
}

export async function confirmChatAction(sessionId: string): Promise<ChatResponse> {
  return postChat({
    session_id: sessionId,
    confirm: true,
  });
}

export async function cancelChatAction(sessionId: string): Promise<ChatResponse> {
  return postChat({
    session_id: sessionId,
    cancel: true,
  });
}
