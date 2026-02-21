import { useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

const requirements = [
  { regex: /.{8,}/, text: "At least 8 characters" },
  { regex: /[a-z]/, text: "At least 1 lowercase letter" },
  { regex: /[A-Z]/, text: "At least 1 uppercase letter" },
  { regex: /[0-9]/, text: "At least 1 number" },
  { regex: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/, text: "At least 1 special character" },
];

interface PasswordStrengthInputProps {
  value: string;
  onChange: (value: string) => void;
  showPassword: boolean;
  onToggleVisibility: () => void;
  error?: string;
  inputClassName: string;
}

export function getPasswordStrengthScore(password: string) {
  return requirements.filter((req) => req.regex.test(password)).length;
}

export function isPasswordStrong(password: string) {
  return getPasswordStrengthScore(password) === requirements.length;
}

const PasswordStrengthInput = ({
  value,
  onChange,
  showPassword,
  onToggleVisibility,
  error,
  inputClassName,
}: PasswordStrengthInputProps) => {
  const [isFocused, setIsFocused] = useState(false);
  const strength = requirements.map((req) => ({
    met: req.regex.test(value),
    text: req.text,
  }));

  const strengthScore = useMemo(() => {
    return strength.filter((req) => req.met).length;
  }, [strength]);

  const getColor = (score: number) => {
    if (score === 0) return "bg-border";
    if (score <= 1) return "bg-destructive";
    if (score <= 2) return "bg-orange-500";
    if (score <= 3) return "bg-amber-500";
    if (score === 4) return "bg-yellow-400";
    return "bg-green-500";
  };

  const getText = (score: number) => {
    if (score === 0) return "Enter a password";
    if (score <= 2) return "Weak password";
    if (score <= 3) return "Medium password";
    if (score === 4) return "Strong password";
    return "Very strong password";
  };

  return (
    <div>
      <div className="relative">
        <input
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="••••••••"
          className={inputClassName}
        />
        <button
          type="button"
          onClick={onToggleVisibility}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          tabIndex={-1}
        >
          {showPassword ? (
            <FontAwesomeIcon icon={faEyeSlash} className="w-[18px] h-[18px]" />
          ) : (
            <FontAwesomeIcon icon={faEye} className="w-[18px] h-[18px]" />
          )}
        </button>
      </div>
      {error && <p className="text-destructive text-xs mt-1">{error}</p>}

      {/* Strength elements - only show when focused and not yet strong */}
      {isFocused && value.length > 0 && !isPasswordStrong(value) && (
        <>
          <div
            className="mt-3 flex gap-1.5"
            role="progressbar"
            aria-valuenow={strengthScore}
            aria-valuemin={0}
            aria-valuemax={requirements.length}
          >
            {Array.from({ length: requirements.length }).map((_, index) => (
              <span
                key={index}
                className={cn(
                  "h-1.5 w-full rounded-full transition-colors",
                  index < strengthScore ? getColor(strengthScore) : "bg-border"
                )}
              />
            ))}
          </div>

          <p className="mt-2 text-sm font-medium text-foreground">
            {getText(strengthScore)}. Must contain:
          </p>
          <ul className="mt-1.5 space-y-1">
            {strength.map((req, index) => (
              <li key={index} className="flex items-center gap-2">
                {req.met ? (
                  <Check size={14} className="text-green-500 shrink-0" />
                ) : (
                  <X size={14} className="text-muted-foreground shrink-0" />
                )}
                <span
                  className={cn(
                    "text-xs",
                    req.met ? "text-green-500" : "text-muted-foreground"
                  )}
                >
                  {req.text}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

export default PasswordStrengthInput;
