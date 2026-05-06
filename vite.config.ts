import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const cloudEnv = {
  VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || "https://ejgxmkglklyumyycpvgi.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY:
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqZ3hta2dsa2x5dW15eWNwdmdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NzQzOTIsImV4cCI6MjA4NzA1MDM5Mn0.Ouk-mT1uW8_dSTHqYzkix65gL0XLtmlhp6RyfaSJH7A",
  VITE_SUPABASE_PROJECT_ID: process.env.VITE_SUPABASE_PROJECT_ID || "ejgxmkglklyumyycpvgi",
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(cloudEnv.VITE_SUPABASE_URL),
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(cloudEnv.VITE_SUPABASE_PUBLISHABLE_KEY),
    "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(cloudEnv.VITE_SUPABASE_PROJECT_ID),
  },
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
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
