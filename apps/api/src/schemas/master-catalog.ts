import { z } from 'zod';

const optionalReason = z.string().trim().min(1).max(1000).optional();

export const masterProductPublishSchema = z
  .object({
    reason: optionalReason,
  })
  .default({});

export const masterProductArchiveSchema = z.object({
  reason: optionalReason,
});

export type MasterProductPublishInput = z.infer<typeof masterProductPublishSchema>;
export type MasterProductArchiveInput = z.infer<typeof masterProductArchiveSchema>;
