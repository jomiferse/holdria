import { ValidationError } from "@/shared/domain/errors";

/**
 * ISO 6166 ISIN handling: a 2-letter country prefix, 9 alphanumeric
 * characters, and a single Luhn (mod 10) check digit. This is the sole
 * place Holdria normalizes and validates an ISIN so every caller — the
 * instrument domain, the database check constraint's counterpart, and
 * future pricing lookups — agrees on one canonical form.
 */
const ISIN_FORMAT = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;

/** Strips whitespace and uppercases, without validating structure. */
export function normalizeIsin(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

export function hasValidIsinFormat(isin: string): boolean {
  return ISIN_FORMAT.test(isin);
}

/**
 * Validates the ISO 6166 check digit using the Luhn algorithm over the
 * digit expansion of the ISIN's letters (A=10 ... Z=35).
 */
export function hasValidIsinChecksum(isin: string): boolean {
  if (!hasValidIsinFormat(isin)) {
    return false;
  }

  const expanded = isin
    .split("")
    .map((char) => (char >= "A" && char <= "Z" ? String(char.charCodeAt(0) - 55) : char))
    .join("");

  let sum = 0;
  let double = false;

  for (let i = expanded.length - 1; i >= 0; i -= 1) {
    let digit = expanded.charCodeAt(i) - 48;

    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }

    sum += digit;
    double = !double;
  }

  return sum % 10 === 0;
}

/** Normalizes to canonical uppercase form and validates format + checksum, or throws `ValidationError`. */
export function normalizeAndValidateIsin(raw: string): string {
  const normalized = normalizeIsin(raw);

  if (!hasValidIsinChecksum(normalized)) {
    throw new ValidationError("Invalid ISIN.", {
      isin: ["Enter a valid 12-character ISIN."],
    });
  }

  return normalized;
}
