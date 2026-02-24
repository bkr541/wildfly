import { fetchDeveloperSettings, type DeveloperSettings } from "./logSettings";

type LogLevel = "silent" | "error" | "warn" | "info" | "debug";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

function timestamp(): string {
  return new Date().toISOString().slice(11, 23);
}

function summarize(args: any[], showRaw: boolean): any[] {
  if (showRaw) return args;
  return args.map((a) => {
    if (a === null || a === undefined) return a;
    if (typeof a !== "object") return a;
    if (Array.isArray(a)) return `[Array(${a.length})]`;
    const keys = Object.keys(a);
    if (keys.length > 8) return `{Object: ${keys.length} keys: ${keys.slice(0, 5).join(", ")}…}`;
    return a;
  });
}

function shouldLog(
  level: LogLevel,
  namespace: string,
  s: DeveloperSettings | null,
): boolean {
  if (!s) return level === "error";
  if (!s.logging_enabled) return level === "error";

  if (level !== "error") {
    if (
      s.enabled_component_logging.length > 0 &&
      !s.enabled_component_logging.includes(namespace)
    ) {
      return false;
    }
  }

  const configLevel = (s.log_level || "info") as LogLevel;
  return LEVEL_PRIORITY[level] <= LEVEL_PRIORITY[configLevel];
}

export interface Logger {
  error: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  info: (...args: any[]) => void;
  debug: (...args: any[]) => void;
}

export function getLogger(namespace: string): Logger {
  let settingsCache: DeveloperSettings | null | undefined = undefined;

  const ensureSettings = async () => {
    if (settingsCache === undefined) {
      settingsCache = await fetchDeveloperSettings();
    }
    return settingsCache;
  };

  const log = (level: LogLevel, method: "error" | "warn" | "info" | "log") => {
    return (...args: any[]) => {
      ensureSettings().then((s) => {
        if (!shouldLog(level, namespace, s)) return;
        const processed = summarize(args, s?.show_raw_payload ?? false);
        console[method](`${timestamp()} [${namespace}]`, ...processed);
      });
    };
  };

  return {
    error: log("error", "error"),
    warn: log("warn", "warn"),
    info: log("info", "info"),
    debug: log("debug", "log"),
  };
}
