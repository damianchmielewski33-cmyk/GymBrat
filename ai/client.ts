/**
 * AI provider client.
 *
 * Supported providers:
 * - Google Gemini (default): set `AI_PROVIDER=gemini` (or omit), requires `AI_API_KEY`.
 * - Ollama (local, free): set `AI_PROVIDER=ollama`, set `AI_API_BASE_URL` (default http://127.0.0.1:11434).
 *
 * Optional:
 * - `AI_MODEL`
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

type Provider = "gemini" | "ollama";

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

type GeminiCandidate = {
  content?: { parts?: Array<{ text?: string }> };
};

type GeminiError = { message?: string };

type GeminiGenerateContentResponse = {
  candidates?: GeminiCandidate[];
  error?: GeminiError;
};

function geminiBase(): string {
  return "https://generativelanguage.googleapis.com/v1beta";
}

function provider(): Provider {
  const raw = process.env.AI_PROVIDER?.trim().toLowerCase();
  return raw === "ollama" ? "ollama" : "gemini";
}

function openAiBase(): string {
  const raw = process.env.AI_API_BASE_URL?.trim();
  const base = raw || "http://127.0.0.1:11434";
  return base.replace(/\/$/, "");
}

function defaultModel(): string {
  const m = process.env.AI_MODEL?.trim();
  if (m) return m;
  return provider() === "ollama" ? "llama3.1:8b" : "gemini-2.0-flash";
}

function pickTextFromGemini(json: GeminiGenerateContentResponse): string {
  const parts = json.candidates?.[0]?.content?.parts ?? [];
  const texts: string[] = [];
  for (const p of parts) {
    if (p?.text) texts.push(p.text);
  }
  return texts.join("\n").trim();
}

function normalizeMessagesForGemini(messages: AiMessage[]) {
  const system = messages.find((m) => m.role === "system")?.content?.trim() ?? "";
  const history = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  return { system, history };
}

export function isAiConfigured(): boolean {
  if (provider() === "ollama") return true;
  return Boolean(process.env.AI_API_KEY?.trim());
}

async function geminiGenerateContent(model: string, body: unknown): Promise<Response> {
  return fetch(
    `${geminiBase()}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.AI_API_KEY ?? "")}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

function isModelNotFoundMessage(msg: string | undefined): boolean {
  if (!msg) return false;
  return /is not found|not supported for generateContent|model.*not found/i.test(msg);
}

function isQuotaOrRateLimitMessage(msg: string | undefined): boolean {
  if (!msg) return false;
  return /quota exceeded|rate limit|too many requests/i.test(msg);
}

async function generateWithFallback(
  preferredModel: string,
  body: unknown,
): Promise<{ res: Response; json: GeminiGenerateContentResponse }> {
  const fallbacks = [
    preferredModel,
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.5-pro",
  ];

  let lastJson: GeminiGenerateContentResponse = {};
  let lastRes: Response | null = null;

  for (const m of fallbacks) {
    const res = await geminiGenerateContent(m, body);
    const rawText = await res.text();
    let json: GeminiGenerateContentResponse;
    try {
      json = JSON.parse(rawText) as GeminiGenerateContentResponse;
    } catch {
      // If JSON parsing fails, don't keep retrying other models: it's likely network/proxy/html.
      return { res, json: { error: { message: `AI response parse error (HTTP ${res.status}).` } } };
    }

    lastJson = json;
    lastRes = res;

    if (res.ok) return { res, json };
    if (!isModelNotFoundMessage(json.error?.message)) return { res, json };
  }

  return { res: lastRes ?? new Response(null, { status: 500 }), json: lastJson };
}

type OpenAiLikeChatResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
};

async function openAiLikeChat(messages: AiMessage[], model: string): Promise<string> {
  const res = await fetch(`${openAiBase()}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });

  const rawText = await res.text();
  let json: OpenAiLikeChatResponse;
  try {
    json = JSON.parse(rawText) as OpenAiLikeChatResponse;
  } catch {
    throw new Error(`AI response parse error (HTTP ${res.status}).`);
  }

  if (!res.ok) {
    throw new Error(json.error?.message ?? `AI request failed (HTTP ${res.status}).`);
  }

  const text = json.choices?.[0]?.message?.content?.trim() ?? "";
  return text || "Empty model response.";
}

export async function completeChat(
  messages: AiMessage[],
  opts?: CompleteChatOptions,
): Promise<string> {
  if (!isAiConfigured()) {
    return "AI is not configured. Set AI_PROVIDER and required env vars.";
  }

  const model = opts?.model ?? defaultModel();
  if (provider() === "ollama") {
    // Ollama (local) exposes an OpenAI-compatible endpoint at /v1/chat/completions.
    return openAiLikeChat(messages, model);
  }
  const { system, history } = normalizeMessagesForGemini(messages);

  const body = {
    ...(system
      ? {
          systemInstruction: { parts: [{ text: system }] },
        }
      : {}),
    contents: history.length ? history : [{ role: "user", parts: [{ text: "" }] }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2048,
    },
  };

  const { res, json } = await generateWithFallback(model, body);

  if (!res.ok) {
    const msg = json.error?.message;
    // Make callers fall back to heuristics instead of showing quota errors as "content".
    if (res.status === 429 || isQuotaOrRateLimitMessage(msg)) {
      throw new Error(msg ?? `AI rate limited (HTTP ${res.status}).`);
    }
    return msg ?? `AI request failed (HTTP ${res.status}).`;
  }

  return pickTextFromGemini(json) || "Empty model response.";
}

export async function completeVision(
  messages: AiMessage[],
  images: AiImage[],
  opts?: CompleteChatOptions,
): Promise<string> {
  if (!isAiConfigured()) {
    return "AI is not configured. Set AI_PROVIDER and required env vars.";
  }

  const model = opts?.model ?? defaultModel();
  if (provider() === "ollama") {
    // Keep it simple: if you want vision locally, wire a multimodal model + API here.
    throw new Error("Vision is not supported for AI_PROVIDER=ollama.");
  }
  const system = messages.find((m) => m.role === "system")?.content?.trim() ?? "";
  const userText = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n\n")
    .trim();

  const parts: GeminiPart[] = [];
  if (userText) parts.push({ text: userText });
  for (const img of images) {
    parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } });
  }

  const body = {
    ...(system
      ? {
          systemInstruction: { parts: [{ text: system }] },
        }
      : {}),
    contents: [{ role: "user", parts: parts.length ? parts : [{ text: "" }] }],
    generationConfig: {
      temperature: 0.5,
      maxOutputTokens: 4096,
    },
  };

  const { res, json } = await generateWithFallback(model, body);

  if (!res.ok) {
    const msg = json.error?.message;
    if (res.status === 429 || isQuotaOrRateLimitMessage(msg)) {
      throw new Error(msg ?? `AI rate limited (HTTP ${res.status}).`);
    }
    return msg ?? `AI vision failed (HTTP ${res.status}).`;
  }

  return pickTextFromGemini(json) || "Empty model response.";
}
