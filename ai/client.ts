/**
 * Placeholder for AI provider wiring (OpenAI, Anthropic, etc.).
 * Reads configuration only from server env — never expose keys to the client bundle.
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

export async function completeChat(
  messages: AiMessage[],
  opts?: CompleteChatOptions,
): Promise<string> {
  void messages;
  void opts;
  if (!process.env.AI_API_KEY) {
    return "AI_API_KEY is not configured. Add a provider in ai/client.ts when ready.";
  }
  return "AI responses are not enabled in this scaffold.";
}

export async function completeVision(
  messages: AiMessage[],
  images: AiImage[],
  opts?: CompleteChatOptions,
): Promise<string> {
  void messages;
  void images;
  void opts;
  if (!process.env.AI_API_KEY) {
    return "AI_API_KEY is not configured. Add a provider in ai/client.ts when ready.";
  }
  return "AI vision responses are not enabled in this scaffold.";
}
