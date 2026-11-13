/**
 * Local Supabase-compatible proxy.
 *
 * The app talks to Supabase JS, which always calls `<url>/rest/v1/...`.
 * Raw PostgREST serves at the root (`/...`). This proxy bridges the two so a
 * local Postgres + PostgREST can be used without hosted Supabase.
 *
 * Usage:
 *   node scripts/local-supabase-proxy.js
 *
 * Env:
 *   PROXY_PORT (default 3005)      - port the app connects to
 *   BACKEND_PORT (default 3006)    - port PostgREST listens on
 */
const http = require("node:http");

const PROXY_PORT = Number(process.env.PROXY_PORT || 3005);
const BACKEND_PORT = Number(process.env.BACKEND_PORT || 3006);
const BACKEND_HOST = process.env.BACKEND_HOST || "127.0.0.1";

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  let pathname = requestUrl.pathname;

  // Supabase JS path -> PostgREST root path
  if (pathname === "/rest/v1" || pathname === "/rest/v1/") {
    pathname = "/";
  } else if (pathname.startsWith("/rest/v1/")) {
    pathname = pathname.slice("/rest/v1".length);
  }

  const headers = { ...req.headers, host: `${BACKEND_HOST}:${BACKEND_PORT}` };

  const proxyReq = http.request(
    {
      hostname: BACKEND_HOST,
      port: BACKEND_PORT,
      path: pathname + requestUrl.search,
      method: req.method,
      headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );

  proxyReq.on("error", (error) => {
    console.error("[local-supabase-proxy] backend error:", error.message);
    if (!res.headersSent) {
      res.writeHead(502, { "Content-Type": "application/json" });
    }
    res.end(JSON.stringify({ success: false, error: { message: "Local PostgREST backend unavailable", details: null } }));
  });

  req.pipe(proxyReq);
});

server.listen(PROXY_PORT, () => {
  console.log(`[local-supabase-proxy] listening on http://localhost:${PROXY_PORT} -> PostgREST http://${BACKEND_HOST}:${BACKEND_PORT}`);
});
