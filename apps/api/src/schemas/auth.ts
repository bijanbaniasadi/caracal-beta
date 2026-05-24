import { z } from 'zod';

const email = z.string().trim().email().max(254).toLowerCase();

export const loginSchema = z.object({
  email,
  password: z.string().min(8).max(200),
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
