export type WebVisitEvent = {
  type: "WEB_VISIT";
  timestamp: string;
  source: "browser_extension";
  metadata: {
    url: string;
    title: string;
    browser?: string;
  };
};

export type QueuedEvent = WebVisitEvent & {
  id: string;
  attempts: number;
  createdAt: string;
};

export function createWebVisitEvent(url: string, title: string): WebVisitEvent {
  return {
    type: "WEB_VISIT",
    timestamp: new Date().toISOString(),
    source: "browser_extension",
    metadata: {
      url,
      title,
      browser: "chrome",
    },
  };
}

export function generateEventId(): string {
  return crypto.randomUUID();
}
