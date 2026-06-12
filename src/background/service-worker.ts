import { flushQueue, enqueueEvent } from "../events/event-queue";
import { FLUSH_INTERVAL_MS, STORAGE_KEYS } from "../shared/constants";

const IGNORED_URL_PREFIXES = [
  "chrome://",
  "chrome-extension://",
  "edge://",
  "about:",
  "devtools://",
];

function isTrackableUrl(url: string | undefined): url is string {
  if (!url) return false;
  return !IGNORED_URL_PREFIXES.some((prefix) => url.startsWith(prefix));
}

async function isTrackingEnabled(): Promise<boolean> {
  const result = await chrome.storage.local.get([
    STORAGE_KEYS.TRACKING_ENABLED,
    STORAGE_KEYS.CONSENT_GIVEN,
  ]);

  const consent = result[STORAGE_KEYS.CONSENT_GIVEN] === true;
  const enabled = result[STORAGE_KEYS.TRACKING_ENABLED] !== false;
  return consent && enabled;
}

async function handleTabUpdate(
  tabId: number,
  changeInfo: chrome.tabs.TabChangeInfo,
  tab: chrome.tabs.Tab,
): Promise<void> {
  if (changeInfo.status !== "complete") return;
  if (!tab.active) return;
  if (!isTrackableUrl(tab.url)) return;
  if (!(await isTrackingEnabled())) return;

  const title = tab.title?.trim() || "Untitled";
  await enqueueEvent(tab.url, title);
  await flushQueue();
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  void handleTabUpdate(tabId, changeInfo, tab);
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  if (!(await isTrackingEnabled())) return;

  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (!isTrackableUrl(tab.url)) return;
    if (tab.status !== "complete") return;

    const title = tab.title?.trim() || "Untitled";
    await enqueueEvent(tab.url, title);
    await flushQueue();
  } catch {
    // Tab may have been closed before we could read it.
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "flush-queue") {
    void flushQueue();
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("flush-queue", { periodInMinutes: FLUSH_INTERVAL_MS / 60_000 });
});

chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

export {};
