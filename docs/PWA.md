# Wildfly PWA Guide

## Testing on iPhone

1. Open Safari on your iPhone and navigate to the app URL.
2. Tap the **Share** button (rectangle with arrow pointing up).
3. Scroll down and tap **"Add to Home Screen"**.
4. Name it "Wildfly" and tap **Add**.
5. Open the app from the Home Screen — it should launch without Safari's browser UI.

## Confirming Standalone Mode

Once installed, the app launches in `standalone` mode (no address bar or Safari controls). You can verify this in code:

```js
window.navigator.standalone === true // iOS
window.matchMedia('(display-mode: standalone)').matches // Chrome/Android
```

## Updating Icons

Icons live in `/public/assets/icons/`:
- `icon-192.png` — Used by Android/Chrome PWA
- `icon-512.png` — Used by Android splash screen and iOS touch icon

After replacing the images, bump the service worker cache version in `/public/sw.js`:
```js
const CACHE_NAME = 'wildfly-v2'; // increment this
```

## Cache Update Notes

- The service worker uses **cache-first** for static assets (JS, CSS, images).
- Navigation requests use **network-first** with an offline fallback (`/offline.html`).
- On app update, `skipWaiting()` is called so the new SW activates immediately.
- Old caches from previous versions are pruned on `activate`.

## Offline Page

If the network is unavailable during navigation, the user sees `/offline.html` — a simple branded fallback with a **Retry** button.
