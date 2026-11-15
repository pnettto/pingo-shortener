import { PAGE } from "./page.js";
import { LOGO, DS_CSS, THEME_BOOT } from "./logo.js";
import { docs } from "./docs.js";

const COOKIE = "pingo_session";
const SESSION_DAYS = 30;
const RESERVED = new Set(["api", "docs", "llms.txt", "favicon.ico", "robots.txt", "login", "logout"]);
const SLUG_RE = /^[a-zA-Z0-9_-]{1,64}$/;
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

// Strict limits, counted exactly in D1 (global, not per location).
const LIMITS = {
  loginIp: { limit: 10, window: 15 * 60 }, // login attempts per IP
  loginGlobal: { limit: 30, window: 60 * 60 }, // failed logins from anywhere
  createDaily: { limit: 1000, window: 24 * 3600 }, // new links per caller
  keysHourly: { limit: 30, window: 60 * 60 }, // key create/rename/rotate/delete
};

// ---------- helpers ----------

const enc = new TextEncoder();

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });

const b64url = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/[+/=]/g, (c) => ({ "+": "-", "/": "_", "=": "" })[c]);
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const randomHex = (bytes) => hex(crypto.getRandomValues(new Uint8Array(bytes)));
const sha256 = async (s) => hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));

async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(msg)));
}

