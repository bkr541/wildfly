import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";
import { ViewIcon, ViewOffSlashIcon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

export interface AppInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** HugeIcons icon (IconSvgElement) to show on the left */
  icon?: IconSvgElement;
  /** Label shown above the input */
  label?: string;
  /** Error message shown below the input */
  error?: string;
  /** Show a clear (×) button when input has a value */
  clearable?: boolean;
  /** Callback when clear button is clicked */
  onClear?: () => void;
  /** If true, renders a password field with show/hide toggle */
  isPassword?: boolean;
  /** Override input type (default "text", auto-set for password) */
  type?: string;
  /** Extra class on the outer wrapper */
  wrapperClassName?: string;
  /** Extra class on the label */
  labelClassName?: string;
  /** Dynamic border color (e.g. password-strength hex) */
  borderColor?: string;
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
      className,
      value,
      onChange,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = React.useState(false);

    const resolvedType = isPassword ? (showPassword ? "text" : "password") : (type ?? "text");

    const hasValue = value !== undefined ? String(value).length > 0 : false;

    return (
      <div className={cn("w-full", wrapperClassName)}>
        {label && (
          <label className={cn("text-sm font-semibold text-[#10B981] ml-1 mb-1 block", labelClassName)}>
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
            {...props}
          />

          {isPassword && (
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
