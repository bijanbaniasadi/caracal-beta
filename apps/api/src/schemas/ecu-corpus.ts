import { z } from 'zod';

function firstQueryValue(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

const optionalPath = z.string().trim().min(1).max(1000).optional();
const queryText = (max = 240) =>
  z.preprocess(firstQueryValue, z.string().trim().min(1).max(max)).optional();
const queryLimit = z
  .preprocess(firstQueryValue, z.coerce.number().int().min(1).max(250))
  .default(50);

export const ecuCorpusScanSchema = z.object({
  rootPath: optionalPath,
  maxAnalysisBytes: z.coerce
    .number()
    .int()
    .min(4096)
    .max(64 * 1024 * 1024)
    .optional(),
  maxFiles: z.coerce.number().int().min(1).max(1_000_000).optional(),
  maxPairCandidates: z.coerce.number().int().min(0).max(100_000).optional(),
});

export const ecuCorpusOptimizedScanSchema = ecuCorpusScanSchema.extend({
  runId: z.string().trim().min(1).max(120).optional(),
  batchSize: z.coerce.number().int().min(100).max(25_000).optional(),
  fingerprintBatchSize: z.coerce.number().int().min(1).max(2_000).optional(),
  resume: z.boolean().optional(),
});

export const ecuCorpusRunControlSchema = z.object({
  runId: z.string().trim().min(1).max(120),
  stage: z
    .enum([
      'discovery',
      'fingerprinting',
      'clustering',
      'relation-extraction',
      'signature-generation',
    ])
    .optional(),
});

export const ecuCorpusListQuerySchema = z.object({
  q: queryText(240),
  extension: queryText(40),
  family: queryText(120),
  oem: queryText(120),
  token: queryText(120),
  cursor: queryText(120),
  limit: queryLimit,
});

export const ecuCorpusCompareSchema = z.object({
  leftFileId: z.string().trim().min(1).max(120),
  rightFileId: z.string().trim().min(1).max(120),
});

export const ecuCorpusMatchUploadSchema = z.object({
  uploadId: z.string().trim().min(1).max(120),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type EcuCorpusScanInput = z.infer<typeof ecuCorpusScanSchema>;
export type EcuCorpusOptimizedScanInput = z.infer<typeof ecuCorpusOptimizedScanSchema>;
export type EcuCorpusRunControlInput = z.infer<typeof ecuCorpusRunControlSchema>;
export type EcuCorpusListQuery = z.infer<typeof ecuCorpusListQuerySchema>;
export type EcuCorpusCompareInput = z.infer<typeof ecuCorpusCompareSchema>;
export type EcuCorpusMatchUploadInput = z.infer<typeof ecuCorpusMatchUploadSchema>;
