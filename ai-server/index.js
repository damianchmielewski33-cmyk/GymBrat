import express from "express";
import rateLimit from "express-rate-limit";

const PORT = Number(process.env.PORT || 11435);
const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
const RELAY_TOKEN = (process.env.AI_RELAY_TOKEN || "").trim();

function unauthorized(res) {
  return res.status(401).json({ error: { message: "Unauthorized" } });
}

function requireAuth(req, res, next) {
  if (!RELAY_TOKEN) return unauthorized(res);
  const hdr = String(req.header("authorization") || "");
  const ok = hdr.startsWith("Bearer ") && hdr.slice("Bearer ".length).trim() === RELAY_TOKEN;
  if (!ok) return unauthorized(res);
  next();
}

function decodeDataUrl(url) {
  // data:<mime>;base64,<data>
  if (typeof url !== "string") return null;
  if (!url.startsWith("data:")) return null;
  const comma = url.indexOf(",");
  if (comma < 0) return null;
  const meta = url.slice(5, comma);
  const data = url.slice(comma + 1);
  if (!/;base64/i.test(meta)) return null;
  return data;
}

function toOllamaMessages(openAiMessages) {
  const out = [];
  for (const m of Array.isArray(openAiMessages) ? openAiMessages : []) {
    if (!m || typeof m !== "object") continue;
    const role = m.role;
    if (role !== "system" && role !== "user" && role !== "assistant") continue;

    let content = "";
    const images = [];

    if (typeof m.content === "string") {
      content = m.content;
    } else if (Array.isArray(m.content)) {
      for (const part of m.content) {
        if (!part || typeof part !== "object") continue;
        if (part.type === "text" && typeof part.text === "string") {
          content += (content ? "\n" : "") + part.text;
        }
        if (part.type === "image_url" && part.image_url && typeof part.image_url === "object") {
          const data = decodeDataUrl(part.image_url.url);
          if (data) images.push(data);
        }
      }
    }

    const msg = { role, content };
    if (images.length) msg.images = images;
    out.push(msg);
  }
  return out;
}

async function ollamaChat({ model, messages, temperature, max_tokens }) {
  const body = {
    model,
    messages: toOllamaMessages(messages),
    stream: false,
    options: {
      temperature: typeof temperature === "number" ? temperature : 0.7,
      num_predict: typeof max_tokens === "number" ? max_tokens : 2048
    }
  };

  const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const raw = await res.text();
  let json;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, status: res.status, error: `Upstream parse error (HTTP ${res.status}).` };
  }

  if (!res.ok) {
    const msg = json?.error || `Upstream failed (HTTP ${res.status}).`;
    return { ok: false, status: res.status, error: msg };
  }

  const text = String(json?.message?.content || "").trim();
  return { ok: true, status: 200, text };
}

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "20mb" }));
app.use(
  rateLimit({
    windowMs: 60_000,
    limit: Number(process.env.AI_RELAY_RPM || 60),
    standardHeaders: "draft-8",
    legacyHeaders: false
  })
);

app.get("/healthz", (_req, res) => res.json({ ok: true }));

// OpenAI-compatible subset
app.post("/v1/chat/completions", requireAuth, async (req, res) => {
  const { model, messages, temperature, max_tokens } = req.body || {};
  if (!model || typeof model !== "string") {
    return res.status(400).json({ error: { message: "Missing model" } });
  }

  const r = await ollamaChat({ model, messages, temperature, max_tokens });
  if (!r.ok) {
    return res.status(502).json({ error: { message: r.error } });
  }

  return res.json({
    id: "chatcmpl-relay",
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, message: { role: "assistant", content: r.text }, finish_reason: "stop" }]
  });
});

app.listen(PORT, "0.0.0.0", () => {
  // eslint-disable-next-line no-console
  console.log(`AI relay listening on :${PORT} (ollama: ${OLLAMA_BASE_URL})`);
});

