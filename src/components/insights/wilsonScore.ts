/**
 * Wilson lower confidence bound score.
 *
 * Returns a score from 0 to 100 that adjusts a raw success rate by the
 * number of observations. Larger samples receive greater confidence;
 * smaller samples receive a conservative downward adjustment.
 *
 * Uses a 95% confidence level (z = 1.96) by default.
 * Used for airport ranking in Top Origin / Top Destination Airports.
 */
export function getWilsonLowerBoundScore(
  successes: number,
  total: number,
  z = 1.96,
): number {
  if (
    total <= 0 ||
    successes < 0 ||
    !Number.isFinite(successes) ||
    !Number.isFinite(total)
  ) {
    return 0;
  }

  const boundedSuccesses = Math.min(successes, total);
  const p = boundedSuccesses / total;
  const zSquared = z * z;

  const numerator =
    p +
    zSquared / (2 * total) -
    z *
      Math.sqrt(
        (p * (1 - p)) / total +
          zSquared / (4 * total * total),
      );

  const denominator = 1 + zSquared / total;
  const lowerBound = numerator / denominator;

  return Math.max(0, Math.min(100, lowerBound * 100));
}
