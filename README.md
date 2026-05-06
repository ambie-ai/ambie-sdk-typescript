# @ambie/sdk

Official TypeScript SDK for [AMBIE](https://ambie.ai).

Speech-to-text in noisy environments, translation, TTS, embeddings, sentiment, summarization, content moderation, and language detection — over a single typed client.

> **⚠ Platform preview.** AMBIE's API is live and the SDK surface is stable, but the inference is currently served by commodity off-the-shelf models (Deepgram, Whisper, Llama 3.1, BGE). The proprietary AMBIE acoustic-intelligence models — the 90-95% noisy-environment accuracy the brand is named after — are in development and will replace the transcription / TTS engines in 2027. Same API surface, free upgrade when it lands. Full disclosure at [ambie.ai/preview](https://ambie.ai/preview/). Every API response carries `X-AMBIE-Preview: true` until that swap.

## Install

Install directly from this GitHub repo:

```bash
npm install github:ambie-ai/ambie-sdk-typescript
```

Pin to a tag:

```bash
npm install github:ambie-ai/ambie-sdk-typescript#v0.1.0
```

Requires Node 18+ (uses built-in `fetch` and `node:crypto`).

> The SDK source is open here on GitHub and installable via `npm install` directly from the repo. We're not publishing to the public npm registry yet; once v1.0.0 ships, we'll mirror to npm and the install line will shorten to `npm install @ambie/sdk`.

## Quickstart

```ts
import { AmbieClient } from "@ambie/sdk";
import { readFile } from "node:fs/promises";

const client = new AmbieClient({
  apiKey: process.env.AMBIE_API_KEY!,
});

// Transcribe a file
const audio = await readFile("./meeting.mp3");
const result = await client.transcribe({
  audio,
  filename: "meeting.mp3",
  engine: "deepgram",
  diarize: true,
  summarize: true,
});

console.log(result); // { text, summary, speaker_count, ... }

// Translate text
const translated = await client.translate({
  text: "Hello, world!",
  target_lang: "es",
});

// Generate embeddings
const embed = await client.embeddings({
  text: ["alpha", "beta", "gamma"],
});
```

## Async mode

Pass a `callback_url` to any endpoint to get the result delivered to your webhook:

```ts
const accepted = await client.transcribe({
  url: "https://cdn.example.com/long-recording.mp3",
  callback_url: "https://yourserver.com/webhooks/ambie",
});
console.log(accepted.request_id, accepted.poll_url);

// Later: poll status if you want to
const status = await client.getTranscribeJob(accepted.request_id);
```

## Webhook verification

```ts
import { verifyWebhookSignature } from "@ambie/sdk";

// In your webhook handler:
const signature = req.headers["x-ambie-signature"];
const body = await readRawBody(req); // raw string, NOT parsed JSON

verifyWebhookSignature({
  signature,
  body,
  secret: process.env.AMBIE_WEBHOOK_SECRET!,
});
// throws if invalid — safe to parse and act on body after this line
```

## Configuration

| Option         | Default                  | Description                                  |
| -------------- | ------------------------ | -------------------------------------------- |
| `apiKey`       | **required**             | API key from [/signup](https://ambie.ai/signup) |
| `baseUrl`      | `https://ambie.ai`       | Override for staging                         |
| `timeoutMs`    | `60000`                  | Per-request timeout                          |
| `maxRetries`   | `3`                      | Retries for 429/5xx (exponential backoff)    |
| `userAgent`    | `ambie-js/<version>`     | Sent on every request                        |
| `fetch`        | global `fetch`           | Inject a custom fetch implementation         |

## Error handling

All non-2xx responses (after retries) throw `AmbieError`:

```ts
import { AmbieError } from "@ambie/sdk";

try {
  await client.transcribe({ url: "not-a-url" });
} catch (e) {
  if (e instanceof AmbieError) {
    console.error(e.status, e.code, e.message, e.request_id);
  }
}
```

## Coverage

Supported endpoints: `transcribe`, `translate`, `tts`, `sentiment`, `summarize`, `embeddings`, `rerank`, `moderate`, `detectLanguage`. Each has a sync POST and async polling via `get<Endpoint>Job(requestId)`.

See the full [OpenAPI 3.1 spec](https://ambie.ai/openapi.yaml).

## License

MIT © AMBIE
