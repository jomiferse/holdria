import { z } from "zod";

/**
 * Zod input shapes for pricing's Server Actions.
 *
 * These validate structural/type shape only (presence, string format).
 * Financial validity — positive value, EUR currency, valid date — is
 * re-checked by the domain parsers in `record-price-observation` /
 * `edit-price-observation` regardless of what passes here, so the same
 * rule is never expressed in two conflicting places.
 */

const priceString = z
  .string()
  .trim()
  .min(1, "Price is required.");

const effectiveDateString = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Effective date must be in YYYY-MM-DD format.");

export const createPriceObservationSchema = z.object({
  instrumentId: z.uuid("Select an instrument."),
  price: priceString,
  effectiveDate: effectiveDateString,
});

export type CreatePriceObservationInput = z.infer<typeof createPriceObservationSchema>;

export const editPriceObservationSchema = z.object({
  id: z.uuid(),
  price: priceString,
  effectiveDate: effectiveDateString,
});

export type EditPriceObservationInput = z.infer<typeof editPriceObservationSchema>;

export const deletePriceObservationSchema = z.object({
  id: z.uuid(),
});

export type DeletePriceObservationInput = z.infer<typeof deletePriceObservationSchema>;
