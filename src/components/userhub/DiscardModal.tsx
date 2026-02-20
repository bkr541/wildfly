import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface DiscardModalProps {
  open: boolean;
  onDiscard: () => void;
  onCancel: () => void;
}

const DiscardModal = ({ open, onDiscard, onCancel }: DiscardModalProps) => (
  <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
    <DialogContent className="max-w-sm">
      <DialogHeader>
        <DialogTitle>Discard changes?</DialogTitle>
        <DialogDescription>
          You have unsaved changes. If you go back now, your changes will be lost.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter className="flex-row gap-2">
        <button
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-lg border border-border text-foreground text-sm font-semibold hover:bg-secondary transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onDiscard}
          className="flex-1 py-2.5 rounded-lg bg-destructive text-destructive-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Discard
        </button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default DiscardModal;
