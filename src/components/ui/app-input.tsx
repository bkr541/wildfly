import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";
import { ViewIcon, ViewOffSlashIcon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

export interface AppInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  icon?: IconSvgElement;
  label?: string;
  error?: string;
  clearable?: boolean;
  onClear?: () => void;
  isPassword?: boolean;
  type?: string;
  wrapperClassName?: string;
  labelClassName?: string;
  borderColor?: string;
  /** When provided and input is focused + has value, replaces the eye icon with this strength label */
  strengthLabel?: string;
  /** Color for the strength label text */
  strengthColor?: string;
}

const AppInput = React.forwardRef<HTMLInputElement, AppInputProps>(
  (
    {
      icon,
      label,
      error,
      clearable = false,
      onClear,
      isPassword = false,
      type,
      wrapperClassName,
      labelClassName,
      borderColor,
      strengthLabel,
      strengthColor,
      className,
      value,
      onChange,
      onFocus,
      onBlur,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = React.useState(false);
    const [isFocused, setIsFocused] = React.useState(false);

    const resolvedType = isPassword ? (showPassword ? "text" : "password") : (type ?? "text");

    const hasValue = value !== undefined ? String(value).length > 0 : false;

    return (
      <div className={cn("w-full", wrapperClassName)}>
        {label && (
          <label className={cn("text-sm font-semibold text-[#059669] ml-1 mb-1 block", labelClassName)}>
            {label}
          </label>
        )}

        <div
          className={cn("app-input-container", error && "app-input-error")}
          style={borderColor && !error ? ({ "--border-color": borderColor } as React.CSSProperties) : undefined}
        >
          {icon && (
            <button type="button" tabIndex={-1} className="app-input-icon-btn">
              <HugeiconsIcon icon={icon} size={20} color="currentColor" strokeWidth={1.5} />
            </button>
          )}

          <input
            ref={ref}
            type={resolvedType}
            value={value}
            onChange={onChange}
            className={cn("app-input", className)}
            onFocus={(e) => { setIsFocused(true); onFocus?.(e); }}
            onBlur={(e) => { setIsFocused(false); onBlur?.(e); }}
            {...props}
          />

          {isPassword && (
            <>
              {/* Show strength label when focused + has value + strengthLabel provided */}
              {isFocused && hasValue && strengthLabel ? (
                <span
                  className="app-input-toggle text-xs font-semibold whitespace-nowrap pointer-events-none select-none"
                  style={{ color: strengthColor ?? "#6b7280" }}
                >
                  {strengthLabel}
                </span>
              ) : (
                <button
                  type="button"
                  className="app-input-toggle"
                  onClick={() => setShowPassword((p) => !p)}
                  tabIndex={-1}
                >
                  <HugeiconsIcon
                    icon={showPassword ? ViewOffSlashIcon : ViewIcon}
                    size={20}
                    color="currentColor"
                    strokeWidth={1.5}
                  />
                </button>
              )}
            </>
          )}

          {clearable && !isPassword && (
            <button
              type="button"
              className={cn("app-input-reset", hasValue && "app-input-reset--visible")}
              onClick={onClear}
              tabIndex={-1}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {error && <p className="text-red-400 text-xs mt-0.5 ml-1 font-bold">{error}</p>}
      </div>
    );
  }
);

AppInput.displayName = "AppInput";

export { AppInput };
