export const PAGE = /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>pingo</title>
<link rel="icon" href="/favicon.ico">
<style>
  :root{--bg:#fdf8f3;--card:#fff;--ink:#3b3a4a;--muted:#9a97a8;--line:#efe8e0;--accent:#ff8a65;--accent2:#ffd3c2;--ok:#7cc6a4}
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;font-family:ui-rounded,"SF Pro Rounded",system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--ink)}
  .wrap{max-width:560px;margin:0 auto;padding:56px 20px}
  .center{min-height:100vh;display:grid;place-items:center;padding:20px}
  .logo{font-size:56px;line-height:1;text-align:center;animation:bob 3s ease-in-out infinite;user-select:none}
  @keyframes bob{50%{transform:translateY(-6px) rotate(-3deg)}}
  @keyframes shake{25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
  h1{font-size:22px;text-align:center;margin:10px 0 28px;font-weight:700;letter-spacing:-.3px}
  h1 span{color:var(--accent)}
  form{display:flex;gap:8px;flex-wrap:wrap}
  input{flex:1;min-width:0;font:inherit;padding:14px 16px;border:2px solid var(--line);border-radius:16px;background:var(--card);color:var(--ink);outline:none;transition:border-color .15s}
  input:focus{border-color:var(--accent2)}
  input.slug{flex:0 0 140px}
  button{font:inherit;font-weight:600;padding:14px 20px;border:0;border-radius:16px;background:var(--accent);color:#fff;cursor:pointer;transition:transform .1s,opacity .15s}
  button:hover{opacity:.9}button:active{transform:scale(.97)}
  button.ghost{background:none;color:var(--muted);padding:6px 10px;font-weight:500}
  .login{width:100%;max-width:300px}
  .login form{flex-direction:column}
  .shake{animation:shake .3s}
  .err{color:#e57373;font-size:14px;text-align:center;min-height:20px;margin-top:10px}
  .result{margin-top:14px;padding:14px 16px;border-radius:16px;background:#fff4ee;display:none;align-items:center;gap:10px}
  .result.show{display:flex}
  .result a{flex:1;color:var(--accent);font-weight:600;text-decoration:none;word-break:break-all}
  ul{list-style:none;padding:0;margin:32px 0 0}
  li{display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--card);border:2px solid var(--line);border-radius:16px;margin-bottom:8px}
  li .info{flex:1;min-width:0}
  li .s{font-weight:600;color:var(--ink);text-decoration:none}
  li .u{font-size:13px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  li .c{font-size:13px;color:var(--muted);white-space:nowrap}
  .icon{background:none;color:var(--muted);padding:6px 8px;font-size:15px;border-radius:10px}
  .icon:hover{background:var(--bg);opacity:1}
  .empty{text-align:center;color:var(--muted);margin-top:40px;font-size:14px}
  .top{display:flex;justify-content:flex-end;margin-bottom:-30px}
  .toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%) translateY(80px);background:var(--ink);color:#fff;padding:10px 16px;border-radius:12px;font-size:14px;transition:transform .25s}
  .toast.show{transform:translateX(-50%) translateY(0)}
  [hidden]{display:none!important}
  @media (prefers-color-scheme:dark){:root{--bg:#1f1e26;--card:#2a2933;--ink:#f1eef7;--muted:#8e8a9c;--line:#34323e;--accent2:#7a4a3a}.result{background:#3a2c2a}}
</style>
</head>
<body>

<section id="login" class="center" hidden>
  <div class="login">
    <div class="logo">🐧</div>
    <h1>pingo</h1>
    <form id="loginForm">
      <input id="pw" type="password" placeholder="password" autocomplete="current-password" autofocus required>
      <button>unlock</button>
    </form>
    <div class="err" id="loginErr"></div>
  </div>
</section>

<section id="app" hidden>
  <div class="wrap">
    <div class="top"><button class="ghost" id="logout">lock 🔒</button></div>
    <div class="logo">🐧</div>
    <h1>pingo<span>.</span></h1>
    <form id="newForm">
      <input id="url" placeholder="paste a long link…" required autocomplete="off">
      <input id="slug" class="slug" placeholder="/custom-name" autocomplete="off">
      <button>shorten</button>
    </form>
    <div class="err" id="newErr"></div>
    <div class="result" id="result"><a id="resultLink" target="_blank"></a><button class="icon" id="resultCopy" title="copy">📋</button></div>
    <ul id="list"></ul>
    <div class="empty" id="empty" hidden>no links yet — make your first one ✨</div>
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
const show = (v) => { $("login").hidden = v !== "login"; $("app").hidden = v !== "app"; if (v === "login") $("pw").focus(); if (v === "app") { $("url").focus(); load(); } };
const toast = (msg) => { const t = $("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 1600); };
const copy = async (text) => { await navigator.clipboard.writeText(text); toast("copied ✨"); };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

async function load() {
  const { links } = await api("/links");
  $("empty").hidden = links.length > 0;
  $("list").innerHTML = links.map((l) => \`
    <li>
      <div class="info">
        <a class="s" href="\${esc(l.short)}" target="_blank">/\${esc(l.slug)}</a>
        <div class="u" title="\${esc(l.url)}">\${esc(l.url)}</div>
      </div>
      <span class="c">\${l.clicks} 👀</span>
      <button class="icon" data-copy="\${esc(l.short)}" title="copy">📋</button>
      <button class="icon" data-del="\${esc(l.slug)}" title="delete">🗑️</button>
    </li>\`).join("");
}

$("list").addEventListener("click", async (e) => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.copy) copy(b.dataset.copy);
  if (b.dataset.del && confirm("delete /" + b.dataset.del + "?")) {
    await api("/links/" + encodeURIComponent(b.dataset.del), { method: "DELETE" });
    toast("deleted 👋"); load();
  }
});

$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault(); $("loginErr").textContent = "";
  try { await api("/login", { method: "POST", body: JSON.stringify({ password: $("pw").value }) }); $("pw").value = ""; show("app"); }
  catch (err) { $("loginErr").textContent = err.message; const f = $("loginForm"); f.classList.remove("shake"); void f.offsetWidth; f.classList.add("shake"); $("pw").select(); }
});

$("newForm").addEventListener("submit", async (e) => {
  e.preventDefault(); $("newErr").textContent = "";
  try {
    const l = await api("/links", { method: "POST", body: JSON.stringify({ url: $("url").value, slug: $("slug").value }) });
    $("url").value = ""; $("slug").value = "";
    $("resultLink").textContent = $("resultLink").href = l.short;
    $("result").classList.add("show");
    copy(l.short).catch(() => {});
    load();
  } catch (err) { $("newErr").textContent = err.message; }
});

$("resultCopy").onclick = () => copy($("resultLink").href);
$("logout").onclick = async () => { await api("/logout", { method: "POST" }); show("login"); };

api("/me").then(() => show("app")).catch(() => show("login"));
</script>
</body>
</html>`;
