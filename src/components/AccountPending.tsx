import { HugeiconsIcon } from "@hugeicons/react";
import { TimerIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";

interface AccountPendingProps {
  onSignOut: () => void;
}

const AccountPending = ({ onSignOut }: AccountPendingProps) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 min-h-screen bg-background">
      <div className="flex flex-col items-center text-center gap-4 max-w-sm">
        <div className="h-16 w-16 rounded-full bg-surface-active flex items-center justify-center mb-2">
          <HugeiconsIcon icon={TimerIcon} size={28} color="#047857" strokeWidth={1.5} />
        </div>

        <h1 className="text-xl font-bold text-[#2E4A4A]">Account Pending</h1>

        <p className="text-sm text-[#6B7B7B] leading-relaxed">
          Your account is currently awaiting approval. You'll be able to access the app once an administrator has reviewed and approved your account.
        </p>

        <Button
          onClick={onSignOut}
          className="mt-4 w-full rounded-xl h-11 text-sm font-semibold"
        >
          Sign Out
        </Button>
      </div>
    </div>
  );
};

export default AccountPending;
