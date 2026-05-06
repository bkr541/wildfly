## What's happening

Your servers are healthy — both `https://wildfly.app` and `https://wildfly.lovable.app` return `200 OK` with fresh HTML when I curl them. So the site itself is up.

The reason your phones won't load anything (even after clearing cookies/site data in the browser UI) is almost certainly a **stuck service worker** from a previous deploy:

- This project uses `vite-plugin-pwa` with `registerType: "autoUpdate"` and a `NetworkFirst`/cache strategy.
- A previous build was deployed without the Supabase env vars baked in (that's the `supabaseUrl is required` error you hit earlier in a new tab).
- Your installed PWA / Safari + Chrome on the phone registered that broken service worker. Once registered, the SW intercepts every navigation and keeps serving the broken cached shell — even after you clear browsing data, because "Clear browsing data" in iOS Safari and Chrome does **not** always unregister service workers, and an installed PWA keeps its own cache bucket.
- Result: the phone boots the cached broken JS, it throws on `createClient(undefined, ...)`, and you see a blank/white screen or it just doesn't load.

This won't fix itself by re-publishing — the broken SW on each device decides what to load before any new build is fetched.

## The fix

Two parts:

### 1. Ship a kill-switch service worker (recovery)

Add a tiny static `public/sw.js` that:
- Takes control immediately (`skipWaiting` + `clients.claim`)
- Deletes every cache
- Force-navigates open clients to a fresh URL
- Unregisters itself

Because `vite-plugin-pwa` registers at `/sw.js`, devices currently running the old SW will check that URL on next visit, see the new one, install it, and self-clean. After that, the next reload loads the live site normally.

The Lovable proxy already serves `/sw.js` with `Cache-Control: no-cache`, so the new file propagates fast.

### 2. Remove `vite-plugin-pwa` (or guard it properly)

Two options — I'd like you to pick:

- **A. Remove PWA entirely.** You keep installability (Add to Home Screen still works because of your manifest meta tags in `index.html`), but no service worker, no offline page, no caching layer that can ever brick the app again. This is what Lovable recommends by default.
- **B. Keep PWA but make it safe.** Disable SW in dev, deny-list iframes/preview hosts so it never registers in the Lovable editor, switch HTML to `NetworkFirst` (already partially the case), and keep the kill-switch around for a release cycle.

Either way, we ship the kill-switch first so existing devices recover.

## What you'll need to do on each device once

After the fix is published:

- **iOS Safari (browser tab):** Visit `https://wildfly.app` once. The new SW activates and reloads the page clean.
- **Installed PWA on home screen:** Open it once — same thing, it'll reload itself. If it still shows blank after one open, delete the home-screen icon and re-add from Safari (this nukes the install-time cache).
- **Chrome on Android/iOS:** Same — one visit triggers the cleanup.

## Files I'd touch

- `public/sw.js` (new) — kill-switch worker
- `public/service-worker.js` (new, same contents) — belt-and-braces for any device that registered under the alternate path
- `src/main.tsx` — remove `registerSW` call (Option A) or guard it against iframe/preview hosts (Option B)
- `vite.config.ts` — remove `VitePWA` plugin (Option A) or harden it (Option B)
- `package.json` — remove `vite-plugin-pwa` dep (Option A only)

## Question for you

Which option do you want?

- **A — Remove PWA** (simplest, safest, recommended)
- **B — Keep PWA, harden it**

I'll ship the kill-switch either way; the choice only changes what happens going forward.
