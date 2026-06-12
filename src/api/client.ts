import { getApiBaseUrl, getAuthHeaders } from "../auth/auth";
import type { WebVisitEvent } from "../events/event-types";

export type SendEventResult =
  | { ok: true }
  | { ok: false; status?: number; error: string };

export async function sendEvent(event: WebVisitEvent): Promise<SendEventResult> {
  const baseUrl = await getApiBaseUrl();
  const headers = await getAuthHeaders();

  try {
    const response = await fetch(`${baseUrl}/api/v1/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      const body = await response.text();
      return {
        ok: false,
        status: response.status,
        error: body || `Request failed (${response.status})`,
      };
    }

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network error";
    return { ok: false, error: message };
  }
}
