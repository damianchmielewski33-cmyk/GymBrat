## GymBrat AI Relay (free, self-hosted)

This is a small authenticated relay that exposes an **OpenAI-compatible** endpoint (`/v1/chat/completions`)
backed by a local **Ollama** instance.

### Why it exists
- Your Next.js app can keep talking to a stable OpenAI-like API.
- The relay adds a **shared-secret token** + basic **rate limiting** so your Ollama isn’t publicly abusable.

### Run with Docker (recommended)
1. Install Docker Desktop.
2. In repo root, create a file `.env` (for docker compose) with:

```env
AI_RELAY_TOKEN=change_me_to_a_long_random_value
AI_RELAY_RPM=60
```

3. Start:

```bash
docker compose up -d --build
```

4. Pull models inside the Ollama container (example):

```bash
docker compose exec ollama ollama pull llama3.1:8b
docker compose exec ollama ollama pull llava:7b
```

### Run without Docker (Windows)
1. Install Ollama, start it (it listens on `http://127.0.0.1:11434`).
2. Pull a model:

```powershell
ollama pull llama3.1:8b
```

3. Start the relay:

```powershell
cd ai-server
$env:AI_RELAY_TOKEN="change_me_to_a_long_random_value"
node index.js
```

### Configure GymBrat
In `.env.local` (Next.js app):

```env
AI_PROVIDER=ollama
AI_API_BASE_URL=http://localhost:11435
AI_API_KEY=change_me_to_a_long_random_value
AI_MODEL=llama3.1:8b
```

For vision features, use a multimodal model (example):

```env
AI_MODEL=llava:7b
```

