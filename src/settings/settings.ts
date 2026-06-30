import {
  getAuthState,
  getApiBaseUrl,
  login,
  logout,
  setApiBaseUrl,
} from "../auth/auth";
import { flushQueue, getLocalEventLog, getQueueStats, clearQueue } from "../events/event-queue";
import { DEFAULT_API_BASE_URL, IS_API_BASE_URL_LOCKED, STORAGE_KEYS } from "../shared/constants";
import type { WebVisitEvent } from "../events/event-types";

const consentCheckbox = document.getElementById("consent-checkbox") as HTMLInputElement;
const trackingCheckbox = document.getElementById("tracking-checkbox") as HTMLInputElement;
const trackingStatus = document.getElementById("tracking-status")!;
const loginForm = document.getElementById("login-form") as HTMLFormElement;
const emailInput = document.getElementById("email-input") as HTMLInputElement;
const passwordInput = document.getElementById("password-input") as HTMLInputElement;
const loginButton = document.getElementById("login-button") as HTMLButtonElement;
const authStatus = document.getElementById("auth-status")!;
const logoutButton = document.getElementById("logout-button") as HTMLButtonElement;
const apiConfigSection = document.getElementById("api-config-section")!;
const apiUrlInput = document.getElementById("api-url-input") as HTMLInputElement;
const saveApiUrlButton = document.getElementById("save-api-url-button") as HTMLButtonElement;
const queueStats = document.getElementById("queue-stats")!;
const flushQueueButton = document.getElementById("flush-queue-button") as HTMLButtonElement;
const eventLog = document.getElementById("event-log")!;
const clearLogButton = document.getElementById("clear-log-button") as HTMLButtonElement;

async function loadSettings(): Promise<void> {
  if (IS_API_BASE_URL_LOCKED) {
    apiConfigSection.classList.add("hidden");
  }

  const stored = await chrome.storage.local.get([
    STORAGE_KEYS.CONSENT_GIVEN,
    STORAGE_KEYS.TRACKING_ENABLED,
  ]);

  consentCheckbox.checked = stored[STORAGE_KEYS.CONSENT_GIVEN] === true;
  trackingCheckbox.checked = stored[STORAGE_KEYS.TRACKING_ENABLED] !== false;
  apiUrlInput.value = (await getApiBaseUrl()) || DEFAULT_API_BASE_URL;

  updateTrackingStatus();
  await refreshAuthUi();
  await refreshQueueStats();
  await refreshEventLog();
}

function updateTrackingStatus(): void {
  if (!consentCheckbox.checked) {
    trackingStatus.textContent = "Tracking is blocked until you give consent.";
    trackingCheckbox.disabled = true;
    return;
  }

  trackingCheckbox.disabled = false;
  trackingStatus.textContent = trackingCheckbox.checked
    ? "Tracking is active. Visits are captured when you load or switch tabs."
    : "Tracking is paused. No new events will be captured.";
}

async function refreshAuthUi(): Promise<void> {
  const { isAuthenticated } = await getAuthState();

  if (isAuthenticated) {
    loginForm.classList.add("hidden");
    logoutButton.classList.remove("hidden");
    authStatus.textContent = "Signed in. Events will include your auth token when sent.";
    authStatus.className = "status success";
    authStatus.classList.remove("hidden");
    return;
  }

  loginForm.classList.remove("hidden");
  logoutButton.classList.add("hidden");
  authStatus.textContent = "Not signed in. Events are queued locally until you authenticate.";
  authStatus.className = "status";
  authStatus.classList.remove("hidden");
}

async function refreshQueueStats(): Promise<void> {
  const stats = await getQueueStats();
  queueStats.textContent =
    stats.pending === 0
      ? "Queue is empty — all events have been sent."
      : `${stats.pending} event(s) waiting to be sent (${stats.totalAttempts} total retry attempts).`;
}

function renderEventLog(events: WebVisitEvent[]): void {
  eventLog.innerHTML = "";

  if (events.length === 0) {
    const empty = document.createElement("li");
    empty.textContent = "No events captured yet.";
    empty.className = "muted";
    eventLog.appendChild(empty);
    return;
  }

  for (const event of events) {
    const item = document.createElement("li");
    item.innerHTML = `
      <div class="title">${escapeHtml(event.metadata.title)}</div>
      <div class="meta">${escapeHtml(event.metadata.url)}</div>
      <div class="meta">${escapeHtml(event.timestamp)}</div>
    `;
    eventLog.appendChild(item);
  }
}

async function refreshEventLog(): Promise<void> {
  const events = await getLocalEventLog();
  renderEventLog(events);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

consentCheckbox.addEventListener("change", async () => {
  await chrome.storage.local.set({
    [STORAGE_KEYS.CONSENT_GIVEN]: consentCheckbox.checked,
  });

  if (!consentCheckbox.checked) {
    trackingCheckbox.checked = false;
    await chrome.storage.local.set({ [STORAGE_KEYS.TRACKING_ENABLED]: false });
  }

  updateTrackingStatus();
});

trackingCheckbox.addEventListener("change", async () => {
  await chrome.storage.local.set({
    [STORAGE_KEYS.TRACKING_ENABLED]: trackingCheckbox.checked,
  });
  updateTrackingStatus();
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginButton.disabled = true;

  try {
    await login(emailInput.value.trim(), passwordInput.value);
    passwordInput.value = "";
    await refreshAuthUi();
    await flushQueue();
    await refreshQueueStats();
  } catch (error) {
    authStatus.textContent =
      error instanceof Error ? error.message : "Login failed";
    authStatus.className = "status error";
    authStatus.classList.remove("hidden");
  } finally {
    loginButton.disabled = false;
  }
});

logoutButton.addEventListener("click", async () => {
  await logout();
  await refreshAuthUi();
});

saveApiUrlButton.addEventListener("click", async () => {
  const url = apiUrlInput.value.trim().replace(/\/$/, "");
  if (!url) return;
  await setApiBaseUrl(url);
  queueStats.textContent = `API URL saved: ${url}`;
});

flushQueueButton.addEventListener("click", async () => {
  flushQueueButton.disabled = true;
  const result = await flushQueue();
  await refreshQueueStats();
  queueStats.textContent = `Flush complete — sent: ${result.sent}, failed: ${result.failed}.`;
  flushQueueButton.disabled = false;
});

clearLogButton.addEventListener("click", async () => {
  await chrome.storage.local.set({ [STORAGE_KEYS.LOCAL_EVENT_LOG]: [] });
  await refreshEventLog();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes[STORAGE_KEYS.LOCAL_EVENT_LOG]) {
    void refreshEventLog();
  }
  if (changes[STORAGE_KEYS.EVENT_QUEUE]) {
    void refreshQueueStats();
  }
});

void loadSettings();
