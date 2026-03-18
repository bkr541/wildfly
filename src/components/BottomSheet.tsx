import { useEffect, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { cn } from "@/lib/utils";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Extra classes applied to the sheet panel (e.g. height variants) */
  className?: string;
  /** Extra inline styles applied to the sheet panel */
  style?: CSSProperties;
}

/**
 * Shared bottom-sheet wrapper.
 * - Portals to document.body so z-index is always correct.
 * - Locks body scroll while open.
 * - Drag-to-dismiss via the handle bar only (won't fight scrollable content).
 */
export function BottomSheet({ open, onClose, children, className, style }: BottomSheetProps) {
  const dragControls = useDragControls();

  // Lock body scroll while sheet is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="bs-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[9998] bg-black/40"
            onClick={onClose}
          />

          {/* Sheet panel */}
          <motion.div
            key="bs-panel"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 340 }}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.2 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 80 || info.velocity.y > 500) {
                onClose();
              }
            }}
            className={cn(
              "fixed inset-x-0 bottom-0 z-[9999] flex flex-col bg-white rounded-t-3xl shadow-2xl",
              className,
            )}
            style={style}
          >
            {/* Draggable handle — drag only initiates from here */}
            <div
              className="flex justify-center pt-3 pb-1 touch-none select-none cursor-grab active:cursor-grabbing"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div className="h-1 w-10 rounded-full bg-[#D1D5DB]" />
            </div>

            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
