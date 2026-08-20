import { z } from "zod";

/**
 * Zod input schemas for every identity Server Action. Kept separate from
 * `actions.ts` so forms can reuse the same validation shape for client-side
 * safe-input preservation without importing server-only code.
 */

const password = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(128, "Password must be at most 128 characters.");

export const signUpSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(100),
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
  password,
});

export const signInSchema = z.object({
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
  password: z.string().min(1, "Enter your password."),
});

export const requestPasswordResetSchema = z.object({
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password."),
  newPassword: password,
  revokeOtherSessions: z.boolean().default(false),
});

export const resendVerificationSchema = z.object({
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1, "Enter your password to confirm deletion."),
  confirmation: z.literal("DELETE", {
    error: "Type DELETE to confirm.",
  }),
});
