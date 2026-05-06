import type {
  AsyncAcceptedResponse,
  ApiError,
  DetectLangOptions,
  DetectLangResult,
  EmbeddingsOptions,
  EmbeddingsResult,
  JobStatus,
  ModerateOptions,
  ModerateResult,
  RerankOptions,
  RerankResult,
  SentimentOptions,
  SentimentResult,
  SummarizeOptions,
  SummarizeResult,
  TranscribeOptions,
  TranscriptionResult,
  TranslateOptions,
  TranslationResult,
  TtsOptions,
  TtsResult,
} from "./types.js";

const DEFAULT_BASE_URL = "https://ambie.ai";
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_RETRIES = 3;
const RETRY_STATUS = new Set([429, 500, 502, 503, 504]);
const SDK_VERSION = "0.1.0";

export interface ClientOptions {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
  userAgent?: string;
  fetch?: typeof fetch;
}

export class AmbieError extends Error implements ApiError {
  status: number;
  code: string;
  request_id?: string;
  constructor(
    status: number,
    code: string,
    message: string,
    requestId?: string,
  ) {
    super(message);
    this.name = "AmbieError";
    this.status = status;
    this.code = code;
    this.request_id = requestId;
  }
}

type Body = Record<string, unknown> | FormData | undefined;

export class AmbieClient {
  private apiKey: string;
  private baseUrl: string;
  private timeoutMs: number;
  private maxRetries: number;
  private userAgent: string;
  private _fetch: typeof fetch;

