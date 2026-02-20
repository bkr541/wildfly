import { ChevronLeft } from "lucide-react";
import { ReactNode, useState } from "react";
import DiscardModal from "./DiscardModal";

interface SubScreenLayoutProps {
  title: string;
  subtitle: string;
  onBack: () => void;
  isDirty: boolean;
  isSaving: boolean;
  onSave: () => void;
  children: ReactNode;
  /** Set to false to hide save button (e.g. Security screen) */
  showSaveButton?: boolean;
}

const SubScreenLayout = ({
  title,
  subtitle,
  onBack,
  isDirty,
  isSaving,
  onSave,
  children,
  showSaveButton = true,
}: SubScreenLayoutProps) => {
  const [showDiscard, setShowDiscard] = useState(false);

  const handleBack = () => {
    if (isDirty) {
      setShowDiscard(true);
    } else {
      onBack();
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <div className="flex items-center px-6 pt-10 pb-2">
        <button onClick={handleBack} className="mr-3 text-foreground">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-bold text-foreground">{title}</h1>
      </div>

      <div className="px-6 pb-2">
        <p className="text-muted-foreground text-sm">{subtitle}</p>
      </div>

      <div className="flex-1 px-6 pb-6 flex flex-col">{children}</div>

      {showSaveButton && (
        <div className="sticky bottom-0 px-6 pb-6 pt-3 bg-background">
          <button
            onClick={onSave}
            disabled={!isDirty || isSaving}
            className="w-full py-3 rounded-lg bg-foreground text-background font-bold text-sm tracking-widest uppercase hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isSaving ? "Saving..." : isDirty ? "Save Changes" : "No Changes"}
          </button>
        </div>
      )}

      <DiscardModal
        open={showDiscard}
        onDiscard={onBack}
        onCancel={() => setShowDiscard(false)}
      />
    </div>
  );
};

export default SubScreenLayout;
