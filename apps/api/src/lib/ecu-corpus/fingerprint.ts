import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { open } from 'node:fs/promises';
import path from 'node:path';

import { analyzeEcuBinary, type EcuBinaryIntelligence } from '../bin-analysis/ecu-intelligence.js';
import { calculateEntropy } from '../bin-analysis/metadata.js';

export const projectLabelExtensions = new Set([
  '.ols',
  '.kp',
  '.a2l',
  '.damos',
  '.dam',
  '.xdf',
  '.csv',
  '.txt',
  '.xml',
]);

export const binaryLikeExtensions = new Set([
  '.bin',
  '.ori',
  '.mod',
  '.original',
  '.stage1',
  '.stage2',
  '.frf',
  '.sgo',
  '.hex',
  '.mot',
  '.s19',
  '.elf',
  '.eep',
  '.epr',
  '.mpc',
  '.sgm',
]);

export const archiveExtensions = new Set(['.zip', '.rar', '.7z']);

export interface PrintableStringMatch {
  offset: number;
  value: string;
}

export interface CorpusFileFingerprint {
  sampleBuffer: Buffer;
  sampledBytes: number;
  sampledOnly: boolean;
  entropy: number;
  entropyProfile: Array<{
    offset: number;
    length: number;
    entropy: number;
  }>;
  filenameTokens: string[];
  strings: PrintableStringMatch[];
  byteSignatures: Array<{
    offset: number;
    hex: string;
  }>;
  intelligence: EcuBinaryIntelligence | null;
}

export function detectFileKind(extension: string): string {
  const normalized = extension.toLowerCase();

  if (binaryLikeExtensions.has(normalized)) return 'binary';
  if (projectLabelExtensions.has(normalized)) return 'project-label';
  if (archiveExtensions.has(normalized)) return 'archive';
  if (['.md', '.rtf', '.log', '.html', '.json'].includes(normalized)) return 'text';
  return 'unknown';
}

export function tokenizeFileName(fileName: string): string[] {
  return Array.from(
    new Set(
      fileName
        .replace(/\.[^.]+$/, '')
        .split(/[^a-zA-Z0-9]+/g)
        .map((token) => token.trim().toUpperCase())
        .filter((token) => token.length >= 2 && token.length <= 40)
    )
  ).slice(0, 80);
}

export async function sha256File(filePath: string): Promise<string> {
  const hash = createHash('sha256');

  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve());
  });

  return hash.digest('hex');
}

export async function readSample(filePath: string, maxBytes: number): Promise<Buffer> {
  const handle = await open(filePath, 'r');

  try {
    const stat = await handle.stat();
    const length = Math.min(Number(stat.size), maxBytes);
    const buffer = Buffer.alloc(length);
    const result = await handle.read(buffer, 0, length, 0);
    return buffer.subarray(0, result.bytesRead);
  } finally {
    await handle.close();
  }
}

export function extractPrintableStrings(buffer: Buffer, limit = 300): PrintableStringMatch[] {
  const matches: PrintableStringMatch[] = [];
  const seen = new Set<string>();
  let start = -1;

  const flush = (end: number) => {
    if (start < 0 || end - start < 4) {
      start = -1;
      return;
    }

    const value = buffer.toString('latin1', start, end).trim();
    const offset = start;
    start = -1;

    if (value.length < 4 || seen.has(value)) {
      return;
    }

    seen.add(value);
    matches.push({ offset, value });
  };

  for (let offset = 0; offset < buffer.length && matches.length < limit; offset += 1) {
    const byte = buffer[offset];
    const printable = byte >= 0x20 && byte <= 0x7e;

    if (printable && start < 0) {
      start = offset;
    }

    if (!printable) {
      flush(offset);
    }
  }

  flush(buffer.length);
  return matches;
}

function entropyProfile(buffer: Buffer): CorpusFileFingerprint['entropyProfile'] {
  const windowSize = buffer.length <= 4096 ? Math.max(256, buffer.length || 256) : 4096;
  const windows: CorpusFileFingerprint['entropyProfile'] = [];

  for (let offset = 0; offset < buffer.length; offset += windowSize) {
    const slice = buffer.subarray(offset, Math.min(offset + windowSize, buffer.length));
    windows.push({
      offset,
      length: slice.length,
      entropy: calculateEntropy(slice),
    });
  }

  return windows.slice(0, 256);
}

function byteSignatures(buffer: Buffer): CorpusFileFingerprint['byteSignatures'] {
  const offsets = [0, 0x100, 0x400, 0x1000, 0x4000, 0x8000, Math.max(buffer.length - 64, 0)];
  const signatures: CorpusFileFingerprint['byteSignatures'] = [];
  const seen = new Set<number>();

  for (const offset of offsets) {
    if (offset >= buffer.length || seen.has(offset)) {
      continue;
    }

    seen.add(offset);
    const slice = buffer.subarray(offset, Math.min(offset + 32, buffer.length));
    const hex = slice.toString('hex');

    if (/^(00)+$|^(ff)+$/i.test(hex)) {
      continue;
    }

    signatures.push({
      offset,
      hex,
    });
  }

  return signatures;
}

export async function fingerprintCorpusFile(input: {
  filePath: string;
  fileName: string;
  extension: string;
  productContext?: string;
  maxAnalysisBytes: number;
}): Promise<CorpusFileFingerprint> {
  const sampleBuffer = await readSample(input.filePath, input.maxAnalysisBytes);
  const strings = extractPrintableStrings(sampleBuffer);
  const kind = detectFileKind(input.extension);
  const intelligence =
    kind === 'binary'
      ? analyzeEcuBinary(sampleBuffer, {
          fileName: input.fileName,
          productContext: input.productContext,
          maxAsciiPatterns: 80,
          maxHexPatterns: 40,
        })
      : null;

  return {
    sampleBuffer,
    sampledBytes: sampleBuffer.length,
    sampledOnly: sampleBuffer.length >= input.maxAnalysisBytes,
    entropy: calculateEntropy(sampleBuffer),
    entropyProfile: entropyProfile(sampleBuffer),
    filenameTokens: tokenizeFileName(path.basename(input.fileName)),
    strings,
    byteSignatures: byteSignatures(sampleBuffer),
    intelligence,
  };
}
