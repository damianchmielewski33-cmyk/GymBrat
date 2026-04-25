/**
 * Google Gemini `generateContent` API (text + multimodal).
 * Ustaw `AI_API_KEY`; opcjonalnie `AI_MODEL`.
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

function defaultModel(): string {
  // Good default for cost/speed; user can override via AI_MODEL.
  // Note: some older model ids (e.g. gemini-1.5-flash) may be retired; keep this reasonably current.
  return process.env.AI_MODEL?.trim() || "gemini-2.0-flash";
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

export async function completeChat(
  messages: AiMessage[],
  opts?: CompleteChatOptions,
): Promise<string> {
  if (!process.env.AI_API_KEY) {
    return "AI_API_KEY is not configured. Add a provider in ai/client.ts when ready.";
  }

  const model = opts?.model ?? defaultModel();
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
    return json.error?.message ?? `AI request failed (HTTP ${res.status}).`;
  }

  return pickTextFromGemini(json) || "Empty model response.";
}

export async function completeVision(
  messages: AiMessage[],
  images: AiImage[],
  opts?: CompleteChatOptions,
): Promise<string> {
  if (!process.env.AI_API_KEY) {
    return "AI_API_KEY is not configured. Add a provider in ai/client.ts when ready.";
  }

  const model = opts?.model ?? defaultModel();
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
    return json.error?.message ?? `AI vision failed (HTTP ${res.status}).`;
  }

  return pickTextFromGemini(json) || "Empty model response.";
}