async function safeEqual(a, b, secret) {
  const [x, y] = await Promise.all([hmac(secret, String(a)), hmac(secret, String(b))]);
  let diff = x.length ^ y.length;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

const ipOf = (req) => req.headers.get("cf-connecting-ip") || "unknown";

const fmtWait = (s) => (s < 60 ? `${s}s` : s < 3600 ? `${Math.ceil(s / 60)}m` : `${Math.ceil(s / 3600)}h`);

// ---------- rate limiting ----------

class Limited extends Error {
  constructor(retryAfter) {
    super(`Too many requests, try again in ${fmtWait(retryAfter)}`);
    this.retryAfter = retryAfter;
  }
}

function bucket(name, subject) {
  const { limit, window } = LIMITS[name];
  const win = Math.floor(Date.now() / 1000 / window);
  const expires = (win + 1) * window * 1000;
  return { k: `${name}:${subject}:${win}`, limit, expires, retryAfter: Math.max(1, Math.ceil((expires - Date.now()) / 1000)) };
}

// throws if the bucket is already full (doesn't count)
async function peek(env, name, subject) {
  const b = bucket(name, subject);
  const row = await env.DB.prepare("SELECT n FROM rate_limits WHERE k = ?").bind(b.k).first();
  if ((row?.n ?? 0) >= b.limit) throw new Limited(b.retryAfter);
}

// counts one hit, throws if over the limit
async function bump(env, name, subject) {
  const b = bucket(name, subject);
  const row = await env.DB.prepare(
    "INSERT INTO rate_limits (k, n, expires) VALUES (?, 1, ?) ON CONFLICT(k) DO UPDATE SET n = n + 1 RETURNING n"
  )
    .bind(b.k, b.expires)
    .first();
  if (row.n > b.limit) throw new Limited(b.retryAfter);
}

// fast approximate burst limit via the Workers rate-limit binding
async function burst(binding, key) {
  if (!binding) return;
  const { success } = await binding.limit({ key });
  if (!success) throw new Limited(60);
}

// ---------- auth ----------

async function makeSession(env) {
  const exp = Date.now() + SESSION_DAYS * 864e5;
  return `${exp}.${await hmac(env.SESSION_SECRET, `session:${exp}`)}`;
}

async function validSession(env, value) {
  if (!value) return false;
  const [exp, sig] = value.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return safeEqual(sig, await hmac(env.SESSION_SECRET, `session:${exp}`), env.SESSION_SECRET);
}

function getCookie(req, name) {
  const m = (req.headers.get("cookie") || "").match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

// -> { type: "session" } | { type: "key", id, name } | null
async function authenticate(req, env, ctx) {
  const h = req.headers.get("authorization") || "";
  const key = h.startsWith("Bearer ") ? h.slice(7).trim() : req.headers.get("x-api-key");
  if (key) {
    const row = await env.DB.prepare("SELECT id, name, last_used_at, origins FROM api_keys WHERE hash = ?").bind(await sha256(key)).first();
    if (!row) return null;
    if (!row.last_used_at || Date.now() - row.last_used_at > 60_000) {
      ctx.waitUntil(env.DB.prepare("UPDATE api_keys SET last_used_at = ? WHERE id = ?").bind(Date.now(), row.id).run());
    }
    return { type: "key", id: row.id, name: row.name, origins: row.origins ? JSON.parse(row.origins) : [] };
  }
  if (await validSession(env, getCookie(req, COOKIE))) return { type: "session" };
  return null;
}

const callerId = (auth) => (auth.type === "key" ? `key:${auth.id}` : "browser");

// ---------- links ----------

function randomSlug(len = 5) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join("");
}

function normalizeUrl(input) {
  let s = String(input || "").trim();
  if (!s) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = "https://" + s;
  try {
    const u = new URL(s);
    return ["http:", "https:"].includes(u.protocol) ? u.toString() : null;
  } catch {
    return null;
  }
}

const shortUrl = (req, slug) => `${new URL(req.url).origin}/${slug}`;

function linkOut(req, l) {
  return {
    slug: l.slug,
    url: l.url,
    short: shortUrl(req, l.slug),
    clicks: l.clicks,
    created_at: l.created_at,
    app: l.created_by ? (l.app ?? "deleted key") : null,
  };
}

const LINK_SELECT =
  "SELECT l.slug, l.url, l.clicks, l.created_at, l.created_by, k.name AS app FROM links l LEFT JOIN api_keys k ON k.id = l.created_by";

async function createLink(req, env, auth) {
  const body = await req.json().catch(() => null);
  if (!body) return json({ error: "Invalid JSON body" }, 400);
  const url = normalizeUrl(body.url);
  if (!url) return json({ error: "Invalid URL" }, 400);
  if (new URL(url).host === new URL(req.url).host) return json({ error: "Can't shorten a pingo link" }, 400);

  await burst(env.RL_CREATE, callerId(auth));
  await bump(env, "createDaily", callerId(auth));

  let slug = String(body.slug || "").trim();
  if (slug) {
    if (!SLUG_RE.test(slug) || RESERVED.has(slug.toLowerCase())) return json({ error: "Invalid slug (a-z, 0-9, - and _)" }, 400);
    if (await env.DB.prepare("SELECT 1 FROM links WHERE slug = ?").bind(slug).first()) return json({ error: "Slug already taken" }, 409);
  } else {
    for (let i = 0; i < 6 && !slug; i++) {
      const s = randomSlug(i < 3 ? 5 : 7);
      if (!(await env.DB.prepare("SELECT 1 FROM links WHERE slug = ?").bind(s).first())) slug = s;
    }
    if (!slug) return json({ error: "Could not generate slug" }, 500);
  }

  const created_by = auth.type === "key" ? auth.id : null;
  const created_at = Date.now();
  await env.DB.prepare("INSERT INTO links (slug, url, clicks, created_at, created_by) VALUES (?, ?, 0, ?, ?)")
    .bind(slug, url, created_at, created_by)
    .run();
  return json(linkOut(req, { slug, url, clicks: 0, created_at, created_by, app: auth.name }), 201);
}

// ---------- keys (browser session only) ----------

const newKey = () => `pingo_${randomHex(24)}`;
const keyPrefix = (k) => k.slice(0, 10);

function cleanName(name) {
  const n = String(name || "").trim();
  return n && n.length <= 40 ? n : null;
}

class BadInput extends Error {}

// "myapp.com" -> "https://myapp.com", "localhost:5173" -> "http://localhost:5173", "*.myapp.com" allowed
function normalizeOrigin(input) {
  let s = String(input).trim().toLowerCase();
  if (!/^https?:\/\//.test(s)) s = (/^(localhost|127\.0\.0\.1)(:|\/|$)/.test(s) ? "http://" : "https://") + s;
  const m = s.match(/^(https?):\/\/(\*\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)*)(?::(\d{1,5}))?(?:\/.*)?$/);
  if (!m) return null;
  const [, scheme, wild = "", host, port] = m;
  const defPort = (scheme === "https" && port === "443") || (scheme === "http" && port === "80");
  return `${scheme}://${wild}${host}${port && !defPort ? `:${port}` : ""}`;
}

// accepts array or comma/space separated string; returns JSON string or null (= server-only)
function parseOrigins(input) {
  if (input == null || input === "") return null;
  const parts = (Array.isArray(input) ? input : String(input).split(/[\s,]+/)).map(String).filter((s) => s.trim());
  const out = [];
  for (const p of parts) {
    const o = normalizeOrigin(p);
    if (!o) throw new BadInput(`Invalid domain: ${p}`);
    if (!out.includes(o)) out.push(o);
  }
  if (out.length > 20) throw new BadInput("Max 20 domains per key");
  return out.length ? JSON.stringify(out) : null;
}

function originAllowed(list, origin) {
  const o = origin.toLowerCase();
  return list.some((p) => {
    if (p === o) return true;
    const m = p.match(/^(https?):\/\/\*\.(.+)$/);
    if (!m) return false;
    try {
      const u = new URL(o);
      return u.protocol === `${m[1]}:` && u.host.endsWith(`.${m[2]}`);
    } catch {
      return false;
    }
  });
}

const keyOut = (k) => ({ ...k, origins: k.origins ? JSON.parse(k.origins) : [] });

async function keysApi(req, env, path) {
  try {
    return await keysApiInner(req, env, path);
  } catch (e) {
    if (e instanceof BadInput) return json({ error: e.message }, 400);
    throw e;
  }
}

async function keysApiInner(req, env, path) {
  if (path === "/api/keys" && req.method === "GET") {
    const { results } = await env.DB.prepare(
      `SELECT k.id, k.name, k.prefix, k.origins, k.created_at, k.last_used_at,
              (SELECT COUNT(*) FROM links WHERE created_by = k.id) AS links
       FROM api_keys k ORDER BY k.created_at DESC`
    ).all();
    return json({ keys: results.map(keyOut) });
  }

  if (req.method !== "GET") await bump(env, "keysHourly", "browser");

  if (path === "/api/keys" && req.method === "POST") {
    const { name, origins } = (await req.json().catch(() => null)) || {};
    const n = cleanName(name);
    if (!n) return json({ error: "Name is required (max 40 chars)" }, 400);
    const o = parseOrigins(origins);
    if (await env.DB.prepare("SELECT 1 FROM api_keys WHERE lower(name) = lower(?)").bind(n).first())
      return json({ error: "An app with that name already exists" }, 409);
    const key = newKey();
    const row = { id: randomHex(8), name: n, prefix: keyPrefix(key), origins: o, created_at: Date.now(), last_used_at: null, links: 0 };
    await env.DB.prepare("INSERT INTO api_keys (id, name, prefix, hash, origins, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(row.id, row.name, row.prefix, await sha256(key), row.origins, row.created_at)
      .run();
    return json({ ...keyOut(row), key }, 201);
  }

  const m = path.match(/^\/api\/keys\/([a-f0-9]+)(\/rotate)?$/);
  if (!m) return json({ error: "Not found" }, 404);
  const [, id, rotate] = m;
  const existing = await env.DB.prepare("SELECT id, name FROM api_keys WHERE id = ?").bind(id).first();
  if (!existing) return json({ error: "Key not found" }, 404);

  if (rotate && req.method === "POST") {
    const key = newKey();
    await env.DB.prepare("UPDATE api_keys SET hash = ?, prefix = ?, last_used_at = NULL WHERE id = ?")
      .bind(await sha256(key), keyPrefix(key), id)
      .run();
    return json({ id, name: existing.name, prefix: keyPrefix(key), key });
  }
  if (!rotate && req.method === "PATCH") {
    const body = (await req.json().catch(() => null)) || {};
    if ("name" in body) {
      const n = cleanName(body.name);
      if (!n) return json({ error: "Name is required (max 40 chars)" }, 400);
      if (await env.DB.prepare("SELECT 1 FROM api_keys WHERE lower(name) = lower(?) AND id != ?").bind(n, id).first())
        return json({ error: "An app with that name already exists" }, 409);
      await env.DB.prepare("UPDATE api_keys SET name = ? WHERE id = ?").bind(n, id).run();
    }
    if ("origins" in body) {
      await env.DB.prepare("UPDATE api_keys SET origins = ? WHERE id = ?").bind(parseOrigins(body.origins), id).run();
    }
    const k = await env.DB.prepare("SELECT id, name, prefix, origins FROM api_keys WHERE id = ?").bind(id).first();
    return json(keyOut(k));
  }
  if (!rotate && req.method === "DELETE") {
    await env.DB.prepare("DELETE FROM api_keys WHERE id = ?").bind(id).run();
    return json({ ok: true });
  }
  return json({ error: "Not found" }, 404);
}

// ---------- api router ----------

async function login(req, env) {
  const ip = ipOf(req);
  await peek(env, "loginGlobal", "all");
  await bump(env, "loginIp", ip);
  const { password } = (await req.json().catch(() => null)) || {};
  if (!password || !(await safeEqual(password, env.PASSWORD, env.SESSION_SECRET))) {
    await bump(env, "loginGlobal", "all").catch(() => {});
    await new Promise((r) => setTimeout(r, 600));
    return json({ error: "Wrong password" }, 401);
  }
  const cookie = `${COOKIE}=${await makeSession(env)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_DAYS * 86400}`;
  return json({ ok: true }, 200, { "set-cookie": cookie });
}

// ---------- CORS (browser apps using a key with allowed domains) ----------

const CORS_PATH = (p) => p === "/api/me" || p === "/api/links" || p.startsWith("/api/links/");

// -> { foreign: origin|null, allowed: bool, headers }
async function corsFor(req, env, path) {
  const origin = req.headers.get("origin");
  if (!origin || origin === new URL(req.url).origin) return { foreign: null, allowed: true, headers: {} };
  if (!CORS_PATH(path)) return { foreign: origin, allowed: false, headers: {} };
  const { results } = await env.DB.prepare("SELECT origins FROM api_keys WHERE origins IS NOT NULL").all();
  const allowed = results.some((r) => originAllowed(JSON.parse(r.origins), origin));
  const headers = allowed
    ? {
        "access-control-allow-origin": origin,
        "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
        "access-control-allow-headers": "authorization, content-type, x-api-key",
        "access-control-expose-headers": "retry-after",
        "access-control-max-age": "86400",
        vary: "Origin",
      }
    : { vary: "Origin" };
  return { foreign: origin, allowed, headers };
}

function withHeaders(res, headers) {
  const r = new Response(res.body, res);
  for (const [k, v] of Object.entries(headers)) r.headers.set(k, v);
  return r;
}

function errorResponse(e, isApi) {
  if (e instanceof Limited) {
    const h = { "retry-after": String(e.retryAfter) };
    return isApi ? json({ error: e.message }, 429, h) : html(SLOW_DOWN, 429, h);
  }
  console.error(e);
  return isApi ? json({ error: "Server error" }, 500) : html(NOT_FOUND, 500);
}

async function apiWithCors(req, env, ctx, path) {
  const cors = await corsFor(req, env, path);
  if (cors.foreign && req.method === "OPTIONS") return new Response(null, { status: cors.allowed ? 204 : 403, headers: cors.headers });
  if (cors.foreign && !cors.allowed) return json({ error: "Origin not allowed" }, 403, cors.headers);
  let res;
  try {
    res = await api(req, env, ctx, path, cors.foreign);
  } catch (e) {
    res = errorResponse(e, true);
  }
  return withHeaders(res, cors.headers);
}

async function api(req, env, ctx, path, foreignOrigin) {
  if (path === "/api/login" && req.method === "POST") return login(req, env);
  if (path === "/api/logout" && req.method === "POST")
    return json({ ok: true }, 200, { "set-cookie": `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0` });

  const auth = await authenticate(req, env, ctx);
  if (!auth) {
    await burst(env.RL_AUTHFAIL, ipOf(req));
    return json({ error: "Unauthorized" }, 401);
  }
  // a browser on another site may only use a key that lists that site
  if (foreignOrigin && (auth.type !== "key" || !originAllowed(auth.origins, foreignOrigin))) {
    return json({ error: "Origin not allowed for this key" }, 403);
  }
  await burst(env.RL_API, callerId(auth));

  if (path === "/api/me") return json({ ok: true, type: auth.type, app: auth.name ?? null });

  if (path === "/api/keys" || path.startsWith("/api/keys/")) {
    if (auth.type !== "session") return json({ error: "Keys can only be managed from the browser" }, 403);
    return keysApi(req, env, path);
  }

  // API keys only see/delete their own links; the browser sees everything.
  const own = auth.type === "key";

  if (path === "/api/links") {
    if (req.method === "GET") {
      const q = own
        ? env.DB.prepare(`${LINK_SELECT} WHERE l.created_by = ? ORDER BY l.created_at DESC LIMIT 500`).bind(auth.id)
        : env.DB.prepare(`${LINK_SELECT} ORDER BY l.created_at DESC LIMIT 500`);
      const { results } = await q.all();
      return json({ links: results.map((l) => linkOut(req, l)) });
    }
    if (req.method === "POST") return createLink(req, env, auth);
  }

  const m = path.match(/^\/api\/links\/([^/]+)$/);
  if (m) {
    const slug = decodeURIComponent(m[1]);
    const l = await env.DB.prepare(`${LINK_SELECT} WHERE l.slug = ?`).bind(slug).first();
    if (!l || (own && l.created_by !== auth.id)) return json({ error: "Not found" }, 404);
    if (req.method === "GET") return json(linkOut(req, l));
    if (req.method === "DELETE") {
      await env.DB.prepare("DELETE FROM links WHERE slug = ?").bind(slug).run();
      return json({ ok: true });
    }
  }
  return json({ error: "Not found" }, 404);
}

// ---------- worker ----------

export default {
  async fetch(req, env, ctx) {
    const path = new URL(req.url).pathname;

    // occasionally sweep expired rate-limit rows
    if (Math.random() < 0.02) ctx.waitUntil(env.DB.prepare("DELETE FROM rate_limits WHERE expires < ?").bind(Date.now()).run());

    try {
      if (path.startsWith("/api/")) return await apiWithCors(req, env, ctx, path);

      const accept = req.headers.get("accept") || "";
      if (path === "/llms.txt" || path === "/docs" || (path === "/" && accept.includes("text/markdown"))) {
        return new Response(docs(new URL(req.url).origin), {
          headers: { "content-type": "text/markdown; charset=utf-8", "cache-control": "public, max-age=300" },
        });
      }
      if (path === "/") {
        return new Response(PAGE, {
          headers: { "content-type": "text/html; charset=utf-8", "x-frame-options": "DENY", "referrer-policy": "no-referrer" },
        });
      }
      if (path === "/favicon.ico") {
        return new Response(LOGO, {
          headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=86400" },
        });
      }
      if (path === "/robots.txt") return new Response("User-agent: *\nAllow: /llms.txt\nAllow: /docs\nDisallow: /\n");

      const slug = decodeURIComponent(path.slice(1));
      if (SLUG_RE.test(slug)) {
        await burst(env.RL_REDIRECT, ipOf(req));
        const link = await env.DB.prepare("SELECT url FROM links WHERE slug = ?").bind(slug).first();
        if (link) {
          ctx.waitUntil(env.DB.prepare("UPDATE links SET clicks = clicks + 1 WHERE slug = ?").bind(slug).run());
          return Response.redirect(link.url, 302);
        }
      }
      return html(NOT_FOUND, 404);
    } catch (e) {
      return errorResponse(e, path.startsWith("/api/"));
    }
  },
};

const html = (body, status, headers = {}) =>
  new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", ...headers } });

const simplePage = (title, text) => `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>pingo · ${title}</title>
<link rel="icon" href="/favicon.ico" type="image/svg+xml">${THEME_BOOT}<link rel="stylesheet" href="${DS_CSS}">
<style>main{min-height:100vh;display:grid;place-content:center;text-align:center;padding:var(--sp-sm)}.pingo-logo{width:5rem;height:5rem;margin:0 auto}p{color:var(--text-muted)}</style>
<main>${LOGO}<h2>${title}</h2><p>${text}</p></main></html>`;

const NOT_FOUND = simplePage("this link is too pingo to find", "nothing lives here.");
const SLOW_DOWN = simplePage("slow down a pingo", "too many requests, try again in a minute.");