  constructor(opts: ClientOptions) {
    if (!opts.apiKey) throw new Error("apiKey is required");
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.userAgent = opts.userAgent ?? `ambie-js/${SDK_VERSION}`;
    this._fetch = opts.fetch ?? fetch;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: Body,
    query?: Record<string, string | number | undefined>,
    accept?: string,
  ): Promise<T> {
    const url = new URL(this.baseUrl + path);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined) url.searchParams.set(k, String(v));
      }
    }
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "User-Agent": this.userAgent,
      Accept: accept ?? "application/json",
    };

    let payload: BodyInit | undefined;
    if (body instanceof FormData) {
      // Let fetch set the multipart boundary header.
      payload = body;
    } else if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }

    let lastErr: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const res = await this._fetch(url.toString(), {
          method,
          headers,
          body: payload,
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (res.ok) {
          const ct = res.headers.get("content-type") || "";
          if (ct.includes("application/json")) return (await res.json()) as T;
          return (await res.text()) as unknown as T;
        }

        if (RETRY_STATUS.has(res.status) && attempt < this.maxRetries) {
          const retryAfter = Number.parseFloat(
            res.headers.get("retry-after") || "0",
          );
          const backoff =
            retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
          await sleep(backoff);
          continue;
        }

        let code = "http_error";
        let message = `HTTP ${res.status}`;
        try {
          const j = (await res.json()) as { error?: string; code?: string };
          message = j.error ?? message;
          code = j.code ?? code;
        } catch {}
        throw new AmbieError(
          res.status,
          code,
          message,
          res.headers.get("x-request-id") ?? undefined,
        );
      } catch (e) {
        clearTimeout(timer);
        lastErr = e;
        if (e instanceof AmbieError) throw e;
        if (attempt >= this.maxRetries) break;
        await sleep(250 * 2 ** attempt);
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error("request failed");
  }

  // --- Transcription -----------------------------------------------------

  /**
   * Transcribe an audio file. Returns the result synchronously when no
   * `callback_url` is provided; returns an `AsyncAcceptedResponse` (HTTP 202)
   * when a webhook is requested.
   *
   * Either `audio` or `url` must be set in `opts`.
   */
  async transcribe(
    opts: TranscribeOptions,
  ): Promise<TranscriptionResult | AsyncAcceptedResponse | string> {
    if (!opts.audio && !opts.url) {
      throw new Error("transcribe requires either `audio` or `url`");
    }
    const fd = new FormData();
    if (opts.audio !== undefined) {
      const filename = opts.filename ?? "audio.bin";
      const blob = opts.audio instanceof Blob ? opts.audio : toBlob(opts.audio);
      fd.append("audio", blob, filename);
    }
    for (const [k, v] of Object.entries(opts)) {
      if (k === "audio" || k === "filename" || v === undefined) continue;
      if (typeof v === "boolean") fd.append(k, v ? "true" : "false");
      else fd.append(k, String(v));
    }

    const accept =
      opts.format && opts.format !== "json"
        ? acceptFor(opts.format)
        : undefined;

    return this.request<TranscriptionResult | AsyncAcceptedResponse | string>(
      "POST",
      "/api/v1/transcribe",
      fd,
      undefined,
      accept,
    );
  }

  /** Poll a transcription job by `request_id`. */
  getTranscribeJob(requestId: string) {
    return this.request<JobStatus<TranscriptionResult>>(
      "GET",
      `/api/v1/transcribe/${encodeURIComponent(requestId)}`,
    );
  }

  // --- Translation -------------------------------------------------------

  translate(opts: TranslateOptions) {
    return this.request<TranslationResult | AsyncAcceptedResponse>(
      "POST",
      "/api/v1/translate",
      opts as unknown as Record<string, unknown>,
    );
  }

  getTranslateJob(requestId: string) {
    return this.request<JobStatus<TranslationResult>>(
      "GET",
      `/api/v1/translate/${encodeURIComponent(requestId)}`,
    );
  }

  // --- TTS ---------------------------------------------------------------

  tts(opts: TtsOptions) {
    return this.request<TtsResult | AsyncAcceptedResponse>(
      "POST",
      "/api/v1/tts",
      opts as unknown as Record<string, unknown>,
    );
  }

  getTtsJob(requestId: string) {
    return this.request<JobStatus<TtsResult>>(
      "GET",
      `/api/v1/tts/${encodeURIComponent(requestId)}`,
    );
  }

  // --- Sentiment ---------------------------------------------------------

  sentiment(opts: SentimentOptions) {
    return this.request<SentimentResult | AsyncAcceptedResponse>(
      "POST",
      "/api/v1/sentiment",
      opts as unknown as Record<string, unknown>,
    );
  }

  getSentimentJob(requestId: string) {
    return this.request<JobStatus<SentimentResult>>(
      "GET",
      `/api/v1/sentiment/${encodeURIComponent(requestId)}`,
    );
  }

  // --- Summarize ---------------------------------------------------------

  summarize(opts: SummarizeOptions) {
    return this.request<SummarizeResult | AsyncAcceptedResponse>(
      "POST",
      "/api/v1/summarize",
      opts as unknown as Record<string, unknown>,
    );
  }

  getSummarizeJob(requestId: string) {
    return this.request<JobStatus<SummarizeResult>>(
      "GET",
      `/api/v1/summarize/${encodeURIComponent(requestId)}`,
    );
  }

  // --- Embeddings --------------------------------------------------------

  embeddings(opts: EmbeddingsOptions) {
    return this.request<EmbeddingsResult | AsyncAcceptedResponse>(
      "POST",
      "/api/v1/embeddings",
      opts as unknown as Record<string, unknown>,
    );
  }

  getEmbeddingsJob(requestId: string) {
    return this.request<JobStatus<EmbeddingsResult>>(
      "GET",
      `/api/v1/embeddings/${encodeURIComponent(requestId)}`,
    );
  }

  // --- Rerank ------------------------------------------------------------

  rerank(opts: RerankOptions) {
    return this.request<RerankResult | AsyncAcceptedResponse>(
      "POST",
      "/api/v1/rerank",
      opts as unknown as Record<string, unknown>,
    );
  }

  getRerankJob(requestId: string) {
    return this.request<JobStatus<RerankResult>>(
      "GET",
      `/api/v1/rerank/${encodeURIComponent(requestId)}`,
    );
  }

  // --- Moderate ----------------------------------------------------------

  moderate(opts: ModerateOptions) {
    return this.request<ModerateResult | AsyncAcceptedResponse>(
      "POST",
      "/api/v1/moderate",
      opts as unknown as Record<string, unknown>,
    );
  }

  getModerateJob(requestId: string) {
    return this.request<JobStatus<ModerateResult>>(
      "GET",
      `/api/v1/moderate/${encodeURIComponent(requestId)}`,
    );
  }

  // --- Detect language ---------------------------------------------------

  detectLanguage(opts: DetectLangOptions) {
    return this.request<DetectLangResult | AsyncAcceptedResponse>(
      "POST",
      "/api/v1/detect-lang",
      opts as unknown as Record<string, unknown>,
    );
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function toBlob(data: ArrayBuffer | Uint8Array): Blob {
  const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
  return new Blob([buf], { type: "application/octet-stream" });
}

function acceptFor(format: "text" | "srt" | "vtt"): string {
  switch (format) {
    case "text":
      return "text/plain";
    case "srt":
      return "application/x-subrip";
    case "vtt":
      return "text/vtt";
  }
}
