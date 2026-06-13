// ─────────────────────────────────────────────────────────────────────────────
// flightShareNormalize.ts — versioned envelope deserialization
//
// Normalizes stored share payloads into the current FlightShareModel
// representation. Each model_version maps to a specific deserializer so
// the public reader can handle records written by older app versions.
//
// Rules:
// - Unknown versions throw so the caller can surface a clear error instead
//   of silently rendering a broken page.
// - Version 1 payloads are the raw FlightShareModel object as stored.
// - Future versions will apply field migrations inside their own branches.
// ─────────────────────────────────────────────────────────────────────────────

import type { FlightShareModel } from "./flightShareModel";

/**
 * The versioned storage envelope for model version 1.
 *
 * V1 stores the FlightShareModel directly as the JSON payload —
 * no additional wrapper is added so existing share_model values
 * are the model itself.
 */
export type FlightShareModelV1 = FlightShareModel;

export interface StoredFlightShareEnvelopeV1 {
  version: 1;
  model:   FlightShareModelV1;
}

/**
 * Normalize a stored `share_model` JSON blob plus its `model_version` integer
 * into the current runtime `FlightShareModel` representation.
 *
 * Throws a structured error string for unsupported or malformed versions
 * so callers can decide whether to show "not found" or "unsupported" UI.
 *
 * @param modelVersion  The integer from the `model_version` DB column.
 * @param payload       The raw JSON value from the `share_model` DB column.
 */
export function normalizeStoredFlightShare(
  modelVersion: number,
  payload: unknown,
): FlightShareModel {
  if (modelVersion === 1) {
    if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
      throw new Error("INVALID_PAYLOAD: version-1 share_model must be a non-null object");
    }
    // V1: the payload is the FlightShareModel directly.
    return payload as FlightShareModel;
  }

  throw new Error(
    `UNSUPPORTED_VERSION: model_version ${modelVersion} is not supported by this client`,
  );
}
