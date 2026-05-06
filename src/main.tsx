import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Defensive cleanup: unregister any previously-registered service workers
// and clear caches so stale PWA shells can't brick the app.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((r) => r.unregister());
  });
  if ("caches" in window) {
    caches.keys().then((names) => names.forEach((n) => caches.delete(n)));
  }
}

createRoot(document.getElementById("root")!).render(<App />);
