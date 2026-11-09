/**
 * Numeric display guard.
 *
 * Returns the value only when it is a real, finite number; otherwise `null`.
 * Use this for any figure that is a *measurement* (a count, an amount of money,
 * a score, a duration) so that an absent or unread value renders as an explicit
 * unavailable state (`—`) instead of a fabricated `0`.
 *
 * Accepts a number or a numeric string. Booleans, `NaN`, `Infinity`, `null`,
 * `undefined`, `''`, arrays and objects all resolve to `null`.
 */
export function unknownNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

export default unknownNumber;
