import { afterEach, describe, expect, it, vi } from "vitest";
import { resetViewportScroll } from "./viewportScroll";

describe("resetViewportScroll", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("blurs the active control and resets every document scroll surface", () => {
    const scrollTo = vi.fn();
    Object.defineProperty(window, "scrollTo", { configurable: true, value: scrollTo });

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    const blur = vi.spyOn(input, "blur");

    document.documentElement.scrollTop = 120;
    document.body.scrollTop = 80;

    resetViewportScroll();

    expect(blur).toHaveBeenCalledOnce();
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "auto" });
    expect(document.documentElement.scrollTop).toBe(0);
    expect(document.body.scrollTop).toBe(0);
  });

  it("can preserve focus while still resetting scroll", () => {
    const scrollTo = vi.fn();
    Object.defineProperty(window, "scrollTo", { configurable: true, value: scrollTo });

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    const blur = vi.spyOn(input, "blur");

    resetViewportScroll({ blurActiveElement: false });

    expect(blur).not.toHaveBeenCalled();
    expect(scrollTo).toHaveBeenCalledOnce();
  });
});
