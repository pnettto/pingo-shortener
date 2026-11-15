// pingo logo: an emoji-style "pinching hand" (🤏) — "pingo" = tiny, informal pt-BR.
// Built from stroked paths: dark outline strokes first, then yellow fills on top so fingers merge into the fist.
const OUTLINE = "#A35F00";
const SKIN = "#FFC83D";
const FINGERS = `<path d="M38 24 C28 20 16 20 12 28"/><path d="M39 46 C29 48 17 46 13 41"/>`;

export const LOGO = `<svg class="pingo-logo" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="pingo"><g transform="rotate(-18 34 34)" stroke-linecap="round" stroke-linejoin="round" fill="none"><g stroke="${OUTLINE}" stroke-width="11.5">${FINGERS}</g><path d="M36 18h10a12 12 0 0 1 12 12v12a14 14 0 0 1-14 14h-4a10 10 0 0 1-10-10V28a10 10 0 0 1 6-10z" fill="${SKIN}" stroke="${OUTLINE}" stroke-width="2.5"/><g stroke="${SKIN}" stroke-width="7">${FINGERS}</g><g stroke="${OUTLINE}" stroke-width="2.5"><path d="M47 30q5 0 7-1.5"/><path d="M47 37q5 0 7-1.5"/><path d="M46 44q4 0 6.5-1.5"/></g></g></svg>`;

// Design system (https://github.com/pnettto/design-system) via jsDelivr (serves the committed dist/); pinned to a tag so upgrades are deliberate.
export const DS_CSS = "https://cdn.jsdelivr.net/gh/pnettto/design-system@v1.0.7/dist/css/bundle.min.css";

// Theme: follows the OS (live) unless the user picked the *other* theme with the toggle. Uses the design system's
// convention (localStorage "theme", data-theme on <html>), inlined in <head> to avoid a flash. We skip the DS JS
// bundle: its link prefetcher would "visit" short links. Picking the theme that matches the OS clears the override.
export const THEME_BOOT = `<script>(function(){var d=document.documentElement,q=matchMedia("(prefers-color-scheme: light)"),sys=function(){return q.matches?"light":"dark"},apply=function(){var t=localStorage.getItem("theme")||sys();d.setAttribute("data-theme",t);var c=document.getElementById("theme-toggle");if(c)c.checked=t==="light"};window.pingoTheme=function(t){t===sys()?localStorage.removeItem("theme"):localStorage.setItem("theme",t);apply()};apply();q.addEventListener("change",apply);requestAnimationFrame(function(){requestAnimationFrame(function(){d.classList.add("theme-ready")})})})()</script>`;
