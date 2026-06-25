import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { recoverFromStaleServiceWorkers } from "./lib/resetClientAppData";

void recoverFromStaleServiceWorkers().catch(() => {});

createRoot(document.getElementById("root")!).render(<App />);
