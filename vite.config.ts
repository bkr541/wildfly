import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const SUPABASE_URL = "https://ejgxmkglklyumyycpvgi.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqZ3hta2dsa2x5dW15eWNwdmdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NzQzOTIsImV4cCI6MjA4NzA1MDM5Mn0.Ouk-mT1uW8_dSTHqYzkix65gL0XLtmlhp6RyfaSJH7A";
const SUPABASE_PROJECT_ID = "ejgxmkglklyumyycpvgi";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
      {
        name: "wildfly-reset-app-data-endpoint",
        configureServer(server: import("vite").ViteDevServer) {
          server.middlewares.use(
            "/api/reset-app-data",
            (
              req: import("http").IncomingMessage,
              res: import("http").ServerResponse,
            ) => {
              if (req.method !== "POST") {
                if (req.method === "OPTIONS") {
                  res.statusCode = 204;
                  res.setHeader("Allow", "POST");
                  res.end();
                  return;
                }
                res.statusCode = 405;
                res.setHeader("Allow", "POST");
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: false, error: "Method Not Allowed" }));
                return;
              }
              res.statusCode = 200;
              res.setHeader("Content-Type", "application/json");
              res.setHeader("Cache-Control", "no-store");
              res.setHeader("Clear-Site-Data", '"cache", "cookies", "storage"');
              res.end(JSON.stringify({ ok: true, message: "Wildfly local app data cleared." }));
            },
          );
        },
      },

    ].filter(Boolean),

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(SUPABASE_URL),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(SUPABASE_PUBLISHABLE_KEY),
      "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(SUPABASE_PROJECT_ID),
    },
  };
});
