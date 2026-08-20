import { z } from "zod";

import { INSTRUMENT_TYPES } from "../domain/instrument";

/**
 * Shape-level validation for instrument Server Action input. ISIN
 * normalization, the fund-requires-ISIN rule, and EUR enforcement live in
 * `normalizeInstrumentInput` so they apply to every caller, not only
 * forms.
 */
const instrumentFields = {
  type: z.enum(INSTRUMENT_TYPES, { message: "Choose FUND, ETF, or STOCK." }),
  name: z.string().min(1, "Instrument name is required."),
  isin: z.string().optional(),
  ticker: z.string().optional(),
  market: z.string().optional(),
};

export const createInstrumentSchema = z.object(instrumentFields);

export const updateInstrumentSchema = z.object({
  id: z.string().min(1),
  ...instrumentFields,
});

export const deleteInstrumentSchema = z.object({
  id: z.string().min(1),
});
