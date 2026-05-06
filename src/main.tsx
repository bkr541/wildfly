// Run recovery before importing the app. Static imports can execute modules that
// initialize Lovable Cloud immediately, so cleanup must happen first.
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

recoverFromStaleServiceWorkers()
  .catch(() => {})
  .finally(async () => {
    const [{ createRoot }, { default: App }] = await Promise.all([
      import("react-dom/client"),
      import("./App.tsx"),
      import("./index.css"),
    ]);

    createRoot(document.getElementById("root")!).render(<App />);
  });
