import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  LockPasswordIcon,
  Alert01Icon,
  ArrowReloadHorizontalIcon,
} from "@hugeicons/core-free-icons";
import type {
  ReportDefinition,
  ReportParameterField,
  ReportParameterSchema,
} from "./reportingTypes";

// ── Pure logic helpers (exported for tests) ───────────────────────────────────

/**
 * Build the initial parameter values map for a report.
 * Priority: default_parameters value > field-level default (none defined) > empty string / false
 */
export function initializeFromDefaults(
  schema: ReportParameterSchema,
  defaultParameters: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const field of schema.fields) {
    if (Object.prototype.hasOwnProperty.call(defaultParameters, field.key)) {
      result[field.key] = defaultParameters[field.key];
    } else {
      // Safe zero-value per type
      switch (field.type) {
        case "boolean": result[field.key] = false;   break;
        case "number":  result[field.key] = field.minimum ?? ""; break;
        default:        result[field.key] = "";       break;
      }
    }
  }
  return result;
}

/**
 * Validate parameter values against the schema.
 * Returns a map of field key → error message. Empty map means valid.
 */
export function validateParameters(
  schema: ReportParameterSchema,
  values: Record<string, unknown>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of schema.fields) {
    if (!field.required) continue;
    const v = values[field.key];
    if (v === null || v === undefined || String(v).trim() === "") {
      errors[field.key] = `${field.label} is required`;
    }
  }
  return errors;
}

/**
 * Normalise an airport code: trim and uppercase.
 * Returns the raw string if not a plain string.
 */
export function normalizeAirportCode(raw: unknown): string {
  if (typeof raw !== "string") return String(raw ?? "");
  return raw.trim().toUpperCase();
}

// ── Field renderer ─────────────────────────────────────────────────────────────

interface FieldProps {
  field:    ReportParameterField;
  value:    unknown;
  error:    string | undefined;
  disabled: boolean;
  onChange: (key: string, value: unknown) => void;
}

