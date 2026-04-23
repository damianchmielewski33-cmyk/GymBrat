/**
 * OpenAI-compatible Chat Completions API (`/v1/chat/completions`).
 * Ustaw `AI_API_KEY`; opcjonalnie `AI_MODEL`, `AI_API_BASE_URL` (np. proxy Azure/OpenRouter).
 */

export type AiMessage = { role: "system" | "user" | "assistant"; content: string };

export type AiImage = {
  /** `image/jpeg`, `image/png`, etc. */
  mimeType: string;
  /** Raw bytes base64 (no data URL prefix). */
  base64: string;
};

export type CompleteChatOptions = {
  /** Optional: provider-specific model name */
  model?: string;
};

type OpenAiChatResponse = {
  choices?: Array<{ message?: { content?: string | unknown } }>;
  error?: { message?: string };
};

function apiBase(): string {
  const raw = process.env.AI_API_BASE_URL?.trim();
  return (raw || "https://api.openai.com/v1").replace(/\/$/, "");
}

function defaultModel(): string {
  return process.env.AI_MODEL?.trim() || "gpt-4o-mini";
}

function extractTextContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const c of content) {
      if (c && typeof c === "object" && "text" in c && typeof (c as { text?: string }).text === "string") {
        parts.push((c as { text: string }).text);
      }
    }
    return parts.join("\n");
  }
  return "";
}

export async function completeChat(
  messages: AiMessage[],
  opts?: CompleteChatOptions,
): Promise<string> {
  if (!process.env.AI_API_KEY) {
    return "AI_API_KEY is not configured. Add a provider in ai/client.ts when ready.";
  }

  const model = opts?.model ?? defaultModel();
  const res = await fetch(`${apiBase()}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.AI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });

  const rawText = await res.text();
  let json: OpenAiChatResponse;
  try {
    json = JSON.parse(rawText) as OpenAiChatResponse;
  } catch {
    return `AI response parse error (HTTP ${res.status}).`;
  }

  if (!res.ok) {
    return json.error?.message ?? `AI request failed (HTTP ${res.status}).`;
  }

  const content = json.choices?.[0]?.message?.content;
  const text = extractTextContent(content);
  return text.trim() || "Empty model response.";
}

export async function completeVision(
  messages: AiMessage[],
  images: AiImage[],
  opts?: CompleteChatOptions,
): Promise<string> {
  if (!process.env.AI_API_KEY) {
    return "AI_API_KEY is not configured. Add a provider in ai/client.ts when ready.";
  }

  const system = messages.find((m) => m.role === "system")?.content ?? "";
  const userText = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n\n");

  const userParts: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [{ type: "text", text: userText }];

  for (const img of images) {
    userParts.push({
      type: "image_url",
      image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
    });
  }

  const model = opts?.model ?? defaultModel();

  const res = await fetch(`${apiBase()}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.AI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userParts },
      ],
      temperature: 0.5,
      max_tokens: 4096,
    }),
  });

  const rawText = await res.text();
  let json: OpenAiChatResponse;
  try {
    json = JSON.parse(rawText) as OpenAiChatResponse;
  } catch {
    return `AI vision parse error (HTTP ${res.status}).`;
  }

  if (!res.ok) {
    return json.error?.message ?? `AI vision failed (HTTP ${res.status}).`;
  }

  const content = json.choices?.[0]?.message?.content;
  const text = extractTextContent(content);
  return text.trim() || "Empty model response.";
}
