import { HugeiconsIcon } from "@hugeicons/react";
import { Logout01Icon } from "@hugeicons/core-free-icons";

interface AccountPendingProps {
  onSignOut: () => void;
}

const AccountPending = ({ onSignOut }: AccountPendingProps) => {
  return (
    <div
      className="flex-1 flex flex-col items-center justify-center px-8 min-h-screen"
      style={{ background: "linear-gradient(160deg, #059669 0%, #047857 60%, #065f46 100%)" }}
    >
      <div className="flex flex-col items-center text-center gap-5 max-w-xs">
        {/* Hero image */}
        <img
          src="/misc/accountpendinghero.png"
          alt="Account pending"
          className="w-56 h-56 object-contain mb-1"
        />

        {/* Heading */}
        <h1 className="text-wf-md font-black text-white tracking-tight">Account Pending</h1>

        {/* Body */}
        <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.78)" }}>
          Your account is awaiting approval. You'll have full access once an administrator reviews and approves your request.
        </p>

        {/* Sign out button */}
        <button
          type="button"
          onClick={onSignOut}
          className="mt-3 w-full h-12 rounded-full flex items-center justify-center gap-2 text-sm font-semibold transition-all active:scale-[0.98]"
          style={{
            background: "rgba(255,255,255,0.15)",
            border: "1.5px solid rgba(255,255,255,0.35)",
            color: "white",
          }}
        >
          <HugeiconsIcon icon={Logout01Icon} size={16} color="white" strokeWidth={2} />
          Sign Out
        </button>
      </div>
    </div>
  );
};

export default AccountPending;
