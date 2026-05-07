import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const recoverFromStaleServiceWorkers = async () => {
  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }

  if ("caches" in window) {
    const names = await caches.keys();
    await Promise.all(names.map((name) => caches.delete(name)));
  }
};

void recoverFromStaleServiceWorkers().catch(() => {});

createRoot(document.getElementById("root")!).render(<App />);
