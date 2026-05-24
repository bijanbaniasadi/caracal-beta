import { createHash } from 'node:crypto';

export interface FileHashMetadata {
  sha256: string;
  md5: string;
}

export interface McuCandidate {
  family: string;
  confidence: number;
  reasons: string[];
}

export interface ExtractedBinMetadata {
  byteSize: number;
  entropy: number;
  magicHex: string;
  trailingHex: string;
  asciiPreview: string[];
  likelyEndian: 'little' | 'big' | 'unknown';
  zeroByteRatio: number;
  ffByteRatio: number;
}

const mcuRules: Array<{
  family: string;
  patterns: RegExp[];
  baseConfidence: number;
}> = [
  {
    family: 'Infineon TriCore TC17xx',
    patterns: [/tricore/i, /\btc17\d/i, /\btc179/i, /\bedc17/i, /\bmed17/i],
    baseConfidence: 0.72,
  },
  {
    family: 'Infineon AURIX TC2xx/TC3xx',
    patterns: [/aurix/i, /\btc2\d\d/i, /\btc3\d\d/i, /\bmg1/i, /\bmd1/i],
    baseConfidence: 0.7,
  },
  {
    family: 'NXP/Motorola MPC5xxx',
    patterns: [/\bmpc5/i, /\bmpc56/i, /\bmpc57/i, /\bppc/i],
    baseConfidence: 0.66,
  },
  {
    family: 'Renesas SH/RH850',
    patterns: [/\brh850/i, /\bsh705/i, /\bsh72/i, /\brenesas/i],
    baseConfidence: 0.65,
  },
  {
    family: 'NEC V850/uPD',
    patterns: [/\bv850/i, /\b76f/i, /\bnec/i, /\bupd/i],
    baseConfidence: 0.6,
  },
  {
    family: 'ST SPC5',
    patterns: [/\bspc5/i, /\bstm/i, /\bst10/i],
    baseConfidence: 0.58,
  },
];

export function hashBinFile(buffer: Buffer): FileHashMetadata {
  return {
    sha256: createHash('sha256').update(buffer).digest('hex'),
    md5: createHash('md5').update(buffer).digest('hex'),
  };
}

function byteRatio(buffer: Buffer, value: number): number {
  if (buffer.length === 0) {
    return 0;
  }

  let count = 0;

  for (const byte of buffer) {
    if (byte === value) {
      count += 1;
    }
  }

  return Number((count / buffer.length).toFixed(4));
}

export function calculateEntropy(buffer: Buffer): number {
  if (buffer.length === 0) {
    return 0;
  }

  const counts = new Array<number>(256).fill(0);

  for (const byte of buffer) {
    counts[byte] += 1;
  }

  const entropy = counts.reduce((total, count) => {
    if (count === 0) {
      return total;
    }

    const probability = count / buffer.length;
    return total - probability * Math.log2(probability);
  }, 0);

  return Number(entropy.toFixed(4));
}

function extractAsciiPreview(buffer: Buffer): string[] {
  const text = buffer.toString('latin1');
  const matches = text.match(/[ -~]{5,}/g) ?? [];

  return Array.from(new Set(matches.map((value) => value.trim()).filter(Boolean))).slice(0, 25);
}

function inferEndian(buffer: Buffer): ExtractedBinMetadata['likelyEndian'] {
  const sampleLength = Math.min(buffer.length - (buffer.length % 4), 8192);

  if (sampleLength < 16) {
    return 'unknown';
  }

  let littleSignals = 0;
  let bigSignals = 0;

  for (let offset = 0; offset < sampleLength; offset += 4) {
    const little = buffer.readUInt32LE(offset);
    const big = buffer.readUInt32BE(offset);

    if (little > 0 && little < 0x02000000) littleSignals += 1;
    if (big > 0 && big < 0x02000000) bigSignals += 1;
  }

  if (littleSignals > bigSignals * 1.5) return 'little';
  if (bigSignals > littleSignals * 1.5) return 'big';
  return 'unknown';
}

export function extractBinMetadata(buffer: Buffer): ExtractedBinMetadata {
  return {
    byteSize: buffer.length,
    entropy: calculateEntropy(buffer),
    magicHex: buffer.subarray(0, 16).toString('hex'),
    trailingHex: buffer.subarray(Math.max(buffer.length - 16, 0)).toString('hex'),
    asciiPreview: extractAsciiPreview(buffer),
    likelyEndian: inferEndian(buffer),
    zeroByteRatio: byteRatio(buffer, 0x00),
    ffByteRatio: byteRatio(buffer, 0xff),
  };
}

export function detectMcuCandidates(
  buffer: Buffer,
  fileName?: string,
  productContext?: string | null
): McuCandidate[] {
  const metadata = extractBinMetadata(buffer);
  const haystack = [fileName ?? '', productContext ?? '', ...metadata.asciiPreview].join('\n');
  const candidates = mcuRules.flatMap((rule) => {
    const matched = rule.patterns.filter((pattern) => pattern.test(haystack));

    if (matched.length === 0) {
      return [];
    }

    const confidence = Math.min(rule.baseConfidence + (matched.length - 1) * 0.08, 0.92);

    return [
      {
        family: rule.family,
        confidence: Number(confidence.toFixed(2)),
        reasons: matched.map((pattern) => `Matched ${pattern.source}`),
      },
    ];
  });

  if (candidates.length === 0) {
    candidates.push({
      family: 'Unknown MCU family',
      confidence: 0.2,
      reasons: ['No known MCU strings matched; downstream AI analysis can enrich this later.'],
    });
  }

  return candidates.sort((left, right) => right.confidence - left.confidence).slice(0, 5);
}
