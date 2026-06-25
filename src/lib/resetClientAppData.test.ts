import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const signOutMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { signOut: (...args: unknown[]) => signOutMock(...args) } },
}));

// Imported after the mock so the module under test picks up the mocked client.
import {
  resetClientAppData,
  recoverFromStaleServiceWorkers,
  unregisterAllServiceWorkers,
  deleteAllCacheStorage,
} from "./resetClientAppData";

type AnyRecord = Record<string, unknown>;

const setLocation = () => {
  const replace = vi.fn();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      replace,
      hostname: "wildfly.app",
      href: "https://wildfly.app/",
      origin: "https://wildfly.app",
    },
  });
  return replace;
};

describe("resetClientAppData", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let unregister: ReturnType<typeof vi.fn>;
  let cacheDelete: ReturnType<typeof vi.fn>;
  let cacheKeys: ReturnType<typeof vi.fn>;
  let dbsList: ReturnType<typeof vi.fn>;
  let deleteDatabase: ReturnType<typeof vi.fn>;
  let replace: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    signOutMock.mockReset().mockResolvedValue({ error: null });

    fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    window.localStorage.setItem("wildfly:test", "1");
    window.sessionStorage.setItem("wildfly:test", "1");

    unregister = vi.fn().mockResolvedValue(true);
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { getRegistrations: vi.fn().mockResolvedValue([{ unregister }, { unregister }]) },
    });

    cacheDelete = vi.fn().mockResolvedValue(true);
    cacheKeys = vi.fn().mockResolvedValue(["wildfly-v1", "wildfly-v2"]);
    vi.stubGlobal("caches", { keys: cacheKeys, delete: cacheDelete });

    deleteDatabase = vi.fn().mockImplementation(() => {
      const req: AnyRecord = { onsuccess: null, onerror: null, onblocked: null };
      queueMicrotask(() => (req.onsuccess as (() => void) | null)?.());
      return req;
    });
    dbsList = vi.fn().mockResolvedValue([{ name: "wildfly-db" }, { name: "another" }]);
    vi.stubGlobal("indexedDB", { databases: dbsList, deleteDatabase });

    Object.defineProperty(document, "cookie", {
      configurable: true,
      get: () => "session=abc; theme=dark",
      set: () => {},
    });
    const cookieSetter = vi.fn();
    Object.defineProperty(document, "cookie", {
      configurable: true,
      get: () => "session=abc; theme=dark",
      set: cookieSetter,
    });
    (document as unknown as AnyRecord)._cookieSetter = cookieSetter;

    replace = setLocation();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("requests a local Supabase sign-out", async () => {
    await resetClientAppData();
    expect(signOutMock).toHaveBeenCalledWith({ scope: "local" });
  });

  it("calls the same-origin endpoint with POST and credentials", async () => {
    await resetClientAppData();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/reset-app-data",
      expect.objectContaining({ method: "POST", credentials: "include", cache: "no-store" }),
    );
  });

  it("clears local and session storage", async () => {
    await resetClientAppData();
    expect(window.localStorage.getItem("wildfly:test")).toBeNull();
    expect(window.sessionStorage.getItem("wildfly:test")).toBeNull();
  });

  it("deletes every Cache Storage entry", async () => {
    await resetClientAppData();
    expect(cacheKeys).toHaveBeenCalled();
    expect(cacheDelete).toHaveBeenCalledWith("wildfly-v1");
    expect(cacheDelete).toHaveBeenCalledWith("wildfly-v2");
  });

  it("unregisters every service worker", async () => {
    await resetClientAppData();
    expect(unregister).toHaveBeenCalledTimes(2);
  });

  it("deletes IndexedDB databases when supported", async () => {
    await resetClientAppData();
    expect(dbsList).toHaveBeenCalled();
    expect(deleteDatabase).toHaveBeenCalledWith("wildfly-db");
    expect(deleteDatabase).toHaveBeenCalledWith("another");
  });

  it("expires JavaScript-accessible cookies", async () => {
    await resetClientAppData();
    const setter = (document as unknown as AnyRecord)._cookieSetter as ReturnType<typeof vi.fn>;
    const written = setter.mock.calls.map((c) => String(c[0]));
    expect(written.some((s) => s.startsWith("session=;"))).toBe(true);
    expect(written.some((s) => s.startsWith("theme=;"))).toBe(true);
    expect(written.every((s) => s.includes("expires=Thu, 01 Jan 1970"))).toBe(true);
  });

  it("redirects to / at the end", async () => {
    await resetClientAppData();
    expect(replace).toHaveBeenCalledWith("/");
  });

  it("continues when Supabase sign-out fails", async () => {
    signOutMock.mockRejectedValueOnce(new Error("network"));
    await resetClientAppData();
    expect(replace).toHaveBeenCalledWith("/");
    expect(fetchMock).toHaveBeenCalled();
  });

  it("continues when the API endpoint is unavailable", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    await resetClientAppData();
    expect(replace).toHaveBeenCalledWith("/");
    expect(cacheDelete).toHaveBeenCalled();
  });

  it("does not throw when IndexedDB enumeration is unsupported", async () => {
    vi.stubGlobal("indexedDB", {});
    await expect(resetClientAppData()).resolves.toBeUndefined();
    expect(replace).toHaveBeenCalledWith("/");
  });

  it("does not throw when Cache Storage is unsupported", async () => {
    vi.stubGlobal("caches", undefined);
    await expect(resetClientAppData()).resolves.toBeUndefined();
    expect(replace).toHaveBeenCalledWith("/");
  });

  it("does not throw when service-worker access is unsupported", async () => {
    Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: undefined });
    await expect(resetClientAppData()).resolves.toBeUndefined();
    expect(replace).toHaveBeenCalledWith("/");
  });

  it("does not let one rejected cleanup promise stop others", async () => {
    cacheDelete.mockRejectedValueOnce(new Error("denied"));
    unregister.mockRejectedValueOnce(new Error("denied"));
    await resetClientAppData();
    // Other cache + worker calls still ran.
    expect(cacheDelete).toHaveBeenCalledTimes(2);
    expect(unregister).toHaveBeenCalledTimes(2);
    expect(replace).toHaveBeenCalledWith("/");
  });

  it("shares cleanup helpers with the startup recovery flow", async () => {
    await recoverFromStaleServiceWorkers();
    expect(unregister).toHaveBeenCalled();
    expect(cacheDelete).toHaveBeenCalled();
  });

  it("exposes individual helpers that are safe no-ops when APIs are missing", async () => {
    vi.stubGlobal("caches", undefined);
    Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: undefined });
    await expect(unregisterAllServiceWorkers()).resolves.toBeUndefined();
    await expect(deleteAllCacheStorage()).resolves.toBeUndefined();
  });
});
