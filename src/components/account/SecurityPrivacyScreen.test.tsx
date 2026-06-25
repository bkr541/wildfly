import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const resetMock = vi.fn();
vi.mock("@/lib/resetClientAppData", () => ({
  resetClientAppData: (...args: unknown[]) => resetMock(...args),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { signOut: vi.fn(), updateUser: vi.fn() } },
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import SecurityPrivacyScreen from "./SecurityPrivacyScreen";

describe("SecurityPrivacyScreen Reset App Data", () => {
  beforeEach(() => {
    resetMock.mockReset();
  });

  it("opens the destructive dialog and invokes the reset once", async () => {
    let resolveReset: () => void = () => {};
    resetMock.mockImplementation(() => new Promise<void>((r) => { resolveReset = r; }));

    render(<SecurityPrivacyScreen onBack={() => {}} />);
    fireEvent.click(screen.getByTestId("reset-app-data-trigger"));

    expect(await screen.findByText("Reset Wildfly on this device?")).toBeInTheDocument();
    expect(screen.getByText(/signed out of Wildfly/i)).toBeInTheDocument();
    expect(screen.getByText(/locally stored settings, cookies, caches/i)).toBeInTheDocument();
    expect(screen.getByText(/account, subscription, profile/i)).toBeInTheDocument();

    const confirm = screen.getByTestId("reset-app-data-confirm");
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    await waitFor(() => expect(resetMock).toHaveBeenCalledTimes(1));
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect(confirm.textContent).toMatch(/resetting/i);
    resolveReset();
  });
});
