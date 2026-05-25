import { z } from 'zod';

const email = z.string().trim().email().max(254).toLowerCase();

export const loginSchema = z.object({
  email,
  password: z.string().min(8).max(200),
});

export const registerSchema = z.object({
  email,
  password: z.string().min(8).max(200),
  name: z.string().trim().min(1).max(180),
  phone: z.string().trim().min(4).max(40).optional(),
  companyName: z.string().trim().min(1).max(180).optional(),
  workshopName: z.string().trim().min(1).max(180).optional(),
});

export const forgotPasswordSchema = z.object({
  email,
});

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(40).max(500),
  password: z.string().min(8).max(200),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(180),
  phone: z.string().trim().min(4).max(40).nullable().optional(),
  companyName: z.string().trim().min(1).max(180).nullable().optional(),
  workshopName: z.string().trim().min(1).max(180).nullable().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(8).max(200),
  newPassword: z.string().min(8).max(200),
});

export const refreshSessionSchema = z
  .object({
    refreshToken: z.string().trim().min(20).max(500).optional(),
  })
  .optional()
  .default({});

export const logoutSchema = z
  .object({
    refreshToken: z.string().trim().min(20).max(500).optional(),
  })
  .optional()
  .default({});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
