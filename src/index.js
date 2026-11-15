import { PAGE } from "./page.js";

const COOKIE = "pingo_session";
const SESSION_DAYS = 30;
const RESERVED = new Set(["api", "favicon.ico", "robots.txt", "login", "logout"]);
const SLUG_RE = /^[a-zA-Z0-9_-]{1,64}$/;
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });

const enc = new TextEncoder();

async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/[+/=]/g, (c) => ({ "+": "-", "/": "_", "=": "" })[c]);
}

// constant-time-ish string compare via HMAC of both sides
async function safeEqual(a, b, secret) {
  const [x, y] = await Promise.all([hmac(secret, String(a)), hmac(secret, String(b))]);
  let diff = x.length ^ y.length;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

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

async function isAuthed(req, env) {
  const auth = req.headers.get("authorization") || "";
  const key = auth.startsWith("Bearer ") ? auth.slice(7) : req.headers.get("x-api-key");
  if (key) return safeEqual(key, env.API_KEY, env.SESSION_SECRET);
  return validSession(env, getCookie(req, COOKIE));
}

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
    if (!["http:", "https:"].includes(u.protocol)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

const shortUrl = (req, slug) => `${new URL(req.url).origin}/${slug}`;

async function createLink(req, env) {
  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const url = normalizeUrl(body.url);
  if (!url) return json({ error: "Invalid URL" }, 400);
  if (new URL(url).host === new URL(req.url).host) return json({ error: "Can't shorten a pingo link" }, 400);

  let slug = (body.slug || "").trim();
  if (slug) {
    if (!SLUG_RE.test(slug) || RESERVED.has(slug.toLowerCase())) return json({ error: "Invalid slug (a-z, 0-9, - and _)" }, 400);
    const exists = await env.DB.prepare("SELECT 1 FROM links WHERE slug = ?").bind(slug).first();
    if (exists) return json({ error: "Slug already taken" }, 409);
  } else {
    for (let i = 0; i < 6; i++) {
      const s = randomSlug(i < 3 ? 5 : 7);
      if (!(await env.DB.prepare("SELECT 1 FROM links WHERE slug = ?").bind(s).first())) {
        slug = s;
        break;
      }
    }
    if (!slug) return json({ error: "Could not generate slug" }, 500);
  }
  const created_at = Date.now();
  await env.DB.prepare("INSERT INTO links (slug, url, clicks, created_at) VALUES (?, ?, 0, ?)").bind(slug, url, created_at).run();
  return json({ slug, url, short: shortUrl(req, slug), clicks: 0, created_at }, 201);
}

async function api(req, env, path) {
  if (path === "/api/login" && req.method === "POST") {
    const { password } = await req.json().catch(() => ({}));
    if (!password || !(await safeEqual(password, env.PASSWORD, env.SESSION_SECRET))) {
      await new Promise((r) => setTimeout(r, 600));
      return json({ error: "Wrong password" }, 401);
    }
    const cookie = `${COOKIE}=${await makeSession(env)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_DAYS * 86400}`;
    return json({ ok: true }, 200, { "set-cookie": cookie });
  }
  if (path === "/api/logout" && req.method === "POST") {
    return json({ ok: true }, 200, { "set-cookie": `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0` });
  }

  if (!(await isAuthed(req, env))) return json({ error: "Unauthorized" }, 401);

  if (path === "/api/me") return json({ ok: true });

  if (path === "/api/links") {
    if (req.method === "GET") {
      const { results } = await env.DB.prepare("SELECT slug, url, clicks, created_at FROM links ORDER BY created_at DESC LIMIT 500").all();
      return json({ links: results.map((l) => ({ ...l, short: shortUrl(req, l.slug) })) });
    }
    if (req.method === "POST") return createLink(req, env);
  }

  const m = path.match(/^\/api\/links\/([^/]+)$/);
  if (m) {
    const slug = decodeURIComponent(m[1]);
    if (req.method === "GET") {
      const l = await env.DB.prepare("SELECT slug, url, clicks, created_at FROM links WHERE slug = ?").bind(slug).first();
      return l ? json({ ...l, short: shortUrl(req, slug) }) : json({ error: "Not found" }, 404);
    }
    if (req.method === "DELETE") {
      const r = await env.DB.prepare("DELETE FROM links WHERE slug = ?").bind(slug).run();
      return r.meta.changes ? json({ ok: true }) : json({ error: "Not found" }, 404);
    }
  }
  return json({ error: "Not found" }, 404);
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const path = url.pathname;

    if (path.startsWith("/api/")) {
      try {
        return await api(req, env, path);
      } catch (e) {
        return json({ error: "Server error" }, 500);
      }
    }

    if (path === "/") {
      return new Response(PAGE, {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "x-frame-options": "DENY",
          "referrer-policy": "no-referrer",
        },
      });
    }
    if (path === "/favicon.ico") {
      return new Response(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🐧</text></svg>`,
        { headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=86400" } }
      );
    }
    if (path === "/robots.txt") return new Response("User-agent: *\nDisallow: /\n");

    const slug = decodeURIComponent(path.slice(1));
    if (SLUG_RE.test(slug)) {
      const link = await env.DB.prepare("SELECT url FROM links WHERE slug = ?").bind(slug).first();
      if (link) {
        ctx.waitUntil(env.DB.prepare("UPDATE links SET clicks = clicks + 1 WHERE slug = ?").bind(slug).run());
        return Response.redirect(link.url, 302);
      }
    }
    return new Response(NOT_FOUND, { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });
  },
};

const NOT_FOUND = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>pingo · not found</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:ui-rounded,system-ui,sans-serif;background:#fdf8f3;color:#3b3a4a;text-align:center}div{font-size:64px}p{color:#9a97a8}</style>
<main><div>🐧💭</div><h2>this link swam away</h2><p>nothing lives here.</p></main>`;
