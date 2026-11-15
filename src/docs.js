export const docs = (o) => `# Pingo

> Pingo is a private URL shortener at ${o}. Use its HTTP API to turn long URLs into short ones
> (e.g. ${o}/ab3de). There is no SDK; use plain HTTP/fetch.

## 1. Get an API key (ask the human)

Keys are created by the owner in the browser at ${o} (password protected, "keys" tab). You cannot
create one yourself. Ask the human for a key for this app. It looks like \`pingo_<48 hex chars>\`.

- **Server-side** (backend, scripts, CLIs): store it as the env var \`PINGO_API_KEY\` (add the name,
  without the value, to \`.env.example\`). Never commit the key.
- **Frontend** (code running in a browser): the key must be created with this app's domains listed
  (e.g. \`myapp.com, *.vercel.app, localhost:5173\`), or browsers get 403. Tell the human which domains
  you need. A key in frontend code is public, so prefer calling Pingo from a backend if there is one.

Check the key works: \`GET /api/me\` → \`{"ok":true,"type":"key","app":"<key name>"}\`.

## 2. API

- Base URL: \`${o}\`
- Auth: \`Authorization: Bearer $PINGO_API_KEY\` (or \`x-api-key: $PINGO_API_KEY\`)
- Bodies and responses are JSON (\`content-type: application/json\`).

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | /api/links | \`{"url": "...", "slug"?: "..."}\` | 201 link |
| GET | /api/links | | \`{"links": [link]}\`, latest 500 created by this key |
| GET | /api/links/:slug | | link |
| DELETE | /api/links/:slug | | \`{"ok": true}\` |
| GET | /api/me | | key info |

\`link\` = \`{"slug", "url", "short", "clicks", "created_at" (ms epoch), "app"}\`.
Use \`short\` as the shareable URL. Visiting it redirects (302) to \`url\` and counts a click.

- \`url\`: http(s) only; missing scheme becomes https. Pingo links can't be shortened.
- \`slug\` (optional): 1-64 chars of \`[a-zA-Z0-9_-]\`. Omit it for a random 5-char slug.
- A key only sees and deletes the links it created.

### Example

\`\`\`bash
curl -X POST ${o}/api/links \\
  -H "Authorization: Bearer $PINGO_API_KEY" -H "content-type: application/json" \\
  -d '{"url":"https://example.com/some/long/path"}'
# {"slug":"ab3de","url":"https://example.com/some/long/path","short":"${o}/ab3de","clicks":0,...}
\`\`\`

\`\`\`js
async function shorten(url, slug) {
  const r = await fetch("${o}/api/links", {
    method: "POST",
    headers: { authorization: \`Bearer \${process.env.PINGO_API_KEY}\`, "content-type": "application/json" },
    body: JSON.stringify({ url, slug }),
    signal: AbortSignal.timeout(5000),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(\`pingo \${r.status}: \${data.error}\`);
  return data.short;
}
\`\`\`

## 3. Errors and limits

Errors are JSON: \`{"error": "..."}\`.

| Status | Meaning | What to do |
|---|---|---|
| 400 | invalid url or slug | fix input |
| 401 | missing or wrong key | ask the human for a valid key |
| 403 | browser origin not allowed for this key | ask the human to add the domain to the key |
| 404 | not found, or not this key's link | |
| 409 | slug already taken | pick another slug or omit it |
| 429 | rate limited | wait \`Retry-After\` seconds, don't retry in a loop |

Limits per key: about 120 requests/min, 30 new links/min, 1000 new links/day.

## 4. Guidance

- Wrap Pingo in one small helper (like \`shorten()\` above) with a timeout, not scattered fetch calls.
- If shortening fails, fall back to the original long URL instead of breaking the feature.
- Pingo doesn't deduplicate: store or cache \`short\` if the same URL is shortened repeatedly.
`;
