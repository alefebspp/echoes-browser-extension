/**
 * Minimal mock Echoes API for local extension testing.
 * No external dependencies — uses Node.js built-in http module.
 */

import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

const PORT = 3847;
const VALID_EMAIL = "demo@echoes.local";
const VALID_PASSWORD = "demo1234";
const MOCK_TOKEN = "mock-jwt-token-for-local-dev";

/** @type {Array<Record<string, unknown>>} */
const receivedEvents = [];

function sendJson(res, status, body) {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function isAuthorized(req) {
  const header = req.headers.authorization ?? "";
  return header === `Bearer ${MOCK_TOKEN}`;
}

const server = createServer(async (req, res) => {
  const { method, url } = req;

  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    });
    res.end();
    return;
  }

  try {
    if (method === "GET" && url === "/health") {
      sendJson(res, 200, { status: "ok" });
      return;
    }

    if (method === "POST" && url === "/api/v1/auth/login") {
      const body = await readBody(req);
      if (body.email === VALID_EMAIL && body.password === VALID_PASSWORD) {
        sendJson(res, 200, { token: MOCK_TOKEN });
        console.log("[mock] login success:", body.email);
        return;
      }
      sendJson(res, 401, { error: "Invalid credentials" });
      console.log("[mock] login failed:", body.email);
      return;
    }

    if (method === "POST" && url === "/api/v1/events") {
      if (!isAuthorized(req)) {
        sendJson(res, 401, { error: "Unauthorized" });
        return;
      }

      const body = await readBody(req);
      receivedEvents.unshift({ receivedAt: new Date().toISOString(), ...body });
      console.log("[mock] event received:", JSON.stringify(body));
      sendJson(res, 201, { id: randomUUID(), status: "accepted" });
      return;
    }

    if (method === "GET" && url === "/api/v1/events") {
      sendJson(res, 200, { events: receivedEvents });
      return;
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    console.error("[mock] error:", error);
    sendJson(res, 500, { error: "Internal server error" });
  }
});

server.listen(PORT, () => {
  console.log(`Echoes mock API listening on http://localhost:${PORT}`);
  console.log("");
  console.log("Test credentials:");
  console.log(`  email:    ${VALID_EMAIL}`);
  console.log(`  password: ${VALID_PASSWORD}`);
  console.log("");
  console.log("Endpoints:");
  console.log("  POST /api/v1/auth/login");
  console.log("  POST /api/v1/events  (requires Bearer token)");
  console.log("  GET  /api/v1/events  (view received events)");
  console.log("  GET  /health");
});
