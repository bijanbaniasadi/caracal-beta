import { z } from 'zod';

export const ecuPatcherModuleSchema = z.enum([
  'DCM71B_DPF',
  'DCM71B_EGR',
  'SID208_DPF_EGR',
  'DTC_REMOVER',
]);

export const createEcuPatcherJobSchema = z.object({
  module: ecuPatcherModuleSchema,
  fixChecksum: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((value) => {
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') {
        return !['false', '0', 'off', 'no'].includes(value.toLowerCase());
      }
      return undefined;
    }),
});

export const requestEcuPatcherAccessSchema = z.object({
  notes: z.string().trim().max(1000).optional(),
});

export const updateEcuPatcherAccessSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export type CreateEcuPatcherJobInput = z.infer<typeof createEcuPatcherJobSchema>;
export type RequestEcuPatcherAccessInput = z.infer<typeof requestEcuPatcherAccessSchema>;
export type UpdateEcuPatcherAccessInput = z.infer<typeof updateEcuPatcherAccessSchema>;
