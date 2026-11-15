import { LOGO, DS_CSS, THEME_BOOT } from "./logo.js";

export const PAGE = /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>pingo</title>
<link rel="icon" href="/favicon.ico" type="image/svg+xml">
${THEME_BOOT}
<link rel="stylesheet" href="${DS_CSS}">
<style>
  /* app-specific bits, built only from design-system tokens */
  .container.narrow{max-width:720px!important}
  .site-header .logo{gap:var(--sp-xs);font-size:var(--fs-lg)}
  .site-header .logo span{color:var(--accent)}
  .pingo-logo{width:2.5rem;height:2.5rem;display:block;flex:none}
  .app-nav{display:flex;align-items:center;gap:var(--sp-md)}
  .app-nav ul{gap:var(--sp-md)}
  .app-nav button.link{background:none;border:0;padding:0;cursor:pointer;color:var(--text);opacity:.8}
  .app-nav button.link:hover,.app-nav button.link[aria-current="page"]{opacity:1;color:var(--accent)}
  [data-theme="light"] .app-nav button.link[aria-current="page"]{text-decoration:underline;text-decoration-color:var(--accent);text-underline-offset:.25em}

  .center{min-height:100vh;display:grid;place-items:center;padding:var(--sp-sm)}
  .login{width:100%;max-width:320px;text-align:center}
  .login .pingo-logo{width:6rem;height:6rem;margin:0 auto;animation:pinch 2.6s var(--ease) infinite;transform-origin:70% 60%}
  .login h1{margin:var(--sp-sm) 0 var(--sp-xs)}
  .login p{color:var(--text-muted);font-size:var(--fs-sm);margin-bottom:var(--sp-md)}
  .login form{flex-direction:column}
  @keyframes pinch{0%,60%,100%{transform:none}70%{transform:scale(.92) rotate(-4deg)}80%{transform:scale(1.02)}}
  @keyframes shake{25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
  .shake{animation:shake .3s}

  form{display:flex;gap:var(--sp-xs);flex-wrap:wrap}
  input{flex:1;min-width:0;padding:.8rem 1rem;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg-alt);color:var(--text-head);transition:border-color var(--dur) var(--ease)}
  input::placeholder{color:var(--text-muted)}
  input:focus{border-color:var(--accent)}
  input.slug{flex:0 0 11rem}
  input.full{flex-basis:100%}
  .btn{padding:.8rem 1.2rem;border:1px solid var(--accent);border-radius:var(--radius);background:var(--accent);color:var(--bg);font-weight:700;cursor:pointer;transition:opacity var(--dur) var(--ease),transform 80ms var(--ease)}
  .btn:hover{opacity:.9}.btn:active{transform:scale(.97)}
  .act{background:none;border:0;padding:.2rem .35rem;color:var(--text-muted);font-size:var(--fs-xs);cursor:pointer;border-radius:var(--radius)}
  .act:hover{color:var(--accent)}
  .act.danger:hover{color:hsl(0 60% 60%)}

  .err{color:hsl(0 60% 60%);font-size:var(--fs-sm);min-height:1.5em;margin-top:var(--sp-xs)}
  .hint{font-size:var(--fs-sm);color:var(--text-muted);margin:var(--sp-sm) 0 var(--sp-xs)}
  .box{padding:var(--sp-sm);border-radius:var(--radius);background:var(--bg-alt);border:1px solid var(--accent);display:flex;align-items:center;gap:var(--sp-xs)}
  .box a,.box code{flex:1;font-weight:700;word-break:break-all}
  .box code{color:var(--accent);font-size:var(--fs-sm)}

  .post-list{margin:var(--sp-sm) 0 0}
  .post-item{display:flex;align-items:center;gap:var(--sp-xs);padding:var(--sp-sm) 0}
  .post-item .info{flex:1;min-width:0}
  .post-item .info>a,.post-item .info>.s{font-size:var(--fs-md);font-weight:700;color:var(--text-head);text-decoration:none}
  .post-item .info>a:hover{color:var(--accent)}
  .post-item .badge{margin-left:var(--sp-xs);vertical-align:2px}
  .post-meta{margin:.2rem 0 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .clicks{font-size:var(--fs-sm);color:var(--accent);white-space:nowrap;margin-right:var(--sp-xs)}
  .actions{display:flex;flex-wrap:wrap;justify-content:flex-end}
  .empty{text-align:center;color:var(--text-muted);margin-top:var(--sp-xl);font-size:var(--fs-sm)}

  .toast{position:fixed;left:50%;bottom:var(--sp-md);transform:translateX(-50%) translateY(120px);background:var(--text-head);color:var(--bg);padding:.6rem 1rem;border-radius:var(--radius);font-size:var(--fs-sm);transition:transform var(--dur-slow) var(--ease-spring)}
  .toast.show{transform:translateX(-50%) translateY(0)}
  [hidden]{display:none!important}
  @media (max-width:600px){input.slug{flex:1 1 100%}.post-item{flex-wrap:wrap}.actions{width:100%;justify-content:flex-start;margin-left:-.35rem}}
</style>
</head>
<body>

<section id="login" class="center" hidden>
  <div class="login">
    ${LOGO}
    <h1>pingo</h1>
    <p>links, but pingo.</p>
    <form id="loginForm">
      <input id="pw" type="password" placeholder="password" autocomplete="current-password" autofocus required>
      <button class="btn">unlock</button>
    </form>
    <div class="err" id="loginErr"></div>
  </div>
</section>

<section id="app" hidden>
  <div class="container narrow">
    <header class="site-header">
      <a href="/" class="logo" aria-label="pingo home">${LOGO}<b>pingo<span>.</span></b></a>
      <nav class="app-nav tabs">
        <ul>
          <li><button class="link" data-tab="links" aria-current="page">links</button></li>
          <li><button class="link" data-tab="keys">keys</button></li>
          <li><button class="link" id="logout">lock</button></li>
        </ul>
        <div class="theme-switch-wrapper">
          <label class="theme-switch" for="theme-toggle" aria-label="Toggle dark/light mode">
            <input type="checkbox" id="theme-toggle"><div class="slider"></div>
          </label>
        </div>
      </nav>
    </header>

    <main id="tab-links">
      <form id="newForm">
        <input id="url" placeholder="paste a long link…" required autocomplete="off">
        <input id="slug" class="slug" placeholder="/custom-name" autocomplete="off">
        <button class="btn">shorten</button>
      </form>
      <div class="err" id="newErr"></div>
      <div class="box" id="result" hidden><a id="resultLink" target="_blank"></a><button class="act" id="resultCopy">copy</button></div>
      <ul class="post-list" id="list"></ul>
      <div class="empty" id="empty" hidden>no links yet — make your first pingo one 🤏</div>
    </main>

    <main id="tab-keys" hidden>
      <form id="keyForm">
        <input id="keyName" placeholder="app name, e.g. raycast" maxlength="40" required autocomplete="off">
        <button class="btn">new key</button>
        <input id="keyOrigins" class="full" placeholder="frontend domains (optional), e.g. myapp.com, localhost:5173" autocomplete="off">
      </form>
      <div class="err" id="keyErr"></div>
      <div id="secret" hidden>
        <div class="hint" id="secretHint"></div>
        <div class="box"><code id="secretVal"></code><button class="act" id="secretCopy">copy</button></div>
      </div>
      <ul class="post-list" id="keyList"></ul>
      <div class="empty" id="keysEmpty" hidden>no keys yet — one per app keeps things tidy</div>
    </main>
  </div>
</section>

<div class="toast" id="toast"></div>

<script>
const $ = (id) => document.getElementById(id);
const api = async (path, opts = {}) => {
  const r = await fetch("/api" + path, { ...opts, headers: { "content-type": "application/json" }, credentials: "same-origin" });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && path !== "/login") show("login");
  if (!r.ok) throw new Error(data.error || "Something went wrong");
  return data;
};
const show = (v) => { $("login").hidden = v !== "login"; $("app").hidden = v !== "app"; if (v === "login") $("pw").focus(); if (v === "app") tab("links"); };
const tab = (t) => {
  document.querySelectorAll(".tabs [data-tab]").forEach((b) => b.dataset.tab === t ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current"));
  $("tab-links").hidden = t !== "links"; $("tab-keys").hidden = t !== "keys";
  if (t === "links") { $("url").focus(); loadLinks(); } else { $("secret").hidden = true; loadKeys(); }
};
const toast = (msg) => { const t = $("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 1800); };
const copy = async (text) => { await navigator.clipboard.writeText(text); toast("copied"); };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const ago = (ts) => {
  if (!ts) return "never used";
  const s = (Date.now() - ts) / 1000;
  return s < 60 ? "used just now" : s < 3600 ? "used " + Math.floor(s / 60) + "m ago" : s < 86400 ? "used " + Math.floor(s / 3600) + "h ago" : "used " + Math.floor(s / 86400) + "d ago";
};

// ---- links ----
async function loadLinks() {
  const { links } = await api("/links");
  $("empty").hidden = links.length > 0;
  $("list").innerHTML = links.map((l) => \`
    <li class="post-item">
      <div class="info">
        <a href="\${esc(l.short)}" target="_blank" rel="noreferrer">/\${esc(l.slug)}</a>\${l.app ? \`<span class="badge">\${esc(l.app)}</span>\` : ""}
        <div class="post-meta" title="\${esc(l.url)}">\${esc(l.url)}</div>
      </div>
      <span class="clicks">\${l.clicks} click\${l.clicks === 1 ? "" : "s"}</span>
      <div class="actions">
        <button class="act" data-copy="\${esc(l.short)}">copy</button>
        <button class="act danger" data-del="\${esc(l.slug)}">delete</button>
      </div>
    </li>\`).join("");
}

$("list").addEventListener("click", async (e) => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.copy) copy(b.dataset.copy);
  if (b.dataset.del && confirm("delete /" + b.dataset.del + "?")) {
    await api("/links/" + encodeURIComponent(b.dataset.del), { method: "DELETE" }).then(() => { toast("deleted"); loadLinks(); }, (err) => toast(err.message));
  }
});

$("newForm").addEventListener("submit", async (e) => {
  e.preventDefault(); $("newErr").textContent = "";
  try {
    const l = await api("/links", { method: "POST", body: JSON.stringify({ url: $("url").value, slug: $("slug").value }) });
    $("url").value = ""; $("slug").value = "";
    $("resultLink").textContent = $("resultLink").href = l.short;
    $("result").hidden = false;
    copy(l.short).catch(() => {});
    loadLinks();
  } catch (err) { $("newErr").textContent = err.message; }
});
$("resultCopy").onclick = () => copy($("resultLink").href);

// ---- keys ----
const showSecret = (k, verb) => {
  $("secretHint").textContent = verb + " key for “" + k.name + "”. copy it now — you won't see it again.";
  $("secretVal").textContent = k.key; $("secret").hidden = false;
  copy(k.key).catch(() => {});
};

const showOrigins = (list) => list.map((o) => (o.startsWith("https://") ? o.slice(8) : o)).join(", ");

async function loadKeys() {
  const { keys } = await api("/keys");
  $("keysEmpty").hidden = keys.length > 0;
  $("keyList").innerHTML = keys.map((k) => \`
    <li class="post-item">
      <div class="info">
        <span class="s">\${esc(k.name)}</span>
        <div class="post-meta">\${esc(k.prefix)}… · \${k.links} link\${k.links === 1 ? "" : "s"} · \${ago(k.last_used_at)}</div>
        <div class="post-meta" title="\${esc(k.origins.join(", "))}">\${k.origins.length ? "web: " + esc(showOrigins(k.origins)) : "server only"}</div>
      </div>
      <div class="actions">
        <button class="act" data-act="origins" data-id="\${k.id}" data-name="\${esc(k.name)}" data-origins="\${esc(showOrigins(k.origins))}">domains</button>
        <button class="act" data-act="rename" data-id="\${k.id}" data-name="\${esc(k.name)}">rename</button>
        <button class="act" data-act="rotate" data-id="\${k.id}" data-name="\${esc(k.name)}">rotate</button>
        <button class="act danger" data-act="delete" data-id="\${k.id}" data-name="\${esc(k.name)}">delete</button>
      </div>
    </li>\`).join("");
}

$("keyList").addEventListener("click", async (e) => {
  const b = e.target.closest("button"); if (!b) return;
  const { act, id, name, origins } = b.dataset; $("keyErr").textContent = "";
  try {
    if (act === "rename") {
      const n = prompt("rename app", name); if (!n || n === name) return;
      await api("/keys/" + id, { method: "PATCH", body: JSON.stringify({ name: n }) }); toast("renamed");
    }
    if (act === "origins") {
      const v = prompt("frontend domains for “" + name + "” (comma separated, empty = server only)", origins);
      if (v === null || v === origins) return;
      await api("/keys/" + id, { method: "PATCH", body: JSON.stringify({ origins: v }) }); toast("domains saved");
    }
    if (act === "rotate") {
      if (!confirm("make a new secret for “" + name + "”? the old one stops working right away.")) return;
      showSecret(await api("/keys/" + id + "/rotate", { method: "POST" }), "new");
    }
    if (act === "delete") {
      if (!confirm("delete key “" + name + "”? the app loses access (its links stay).")) return;
      await api("/keys/" + id, { method: "DELETE" }); $("secret").hidden = true; toast("deleted");
    }
    loadKeys();
  } catch (err) { $("keyErr").textContent = err.message; }
});

$("keyForm").addEventListener("submit", async (e) => {
  e.preventDefault(); $("keyErr").textContent = "";
  try {
    showSecret(await api("/keys", { method: "POST", body: JSON.stringify({ name: $("keyName").value, origins: $("keyOrigins").value }) }), "new");
    $("keyName").value = ""; $("keyOrigins").value = ""; loadKeys();
  } catch (err) { $("keyErr").textContent = err.message; }
});
$("secretCopy").onclick = () => copy($("secretVal").textContent);

// ---- auth ----
document.querySelector(".tabs").addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (b) tab(b.dataset.tab); });
$("theme-toggle").checked = document.documentElement.dataset.theme === "light";
$("theme-toggle").onchange = (e) => { const t = e.target.checked ? "light" : "dark"; document.documentElement.dataset.theme = t; localStorage.setItem("theme", t); };

$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault(); $("loginErr").textContent = "";
  try { await api("/login", { method: "POST", body: JSON.stringify({ password: $("pw").value }) }); $("pw").value = ""; show("app"); }
  catch (err) { $("loginErr").textContent = err.message; const f = $("loginForm"); f.classList.remove("shake"); void f.offsetWidth; f.classList.add("shake"); $("pw").select(); }
});
$("logout").onclick = async () => { await api("/logout", { method: "POST" }); show("login"); };

api("/me").then(() => show("app")).catch(() => show("login"));
</script>
</body>
</html>`;
