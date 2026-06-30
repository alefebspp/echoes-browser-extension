export const STORAGE_KEYS = {
  AUTH_TOKEN: "echoes_auth_token",
  TRACKING_ENABLED: "echoes_tracking_enabled",
  CONSENT_GIVEN: "echoes_consent_given",
  API_BASE_URL: "echoes_api_base_url",
  EVENT_QUEUE: "echoes_event_queue",
  LOCAL_EVENT_LOG: "echoes_local_event_log",
} as const;

export const DEFAULT_API_BASE_URL = "http://localhost:3847";

/** Set at build time via VITE_API_BASE_URL. When present, storage override is ignored. */
export const BUILTIN_API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, "") ?? "";

export const IS_API_BASE_URL_LOCKED = BUILTIN_API_BASE_URL.length > 0;

export const MAX_LOCAL_LOG = 100;
export const MAX_QUEUE_SIZE = 500;
export const FLUSH_INTERVAL_MS = 30_000;
export const MAX_RETRY_ATTEMPTS = 5;
