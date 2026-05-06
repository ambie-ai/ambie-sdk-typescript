// AMBIE API types. Hand-curated to match openapi.yaml v2.2.0 at
// https://ambie.ai/openapi.yaml. Lean by design — only the fields developers
// commonly read are typed strictly; long-tail metadata lives on `metadata` /
// pass-through index signatures.

export type Engine = "deepgram" | "whisper";
export type TranscribeFormat = "json" | "text" | "srt" | "vtt";
export type Bool = "true" | "false";

export interface AsyncAcceptedResponse {
  request_id: string;
  poll_url: string;
  status: "queued" | "processing";
  client_id?: string;
  created_at: string;
}

export interface JobStatus<T> {
  request_id: string;
  status: "queued" | "processing" | "completed" | "failed";
  client_id?: string;
  result?: T;
  error?: string;
  created_at: string;
  completed_at?: string;
}

// --- Transcription ----------------------------------------------------------

export interface TranscribeOptions {
  /** Either `audio` (Blob/File/Buffer) OR `url` is required. */
  audio?: Blob | ArrayBuffer | Uint8Array;
  /** Filename hint when uploading a Buffer/Uint8Array (default `audio.bin`). */
  filename?: string;
  /** Public URL the API can fetch server-side. */
  url?: string;
  engine?: Engine;
  language?: string;
  format?: TranscribeFormat;
  translate?: boolean;
  callback_url?: string;
  client_id?: string;
  punctuate?: boolean;
  smart_format?: boolean;
  diarize?: boolean;
  detect_entities?: boolean;
  paragraphs?: boolean;
  utterances?: boolean;
  filler_words?: boolean;
  profanity_filter?: boolean;
  numerals?: boolean;
  measurements?: boolean;
  multichannel?: boolean;
  vocabulary?: string;
  prefix?: string;
  summarize?: boolean;
  key_phrases?: boolean;
  action_items?: boolean;
  chapters?: boolean;
}

export interface TranscriptionResult {
  request_id: string;
  client_id?: string;
  engine: Engine;
  language?: string;
  duration: number;
  text: string;
  confidence?: number;
  words?: Array<{
    word: string;
    start: number;
    end: number;
    confidence?: number;
    speaker?: number;
    channel?: number;
  }>;
  utterances?: Array<{
    text: string;
    start: number;
    end: number;
    confidence?: number;
    speaker?: number;
  }>;
  diarized_text?: string;
  speaker_count?: number;
  paragraphs?: string[];
  summary?: string;
  key_phrases?: string[];
  action_items?: Array<{
    action: string;
    assignee?: string | null;
    deadline?: string | null;
  }>;
  chapters?: Array<{
    title: string;
    summary: string;
    start: number;
    end: number;
  }>;
  [k: string]: unknown;
}

// --- Translation ------------------------------------------------------------

export interface TranslateOptions {
  text: string;
  target_lang: string;
  source_lang?: string;
  formality?: "formal" | "informal" | "neutral";
  context?: string;
  callback_url?: string;
  client_id?: string;
}

export interface TranslationResult {
  request_id: string;
  client_id?: string;
  source_lang: string;
  target_lang: string;
  source_text: string;
  translated_text: string;
  confidence?: number;
}

// --- TTS --------------------------------------------------------------------

export interface TtsOptions {
  text: string;
  voice?: string;
  engine?: "aura" | "melo";
  language?: string;
  encoding?: "mp3" | "wav" | "ogg" | "linear16";
  container?: string;
  speed?: number;
  callback_url?: string;
  client_id?: string;
}

export interface TtsResult {
  request_id: string;
  client_id?: string;
  audio_url: string;
  duration?: number;
  voice: string;
  encoding: string;
}

// --- Sentiment --------------------------------------------------------------

export interface SentimentOptions {
  text: string | string[];
  callback_url?: string;
  client_id?: string;
}

export interface SentimentResult {
  request_id: string;
  client_id?: string;
  results: Array<{
    text: string;
    label: "POSITIVE" | "NEGATIVE";
    score: number;
  }>;
}

// --- Summarize --------------------------------------------------------------

export interface SummarizeOptions {
  text?: string;
  url?: string;
  max_length?: number;
  callback_url?: string;
  client_id?: string;
}

export interface SummarizeResult {
  request_id: string;
  client_id?: string;
  summary: string;
  source_length?: number;
  summary_length?: number;
}

// --- Embeddings -------------------------------------------------------------

export interface EmbeddingsOptions {
  text: string | string[];
  model?: string;
  callback_url?: string;
  client_id?: string;
}

export interface EmbeddingsResult {
  request_id: string;
  client_id?: string;
  model: string;
  dimensions: number;
  embeddings: number[][];
}

// --- Rerank -----------------------------------------------------------------

export interface RerankOptions {
  query: string;
  documents: string[];
  top_k?: number;
  callback_url?: string;
  client_id?: string;
}

export interface RerankResult {
  request_id: string;
  client_id?: string;
  results: Array<{
    index: number;
    score: number;
    document: string;
  }>;
}

// --- Moderate ---------------------------------------------------------------

export interface ModerateOptions {
  text: string;
  callback_url?: string;
  client_id?: string;
}

export interface ModerateResult {
  request_id: string;
  client_id?: string;
  flagged: boolean;
  categories: Record<string, boolean>;
  scores?: Record<string, number>;
}

// --- Detect language --------------------------------------------------------

export interface DetectLangOptions {
  text: string;
  callback_url?: string;
  client_id?: string;
}

export interface DetectLangResult {
  request_id: string;
  client_id?: string;
  language: string;
  confidence: number;
  alternatives?: Array<{ language: string; confidence: number }>;
}

// --- Common -----------------------------------------------------------------

export interface ApiError {
  status: number;
  code: string;
  message: string;
  request_id?: string;
}
