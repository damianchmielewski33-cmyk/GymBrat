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

function logGeminiError(input: {
  stage: "request" | "parse" | "response";
  model: string;
  status?: number;
  message: string;
  rawText?: string;
}) {
  // Server-side only; avoid leaking secrets. Keep raw response short.
  const raw =
    typeof input.rawText === "string" && input.rawText.trim()
      ? input.rawText.trim().slice(0, 1200)
      : undefined;

  // eslint-disable-next-line no-console
  console.error("[AI][Gemini] Error", {
    stage: input.stage,
    model: input.model,
    status: input.status,
    message: input.message,
    raw,
  });
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

function isLikelyLocalOllamaBase(base: string): boolean {
  // Default Ollama listens on 11434 locally. When talking to it directly,
  // no shared-secret token is required.
  const b = base.replace(/\/$/, "");
  return b === "http://127.0.0.1:11434" || b === "http://localhost:11434";
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
  const key = process.env.AI_API_KEY?.trim();
  if (provider() === "ollama") {
    // If the base points to a relay / remote OpenAI-like endpoint, require a token.
    // If it points to local Ollama directly, allow empty key.
    const base = openAiBase();
    return Boolean(key) || isLikelyLocalOllamaBase(base);
  }
  return Boolean(key);
}

async function geminiGenerateContent(model: string, body: unknown): Promise<Response> {
  try {
    return await fetch(
      `${geminiBase()}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.AI_API_KEY ?? "")}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logGeminiError({ stage: "request", model, message: msg });
    throw err;
  }
}

function isModelNotFoundMessage(msg: string | undefined): boolean {
  if (!msg) return false;
  return /is not found|not supported for generateContent|model.*not found/i.test(msg);
}

function isQuotaOrRateLimitMessage(msg: string | undefined): boolean {
  if (!msg) return false;
  return (
    /quota exceeded|rate limit|too many requests|resource_exhausted/i.test(msg) ||
    /przekroczono limit|limit transferu|przekroczono aktualny limit|przekroczono swój/i.test(msg)
  );
}

/** Ordered unique list: user model first, then common alternates (separate quota buckets). */
function geminiFallbackModels(preferredModel: string): string[] {
  const candidates = [
    preferredModel.trim(),
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.5-pro",
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of candidates) {
    if (!m || seen.has(m)) continue;
    seen.add(m);
    out.push(m);
  }
  return out;
}

function shouldTryNextGeminiModel(
  res: Response,
  msg: string | undefined,
  modelIndex: number,
  totalModels: number,
): boolean {
  if (modelIndex >= totalModels - 1) return false;
  if (isModelNotFoundMessage(msg)) return true;
  if (res.status === 429) return true;
  if (isQuotaOrRateLimitMessage(msg)) return true;
  return false;
}

async function generateWithFallback(
  preferredModel: string,
  body: unknown,
): Promise<{ res: Response; json: GeminiGenerateContentResponse }> {
  const fallbacks = geminiFallbackModels(preferredModel);

  let lastJson: GeminiGenerateContentResponse = {};
  let lastRes: Response | null = null;

  for (let i = 0; i < fallbacks.length; i++) {
    const m = fallbacks[i]!;
    const res = await geminiGenerateContent(m, body);
    const rawText = await res.text();
    let json: GeminiGenerateContentResponse;
    try {
      json = JSON.parse(rawText) as GeminiGenerateContentResponse;
    } catch {
      // If JSON parsing fails, don't keep retrying other models: it's likely network/proxy/html.
      logGeminiError({
        stage: "parse",
        model: m,
        status: res.status,
        message: "Failed to parse JSON response from Gemini.",
        rawText,
      });
      return { res, json: { error: { message: `AI response parse error (HTTP ${res.status}).` } } };
    }

    lastJson = json;
    lastRes = res;

    if (res.ok) return { res, json };

    // Log any Gemini non-OK response.
    logGeminiError({
      stage: "response",
      model: m,
      status: res.status,
      message: json.error?.message ?? `Gemini request failed (HTTP ${res.status}).`,
      rawText,
    });

    const msg = json.error?.message;
    if (shouldTryNextGeminiModel(res, msg, i, fallbacks.length)) continue;

    return { res, json };
  }

  return { res: lastRes ?? new Response(null, { status: 500 }), json: lastJson };
}

type OpenAiLikeChatResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
};

async function openAiLikeChat(messages: AiMessage[], model: string): Promise<string> {
  const key = process.env.AI_API_KEY?.trim();
  const res = await fetch(`${openAiBase()}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    },
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

async function openAiLikeVision(messages: AiMessage[], images: AiImage[], model: string): Promise<string> {
  const key = process.env.AI_API_KEY?.trim();
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

  const res = await fetch(`${openAiBase()}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
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
  let json: OpenAiLikeChatResponse;
  try {
    json = JSON.parse(rawText) as OpenAiLikeChatResponse;
  } catch {
    throw new Error(`AI vision parse error (HTTP ${res.status}).`);
  }

  if (!res.ok) {
    throw new Error(json.error?.message ?? `AI vision failed (HTTP ${res.status}).`);
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
    // Requires an OpenAI-compatible endpoint that supports image_url (Ollama via relay can).
    return openAiLikeVision(messages, images, model);
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