function FieldInput({ field, value, error, disabled, onChange }: FieldProps) {
  const baseInput =
    "w-full px-3 py-2 text-sm rounded-xl border focus:outline-none focus:ring-1 transition-colors " +
    (error
      ? "border-red-300 focus:border-red-400 focus:ring-red-200/30 bg-red-50/30"
      : "border-[#E8EEEE] focus:border-[#059669] focus:ring-[#059669]/20 bg-white") +
    (disabled ? " opacity-50 cursor-not-allowed" : "");

  if (field.type === "boolean") {
    const checked = value === true || value === "true";
    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(field.key, !checked)}
        className="flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed group"
      >
        <div
          className={`relative h-6 w-11 rounded-full flex-shrink-0 transition-colors duration-200 ${
            checked ? "bg-[#059669]" : "bg-[#D1D5DB]"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
              checked ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </div>
        <span className="text-sm text-[#374151]">{checked ? "Yes" : "No"}</span>
      </button>
    );
  }

  if (field.type === "select" && field.options) {
    return (
      <select
        id={`param-${field.key}`}
        value={String(value ?? "")}
        disabled={disabled}
        onChange={(e) => onChange(field.key, e.target.value)}
        aria-invalid={!!error}
        className={baseInput + " appearance-none cursor-pointer"}
      >
        <option value="">— Select —</option>
        {field.options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "date") {
    return (
      <input
        id={`param-${field.key}`}
        type="date"
        value={String(value ?? "")}
        disabled={disabled}
        onChange={(e) => onChange(field.key, e.target.value)}
        aria-invalid={!!error}
        className={baseInput}
      />
    );
  }

  if (field.type === "number") {
    return (
      <input
        id={`param-${field.key}`}
        type="number"
        value={String(value ?? "")}
        disabled={disabled}
        min={field.minimum}
        max={field.maximum}
        onChange={(e) => onChange(field.key, e.target.value === "" ? "" : Number(e.target.value))}
        aria-invalid={!!error}
        className={baseInput}
      />
    );
  }

  if (field.type === "airport") {
    return (
      <input
        id={`param-${field.key}`}
        type="text"
        value={String(value ?? "")}
        disabled={disabled}
        placeholder="e.g. DEN"
        maxLength={4}
        onChange={(e) => onChange(field.key, normalizeAirportCode(e.target.value))}
        aria-invalid={!!error}
        className={baseInput + " font-mono uppercase tracking-wider"}
      />
    );
  }

  // default: text
  return (
    <input
      id={`param-${field.key}`}
      type="text"
      value={String(value ?? "")}
      disabled={disabled}
      onChange={(e) => onChange(field.key, e.target.value)}
      aria-invalid={!!error}
      className={baseInput}
    />
  );
}

function ParameterField({ field, value, error, disabled, onChange }: FieldProps) {
  const isBoolean = field.type === "boolean";
  return (
    <div className="flex flex-col gap-1">
      {/* Label row — for boolean, label is shown beside the toggle instead */}
      {!isBoolean && (
        <label
          htmlFor={`param-${field.key}`}
          className="text-xs font-semibold text-[#374151] flex items-center gap-1"
        >
          {field.label}
          {field.required && (
            <span className="text-red-500" aria-label="required">
              *
            </span>
          )}
        </label>
      )}

      {isBoolean && (
        <span className="text-xs font-semibold text-[#374151] mb-0.5">{field.label}</span>
      )}

      <FieldInput
        field={field}
        value={value}
        error={error}
        disabled={disabled}
        onChange={onChange}
      />

      {field.helperText && !error && (
        <p className="text-[11px] text-[#9CA3AF] leading-relaxed">{field.helperText}</p>
      )}

      {error && (
        <p className="text-[11px] text-red-500 flex items-center gap-1" role="alert">
          <HugeiconsIcon icon={Alert01Icon} size={11} color="currentColor" strokeWidth={2} />
          {error}
        </p>
      )}
    </div>
  );
}

// ── PII toggle ─────────────────────────────────────────────────────────────────

interface PiiToggleProps {
  enabled:  boolean;
  disabled: boolean;
  onChange: (enabled: boolean) => void;
}

function PiiToggle({ enabled, disabled, onChange }: PiiToggleProps) {
  return (
    <div
      className="rounded-xl p-3.5 border border-amber-200 bg-amber-50/60 flex flex-col gap-2"
      role="group"
      aria-label="PII access controls"
    >
      <div className="flex items-center gap-2">
        <HugeiconsIcon icon={LockPasswordIcon} size={14} color="#D97706" strokeWidth={2} />
        <span className="text-xs font-bold text-amber-800">PII Access</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={disabled}
        onClick={() => onChange(!enabled)}
        className="flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <div
          className={`relative h-5 w-9 rounded-full transition-colors duration-200 ${
            enabled ? "bg-amber-500" : "bg-[#D1D5DB]"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
              enabled ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </div>
        <span className="text-xs font-semibold text-amber-800">
          Include full PII fields
        </span>
      </button>
      {enabled && (
        <p className="text-[11px] text-amber-700 leading-relaxed flex items-start gap-1.5">
          <HugeiconsIcon
            icon={Alert01Icon}
            size={12}
            color="currentColor"
            strokeWidth={2}
            className="flex-shrink-0 mt-0.5"
          />
          Full PII access is audited. Do not export or share personally identifiable
          information outside of authorized workflows.
        </p>
      )}
    </div>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface ReportParameterPanelProps {
  definition:   ReportDefinition;
  values:       Record<string, unknown>;
  onChange:     (key: string, value: unknown) => void;
  errors:       Record<string, string>;
  disabled:     boolean;
  showPiiToggle: boolean;
  piiEnabled:   boolean;
  onPiiChange:  (enabled: boolean) => void;
  onReset:      () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ReportParameterPanel({
  definition,
  values,
  onChange,
  errors,
  disabled,
  showPiiToggle,
  piiEnabled,
  onPiiChange,
  onReset,
}: ReportParameterPanelProps) {
  const fields = definition.parameter_schema?.fields ?? [];
  const hasErrors = Object.keys(errors).length > 0;
  const hasNonDefault = fields.some((f) => {
    const current = values[f.key];
    const dflt    = definition.default_parameters?.[f.key];
    return current !== undefined && current !== dflt && String(current) !== "";
  });

  if (fields.length === 0) {
    return (
      <p className="text-sm text-[#9CA3AF] italic">
        This report has no configurable parameters.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Fields grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {fields.map((field) => (
          <ParameterField
            key={field.key}
            field={field}
            value={values[field.key] ?? ""}
            error={errors[field.key]}
            disabled={disabled}
            onChange={onChange}
          />
        ))}
      </div>

      {/* PII toggle */}
      {showPiiToggle && (
        <PiiToggle
          enabled={piiEnabled}
          disabled={disabled}
          onChange={onPiiChange}
        />
      )}

      {/* Reset link */}
      {hasNonDefault && !disabled && (
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={onReset}
            aria-label="Reset filters to default values"
            className="flex items-center gap-1.5 text-xs font-semibold text-[#9CA3AF] hover:text-[#374151] transition-colors"
          >
            <HugeiconsIcon icon={ArrowReloadHorizontalIcon} size={12} color="currentColor" strokeWidth={2.5} />
            Reset to defaults
          </button>
        </div>
      )}

      {/* Aggregate validation hint */}
      {hasErrors && (
        <p className="text-xs text-red-500 font-semibold" role="alert" aria-live="polite">
          Please fix the fields above before running this report.
        </p>
      )}
    </div>
  );
}
