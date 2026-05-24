import {
  calculateEntropy,
  extractBinMetadata,
  hashBinFile,
  type McuCandidate,
} from './metadata.js';

export const ecuIntelligenceSchemaVersion = 'ecu-intelligence-v1' as const;

export type EcuArchitecture = 'tricore' | 'powerpc' | 'v850' | 'renesas-sh' | 'arm' | 'unknown';

export type FirmwareRegionType =
  | 'vectors'
  | 'bootloader'
  | 'code'
  | 'calibration'
  | 'diagnostics'
  | 'metadata'
  | 'blank'
  | 'unknown';

export type ConfidenceBand = 'low' | 'medium' | 'high';

export interface EcuAnalysisOptions {
  fileName?: string;
  productContext?: string | null;
  maxAsciiPatterns?: number;
  maxHexPatterns?: number;
}

export interface OffsetRegion {
  offset: number;
  endOffset: number;
  length: number;
}

export interface DetectionEvidence {
  id: string;
  category:
    | 'architecture'
    | 'checksum'
    | 'entropy'
    | 'mcu'
    | 'pattern'
    | 'platform'
    | 'region'
    | 'vector'
    | 'diagnostics';
  label: string;
  confidence: number;
  offsets?: number[];
  region?: OffsetRegion;
  details?: Record<string, unknown>;
}

export interface ConfidenceScore {
  name: string;
  score: number;
  band: ConfidenceBand;
  evidenceIds: string[];
}

export interface EntropyWindow extends OffsetRegion {
  entropy: number;
  zeroByteRatio: number;
  ffByteRatio: number;
  asciiRatio: number;
  scalarScore: number;
}

export interface FirmwareRegion extends OffsetRegion {
  type: FirmwareRegionType;
  entropy: number;
  confidence: number;
  evidenceIds: string[];
  notes: string[];
}

export interface PatternMatch extends OffsetRegion {
  kind: 'ascii' | 'hex';
  label: string;
  value: string;
  confidence: number;
  evidenceIds: string[];
}

export interface VectorTableDetection extends OffsetRegion {
  architecture: EcuArchitecture;
  endian: 'little' | 'big';
  entryCount: number;
  confidence: number;
  evidenceIds: string[];
}

export interface ArchitectureFingerprint {
  architecture: EcuArchitecture;
  family: string;
  endian: 'little' | 'big' | 'unknown';
  confidence: number;
  evidenceIds: string[];
}

export interface EcuMcuCandidate extends McuCandidate {
  architecture: EcuArchitecture;
  evidenceIds: string[];
}

export interface EcuPlatformDetection {
  supplier: 'Bosch' | 'Siemens/Continental' | 'Denso' | 'Delphi' | 'Hitachi' | 'Unknown';
  platform: string;
  family: string;
  probableOem?: string;
  confidence: number;
  evidenceIds: string[];
}

export interface ChecksumFamilyHeuristic {
  family: string;
  confidence: number;
  evidenceIds: string[];
  regions: OffsetRegion[];
  notes: string[];
}

export interface DtcTableHeuristic {
  probable: boolean;
  confidence: number;
  encoding: 'ascii' | 'uint16-be' | 'uint16-le' | 'mixed';
  regions: OffsetRegion[];
  sampleCodes: string[];
  evidenceIds: string[];
}

export interface EcuBinaryIntelligence {
  schemaVersion: typeof ecuIntelligenceSchemaVersion;
  readOnly: true;
  input: {
    byteSize: number;
    fileName?: string;
    productContext?: string | null;
  };
  file: {
    sha256: string;
    md5: string;
    entropy: number;
    entropyBand: 'blank-or-sparse' | 'structured' | 'compressed-or-encrypted';
    magicHex: string;
    trailingHex: string;
    likelyEndian: 'little' | 'big' | 'unknown';
    zeroByteRatio: number;
    ffByteRatio: number;
  };
  entropy: {
    global: number;
    windowSize: number;
    windows: EntropyWindow[];
    lowEntropyRegions: FirmwareRegion[];
    highEntropyRegions: FirmwareRegion[];
  };
  architecture: ArchitectureFingerprint[];
  mcu: {
    candidates: EcuMcuCandidate[];
  };
  platforms: EcuPlatformDetection[];
  checksumFamilies: ChecksumFamilyHeuristic[];
  vectors: VectorTableDetection[];
  regions: FirmwareRegion[];
  calibration: {
    probableRegions: FirmwareRegion[];
    confidence: number;
    evidenceIds: string[];
  };
  patterns: {
    ascii: PatternMatch[];
    hex: PatternMatch[];
  };
  diagnostics: {
    dtcTables: DtcTableHeuristic[];
  };
  confidenceScores: ConfidenceScore[];
  evidence: DetectionEvidence[];
  normalizedSummary: {
    primaryArchitecture: ArchitectureFingerprint | null;
    primaryMcu: EcuMcuCandidate | null;
    probableSupplier: string | null;
    probablePlatform: string | null;
    probableOem: string | null;
    calibrationConfidence: number;
    dtcConfidence: number;
  };
}

interface EvidenceInput extends Omit<DetectionEvidence, 'id' | 'confidence'> {
  confidence: number;
}

interface EvidenceCollector {
  evidence: DetectionEvidence[];
  add(input: EvidenceInput): string;
}

const asciiPatternConfidence = {
  supplier: 0.84,
  platform: 0.82,
  mcu: 0.78,
  oem: 0.72,
  dtc: 0.7,
  softwareId: 0.66,
  generic: 0.38,
} as const;

function clampConfidence(value: number): number {
  return Number(Math.max(0, Math.min(0.99, value)).toFixed(2));
}

function confidenceBand(score: number): ConfidenceBand {
  if (score >= 0.75) return 'high';
  if (score >= 0.45) return 'medium';
  return 'low';
}

function combineScores(scores: number[], base = 0): number {
  const combined = scores.reduce((total, score) => total + score * (1 - total), base);
  return clampConfidence(combined);
}

function createEvidenceCollector(): EvidenceCollector {
  let counter = 0;
  const evidence: DetectionEvidence[] = [];

  return {
    evidence,
    add(input) {
      counter += 1;
      const id = `ev-${counter.toString().padStart(4, '0')}`;
      evidence.push({
        ...input,
        id,
        confidence: clampConfidence(input.confidence),
      });
      return id;
    },
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

function asciiRatio(buffer: Buffer): number {
  if (buffer.length === 0) {
    return 0;
  }

  let printable = 0;

  for (const byte of buffer) {
    if (byte >= 0x20 && byte <= 0x7e) {
      printable += 1;
    }
  }

  return Number((printable / buffer.length).toFixed(4));
}

function chooseWindowSize(length: number): number {
  if (length <= 4096) return Math.max(256, length || 256);
  if (length <= 128 * 1024) return 4096;
  if (length <= 1024 * 1024) return 8192;
  return 16384;
}

function offsetRegion(offset: number, length: number): OffsetRegion {
  return {
    offset,
    length,
    endOffset: offset + length,
  };
}

function safeReadUInt32(buffer: Buffer, offset: number, endian: 'little' | 'big'): number | null {
  if (offset < 0 || offset + 4 > buffer.length) {
    return null;
  }

  return endian === 'little' ? buffer.readUInt32LE(offset) : buffer.readUInt32BE(offset);
}

function safeReadUInt16(buffer: Buffer, offset: number, endian: 'little' | 'big'): number | null {
  if (offset < 0 || offset + 2 > buffer.length) {
    return null;
  }

  return endian === 'little' ? buffer.readUInt16LE(offset) : buffer.readUInt16BE(offset);
}

function scalarTableScore(buffer: Buffer): number {
  const sampleLength = Math.min(buffer.length - (buffer.length % 2), 4096);

  if (sampleLength < 64) {
    return 0;
  }

  const words: number[] = [];

  for (let offset = 0; offset < sampleLength; offset += 2) {
    const value = buffer.readUInt16BE(offset);
    if (value !== 0x0000 && value !== 0xffff) {
      words.push(value);
    }
  }

  if (words.length < 16) {
    return 0;
  }

  const uniqueRatio = new Set(words).size / words.length;
  let smoothPairs = 0;

  for (let index = 1; index < words.length; index += 1) {
    if (Math.abs(words[index] - words[index - 1]) <= 0x80) {
      smoothPairs += 1;
    }
  }

  const smoothRatio = smoothPairs / Math.max(words.length - 1, 1);
  const density = words.length / (sampleLength / 2);
  const scalarScore = density * 0.35 + smoothRatio * 0.45 + (1 - uniqueRatio) * 0.2;

  return clampConfidence(scalarScore);
}

function createEntropyWindows(buffer: Buffer, windowSize: number): EntropyWindow[] {
  const windows: EntropyWindow[] = [];

  for (let offset = 0; offset < buffer.length; offset += windowSize) {
    const slice = buffer.subarray(offset, Math.min(offset + windowSize, buffer.length));
    windows.push({
      ...offsetRegion(offset, slice.length),
      entropy: calculateEntropy(slice),
      zeroByteRatio: byteRatio(slice, 0x00),
      ffByteRatio: byteRatio(slice, 0xff),
      asciiRatio: asciiRatio(slice),
      scalarScore: scalarTableScore(slice),
    });
  }

  return windows;
}

function classifyEntropyBand(entropy: number, zeroRatio: number, ffRatio: number) {
  if (entropy < 1.2 || zeroRatio + ffRatio > 0.75) {
    return 'blank-or-sparse' as const;
  }

  if (entropy >= 7.65) {
    return 'compressed-or-encrypted' as const;
  }

  return 'structured' as const;
}

function extractAsciiPatterns(
  buffer: Buffer,
  collector: EvidenceCollector,
  maxPatterns: number
): PatternMatch[] {
  const matches: PatternMatch[] = [];
  const seen = new Set<string>();
  let start = -1;

  const flush = (end: number) => {
    if (start < 0 || end - start < 4) {
      start = -1;
      return;
    }

    const value = buffer.toString('latin1', start, end).trim();
    start = -1;

    if (value.length < 4 || seen.has(value)) {
      return;
    }

    seen.add(value);
    const label = classifyAsciiPattern(value);
    const confidence = asciiPatternConfidence[label];
    const evidenceId = collector.add({
      category: label === 'dtc' ? 'diagnostics' : 'pattern',
      label: `ASCII ${label} pattern: ${value.slice(0, 80)}`,
      confidence,
      offsets: [end - value.length],
      region: offsetRegion(end - value.length, value.length),
      details: {
        kind: label,
        value,
      },
    });

    matches.push({
      ...offsetRegion(end - value.length, value.length),
      kind: 'ascii',
      label,
      value,
      confidence,
      evidenceIds: [evidenceId],
    });
  };

  for (let offset = 0; offset < buffer.length; offset += 1) {
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

  return matches
    .sort((left, right) => right.confidence - left.confidence || left.offset - right.offset)
    .slice(0, maxPatterns);
}

function classifyAsciiPattern(value: string): keyof typeof asciiPatternConfidence {
  if (/\b(?:P|C|B|U)[0-3][0-9A-F]{3}\b/i.test(value)) return 'dtc';
  if (/\b(?:BOSCH|SIEMENS|CONTINENTAL|DENSO|DELPHI|HITACHI|VDO)\b/i.test(value)) {
    return 'supplier';
  }
  if (
    /\b(?:EDC17|MED17|MG1|MD1|SID\d{2,4}|SH705\d|TC1\d{2,3}|TC2\d{2}|TC3\d{2}|MPC5\d|V850|RH850|76F)\b/i.test(
      value
    )
  ) {
    return 'platform';
  }
  if (/\b(?:TRICORE|AURIX|POWERPC|PPC|RENESAS|INFINEON|MPC56|MPC57|UPD|NEC)\b/i.test(value)) {
    return 'mcu';
  }
  if (
    /\b(?:VW|AUDI|SEAT|SKODA|VAG|BMW|MERCEDES|FORD|GM|OPEL|TOYOTA|LEXUS|NISSAN|HONDA|RENAULT|PEUGEOT|CITROEN|HYUNDAI|KIA|VOLVO|SUBARU|MITSUBISHI)\b/i.test(
      value
    )
  ) {
    return 'oem';
  }
  if (/\b(?:SW|HW|CVN|CAL|CBOOT|ASW|DSG|10SW|1037|0281|0261)[-_ A-Z0-9.]{3,}\b/i.test(value)) {
    return 'softwareId';
  }
  return 'generic';
}

function extractHexPatterns(
  buffer: Buffer,
  collector: EvidenceCollector,
  maxPatterns: number
): PatternMatch[] {
  const patterns: PatternMatch[] = [];
  const addPattern = (label: string, offset: number, length: number, confidence: number) => {
    const slice = buffer.subarray(offset, Math.min(offset + length, buffer.length));
    const value = slice.subarray(0, 48).toString('hex').toUpperCase();
    const evidenceId = collector.add({
      category: 'pattern',
      label,
      confidence,
      offsets: [offset],
      region: offsetRegion(offset, length),
      details: {
        previewHex: value,
      },
    });
    patterns.push({
      ...offsetRegion(offset, length),
      kind: 'hex',
      label,
      value,
      confidence,
      evidenceIds: [evidenceId],
    });
  };

  for (const byte of [0x00, 0xff]) {
    let runStart = -1;

    for (let offset = 0; offset <= buffer.length; offset += 1) {
      const inRun = offset < buffer.length && buffer[offset] === byte;

      if (inRun && runStart < 0) {
        runStart = offset;
      }

      if ((!inRun || offset === buffer.length) && runStart >= 0) {
        const length = offset - runStart;
        if (length >= 64) {
          addPattern(
            byte === 0xff ? 'ff-fill-run' : 'zero-fill-run',
            runStart,
            length,
            Math.min(0.35 + length / Math.max(buffer.length, 1), 0.74)
          );
        }
        runStart = -1;
      }
    }
  }

  for (const stride of [2, 4]) {
    for (
      let offset = 0;
      offset + stride * 8 <= buffer.length && patterns.length < maxPatterns * 2;
    ) {
      const word = buffer.subarray(offset, offset + stride);
      const wordHex = word.toString('hex');

      if (/^(00)+$|^(ff)+$/i.test(wordHex)) {
        offset += stride;
        continue;
      }

      let count = 1;

      while (
        offset + (count + 1) * stride <= buffer.length &&
        buffer.subarray(offset + count * stride, offset + (count + 1) * stride).equals(word)
      ) {
        count += 1;
      }

      if (count >= (stride === 2 ? 8 : 5)) {
        addPattern(
          `repeated-${stride * 8}-bit-word-${wordHex.toUpperCase()}`,
          offset,
          count * stride,
          Math.min(0.42 + count / 80, 0.72)
        );
        offset += count * stride;
      } else {
        offset += stride;
      }
    }
  }

  return patterns
    .sort((left, right) => right.confidence - left.confidence || left.offset - right.offset)
    .slice(0, maxPatterns);
}

function haystackFrom(options: EcuAnalysisOptions, asciiPatterns: PatternMatch[]): string {
  return [
    options.fileName ?? '',
    options.productContext ?? '',
    ...asciiPatterns.map((pattern) => pattern.value),
  ].join('\n');
}

function matchingAsciiOffsets(pattern: RegExp, asciiPatterns: PatternMatch[]): number[] {
  return asciiPatterns
    .filter((match) => pattern.test(match.value))
    .map((match) => match.offset)
    .slice(0, 12);
}

function detectVectorTables(buffer: Buffer, collector: EvidenceCollector): VectorTableDetection[] {
  const detections: VectorTableDetection[] = [];
  const candidateOffsets = [0, 0x80, 0x100, 0x200, 0x400, 0x1000, 0x4000, 0x8000, 0x10000].filter(
    (offset) => offset < buffer.length
  );

  const addAddressTable = (
    architecture: EcuArchitecture,
    endian: 'little' | 'big',
    offset: number,
    predicate: (value: number) => boolean,
    label: string
  ) => {
    const scanLength = Math.min(512, buffer.length - offset);
    let entryCount = 0;
    const offsets: number[] = [];

    for (let cursor = offset; cursor + 4 <= offset + scanLength; cursor += 4) {
      const value = safeReadUInt32(buffer, cursor, endian);
      if (value !== null && predicate(value)) {
        entryCount += 1;
        offsets.push(cursor);
      }
    }

    if (entryCount >= 4) {
      const confidence = Math.min(0.46 + entryCount * 0.035, 0.9);
      const evidenceId = collector.add({
        category: 'vector',
        label,
        confidence,
        offsets: offsets.slice(0, 12),
        region: offsetRegion(offset, scanLength),
        details: {
          architecture,
          endian,
          entryCount,
        },
      });
      detections.push({
        ...offsetRegion(offset, scanLength),
        architecture,
        endian,
        entryCount,
        confidence: clampConfidence(confidence),
        evidenceIds: [evidenceId],
      });
    }
  };

  for (const offset of candidateOffsets) {
    addAddressTable(
      'tricore',
      'big',
      offset,
      (value) => value >= 0x80000000 && value <= 0xafffffff,
      'TriCore high-address vector table candidate'
    );
    addAddressTable(
      'tricore',
      'little',
      offset,
      (value) => value >= 0x80000000 && value <= 0xafffffff,
      'TriCore little-endian high-address vector table candidate'
    );
    addAddressTable(
      'renesas-sh',
      'big',
      offset,
      (value) => (value >= 0x00001000 && value <= 0x003fffff) || value >= 0xffc00000,
      'Renesas SH vector table candidate'
    );
    addAddressTable(
      'v850',
      'little',
      offset,
      (value) => value >= 0x00001000 && value <= 0x01ffffff,
      'V850/RH850 vector table candidate'
    );
  }

  for (const offset of candidateOffsets) {
    const scanLength = Math.min(0x1000, buffer.length - offset);
    let branchCount = 0;
    const offsets: number[] = [];

    for (let cursor = offset; cursor + 4 <= offset + scanLength; cursor += 4) {
      const opcode = buffer[cursor];
      if (opcode === 0x48 || opcode === 0x4b) {
        branchCount += 1;
        offsets.push(cursor);
      }
    }

    if (branchCount >= 6) {
      const confidence = Math.min(0.46 + branchCount * 0.025, 0.86);
      const evidenceId = collector.add({
        category: 'vector',
        label: 'PowerPC branch vector table candidate',
        confidence,
        offsets: offsets.slice(0, 12),
        region: offsetRegion(offset, scanLength),
        details: {
          architecture: 'powerpc',
          branchCount,
        },
      });
      detections.push({
        ...offsetRegion(offset, scanLength),
        architecture: 'powerpc',
        endian: 'big',
        entryCount: branchCount,
        confidence: clampConfidence(confidence),
        evidenceIds: [evidenceId],
      });
    }
  }

  return detections
    .sort((left, right) => right.confidence - left.confidence || left.offset - right.offset)
    .slice(0, 8);
}

function detectArchitectureFingerprints(
  haystack: string,
  asciiPatterns: PatternMatch[],
  vectorTables: VectorTableDetection[],
  collector: EvidenceCollector
): ArchitectureFingerprint[] {
  const architectureRules: Array<{
    architecture: EcuArchitecture;
    family: string;
    endian: 'little' | 'big' | 'unknown';
    patterns: RegExp[];
    confidence: number;
  }> = [
    {
      architecture: 'tricore',
      family: /\b(?:MG1|MD1|AURIX|TC2\d{2}|TC3\d{2})\b/i.test(haystack)
        ? 'Infineon AURIX TC2xx/TC3xx'
        : 'Infineon TriCore TC17xx',
      endian: 'big',
      patterns: [
        /\bTRICORE\b/i,
        /\bAURIX\b/i,
        /\bTC17\d{1,2}\b/i,
        /\bTC2\d{2}\b/i,
        /\bTC3\d{2}\b/i,
        /\b(?:EDC17|MED17|MG1|MD1)\b/i,
      ],
      confidence: 0.72,
    },
    {
      architecture: 'powerpc',
      family: /\bMPC57/i.test(haystack) ? 'NXP MPC57xx e200' : 'NXP/Motorola MPC5xxx e200',
      endian: 'big',
      patterns: [/\bPOWERPC\b/i, /\bPPC\b/i, /\bMPC5\d/i, /\bMPC56\d/i, /\bMPC57\d/i, /\be200\b/i],
      confidence: 0.68,
    },
    {
      architecture: 'renesas-sh',
      family: /\bSH7058\b/i.test(haystack) ? 'Hitachi/Renesas SH7058' : 'Hitachi/Renesas SH705x',
      endian: 'big',
      patterns: [/\bSH705\d\b/i, /\bSH72\d/i, /\bHITACHI\b/i, /\bRENESAS\b/i],
      confidence: 0.66,
    },
    {
      architecture: 'v850',
      family: /\bRH850\b/i.test(haystack) ? 'Renesas RH850' : 'NEC/Renesas V850/uPD',
      endian: 'little',
      patterns: [/\bV850\b/i, /\bRH850\b/i, /\b76F\d+/i, /\buPD\b/i, /\bNEC\b/i],
      confidence: 0.64,
    },
    {
      architecture: 'arm',
      family: 'ARM Cortex/R-series candidate',
      endian: 'little',
      patterns: [/\bCORTEX\b/i, /\bARM\b/i, /\bSTM32\b/i],
      confidence: 0.52,
    },
  ];

  const fingerprints = architectureRules.flatMap((rule) => {
    const evidenceIds: string[] = [];
    const matchedPatterns = rule.patterns.filter((pattern) => pattern.test(haystack));

    for (const pattern of matchedPatterns) {
      evidenceIds.push(
        collector.add({
          category: 'architecture',
          label: `${rule.family} string fingerprint matched /${pattern.source}/`,
          confidence: rule.confidence,
          offsets: matchingAsciiOffsets(pattern, asciiPatterns),
          details: {
            architecture: rule.architecture,
            family: rule.family,
          },
        })
      );
    }

    const matchingVectors = vectorTables.filter(
      (vector) => vector.architecture === rule.architecture
    );
    for (const vector of matchingVectors) {
      evidenceIds.push(...vector.evidenceIds);
    }

    if (evidenceIds.length === 0) {
      return [];
    }

    const vectorBoost = matchingVectors.length > 0 ? 0.18 : 0;
    const confidence = combineScores(
      [
        ...matchedPatterns.map(() => rule.confidence),
        ...matchingVectors.map((vector) => vector.confidence),
      ],
      vectorBoost
    );

    return [
      {
        architecture: rule.architecture,
        family: rule.family,
        endian: rule.endian,
        confidence,
        evidenceIds: Array.from(new Set(evidenceIds)),
      },
    ];
  });

  if (fingerprints.length === 0) {
    return [
      {
        architecture: 'unknown',
        family: 'Unknown ECU architecture',
        endian: 'unknown',
        confidence: 0.18,
        evidenceIds: [
          collector.add({
            category: 'architecture',
            label: 'No architecture-specific strings or vector patterns matched',
            confidence: 0.18,
          }),
        ],
      },
    ];
  }

  return fingerprints.sort((left, right) => right.confidence - left.confidence).slice(0, 5);
}

function probableOemFromHaystack(haystack: string): string | undefined {
  const rules: Array<[RegExp, string]> = [
    [/\b(?:VAG|VW|AUDI|SEAT|SKODA|VOLKSWAGEN)\b/i, 'Volkswagen Group'],
    [/\bBMW\b/i, 'BMW Group'],
    [/\b(?:MERCEDES|DAIMLER|BENZ)\b/i, 'Mercedes-Benz'],
    [/\b(?:FORD|FoMoCo)\b/i, 'Ford'],
    [/\b(?:GM|OPEL|VAUXHALL|ACDELCO)\b/i, 'General Motors'],
    [/\b(?:TOYOTA|LEXUS)\b/i, 'Toyota/Lexus'],
    [/\bNISSAN\b/i, 'Nissan'],
    [/\bHONDA\b/i, 'Honda'],
    [/\b(?:PEUGEOT|CITROEN|PSA|STELLANTIS)\b/i, 'PSA/Stellantis'],
    [/\bRENAULT\b/i, 'Renault'],
    [/\b(?:HYUNDAI|KIA)\b/i, 'Hyundai/Kia'],
    [/\bVOLVO\b/i, 'Volvo'],
    [/\bSUBARU\b/i, 'Subaru'],
    [/\bMITSUBISHI\b/i, 'Mitsubishi'],
  ];

  return rules.find(([pattern]) => pattern.test(haystack))?.[1];
}

function detectPlatforms(
  haystack: string,
  asciiPatterns: PatternMatch[],
  architectures: ArchitectureFingerprint[],
  collector: EvidenceCollector
): EcuPlatformDetection[] {
  const rules: Array<{
    supplier: EcuPlatformDetection['supplier'];
    platform: string;
    family: string;
    patterns: RegExp[];
    confidence: number;
    architecture?: EcuArchitecture;
  }> = [
    {
      supplier: 'Bosch',
      platform: 'MED17',
      family: 'Bosch MED17 gasoline ECU',
      patterns: [/\bMED17\b/i, /\bBOSCH\b/i, /\bTC17\d/i, /\b0261\d+/i, /\bCVN\b/i],
      confidence: 0.78,
      architecture: 'tricore',
    },
    {
      supplier: 'Bosch',
      platform: 'EDC17',
      family: 'Bosch EDC17 diesel ECU',
      patterns: [/\bEDC17\b/i, /\bBOSCH\b/i, /\bTC17\d/i, /\b0281\d+/i, /\bCVN\b/i],
      confidence: 0.78,
      architecture: 'tricore',
    },
    {
      supplier: 'Bosch',
      platform: 'MG1/MD1',
      family: 'Bosch MG1/MD1 AURIX ECU',
      patterns: [
        /\b(?:MG1|MD1)\w*\b/i,
        /\bBOSCH\b/i,
        /\bAURIX\b/i,
        /\bTC2\d{2}\b/i,
        /\bTC3\d{2}\b/i,
      ],
      confidence: 0.8,
      architecture: 'tricore',
    },
    {
      supplier: 'Siemens/Continental',
      platform: 'SID',
      family: 'Siemens/Continental SID ECU',
      patterns: [/\bSID\d{2,4}\b/i, /\bSIEMENS\b/i, /\bCONTINENTAL\b/i, /\bVDO\b/i],
      confidence: 0.76,
    },
    {
      supplier: 'Denso',
      platform: 'Denso',
      family: 'Denso ECU',
      patterns: [/\bDENSO\b/i, /\b76F\d+\b/i, /\bV850\b/i, /\bRH850\b/i, /\bTOYOTA\b/i],
      confidence: 0.74,
    },
    {
      supplier: 'Delphi',
      platform: 'Delphi',
      family: 'Delphi/ACDelco ECU',
      patterns: [/\bDELPHI\b/i, /\bACDELCO\b/i, /\bDCM\d/i, /\bMT\d{2,3}\b/i, /\bMULTEC\b/i],
      confidence: 0.72,
    },
    {
      supplier: 'Hitachi',
      platform: 'SH705x',
      family: 'Hitachi SH705x ECU',
      patterns: [/\bHITACHI\b/i, /\bSH705\d\b/i, /\bSH7058\b/i, /\bRENESAS\b/i],
      confidence: 0.7,
      architecture: 'renesas-sh',
    },
  ];

  const probableOem = probableOemFromHaystack(haystack);
  const detections = rules.flatMap((rule) => {
    const matchedPatterns = rule.patterns.filter((pattern) => pattern.test(haystack));
    const architectureMatches = rule.architecture
      ? architectures.some(
          (architecture) =>
            architecture.architecture === rule.architecture && architecture.confidence >= 0.45
        )
      : false;

    if (matchedPatterns.length === 0 && !architectureMatches) {
      return [];
    }

    const evidenceIds = matchedPatterns.map((pattern) =>
      collector.add({
        category: 'platform',
        label: `${rule.family} fingerprint matched /${pattern.source}/`,
        confidence: rule.confidence,
        offsets: matchingAsciiOffsets(pattern, asciiPatterns),
        details: {
          supplier: rule.supplier,
          platform: rule.platform,
        },
      })
    );

    if (architectureMatches) {
      evidenceIds.push(
        collector.add({
          category: 'platform',
          label: `${rule.family} architecture support from ${rule.architecture}`,
          confidence: 0.5,
          details: {
            architecture: rule.architecture,
          },
        })
      );
    }

    return [
      {
        supplier: rule.supplier,
        platform: rule.platform,
        family: rule.family,
        probableOem,
        confidence: combineScores([
          ...matchedPatterns.map(() => rule.confidence),
          architectureMatches ? 0.5 : 0,
        ]),
        evidenceIds,
      },
    ];
  });

  return detections.sort((left, right) => right.confidence - left.confidence).slice(0, 6);
}

function detectMcuSignatures(
  haystack: string,
  asciiPatterns: PatternMatch[],
  architectures: ArchitectureFingerprint[],
  platforms: EcuPlatformDetection[],
  collector: EvidenceCollector
): EcuMcuCandidate[] {
  const rules: Array<{
    family: string;
    architecture: EcuArchitecture;
    patterns: RegExp[];
    confidence: number;
  }> = [
    {
      family: 'Infineon TriCore TC17xx',
      architecture: 'tricore',
      patterns: [/\bTC17\d{1,2}\b/i, /\bTC176\d\b/i, /\bTC179\d\b/i, /\bEDC17\b/i, /\bMED17\b/i],
      confidence: 0.75,
    },
    {
      family: 'Infineon AURIX TC2xx/TC3xx',
      architecture: 'tricore',
      patterns: [/\bAURIX\b/i, /\bTC2\d{2}\b/i, /\bTC3\d{2}\b/i, /\bMG1\w*\b/i, /\bMD1\w*\b/i],
      confidence: 0.76,
    },
    {
      family: 'NXP/Motorola PowerPC MPC5xxx',
      architecture: 'powerpc',
      patterns: [/\bMPC5\d/i, /\bMPC56\d\b/i, /\bMPC57\d\b/i, /\bPOWERPC\b/i, /\bPPC\b/i],
      confidence: 0.7,
    },
    {
      family: 'Hitachi/Renesas SH705x',
      architecture: 'renesas-sh',
      patterns: [/\bSH705\d\b/i, /\bSH7058\b/i, /\bHITACHI\b/i],
      confidence: 0.7,
    },
    {
      family: 'NEC/Renesas V850/uPD',
      architecture: 'v850',
      patterns: [/\bV850\b/i, /\bRH850\b/i, /\b76F\d+\b/i, /\bUPD\b/i, /\bNEC\b/i],
      confidence: 0.66,
    },
  ];

  const candidates = rules.flatMap((rule) => {
    const matchedPatterns = rule.patterns.filter((pattern) => pattern.test(haystack));
    const architecture = architectures.find((item) => item.architecture === rule.architecture);
    const platform = platforms.find((item) =>
      rule.patterns.some((pattern) => pattern.test(`${item.platform}\n${item.family}`))
    );

    if (matchedPatterns.length === 0 && !architecture && !platform) {
      return [];
    }

    const evidenceIds = matchedPatterns.map((pattern) =>
      collector.add({
        category: 'mcu',
        label: `${rule.family} MCU signature matched /${pattern.source}/`,
        confidence: rule.confidence,
        offsets: matchingAsciiOffsets(pattern, asciiPatterns),
        details: {
          architecture: rule.architecture,
        },
      })
    );

    if (architecture && architecture.confidence >= 0.45) {
      evidenceIds.push(...architecture.evidenceIds);
    }

    if (platform && platform.confidence >= 0.45) {
      evidenceIds.push(...platform.evidenceIds);
    }

    return [
      {
        family: rule.family,
        architecture: rule.architecture,
        confidence: combineScores([
          ...matchedPatterns.map(() => rule.confidence),
          architecture?.confidence ?? 0,
          platform?.confidence ?? 0,
        ]),
        reasons: Array.from(
          new Set([
            ...matchedPatterns.map((pattern) => `Matched /${pattern.source}/`),
            ...(architecture ? [`Architecture fingerprint: ${architecture.family}`] : []),
            ...(platform ? [`Platform fingerprint: ${platform.family}`] : []),
          ])
        ),
        evidenceIds: Array.from(new Set(evidenceIds)),
      },
    ];
  });

  if (candidates.length === 0) {
    return [
      {
        family: 'Unknown MCU family',
        architecture: 'unknown',
        confidence: 0.18,
        reasons: ['No MCU strings, architecture vectors, or supplier signatures matched.'],
        evidenceIds: [
          collector.add({
            category: 'mcu',
            label: 'No known MCU signature matched',
            confidence: 0.18,
          }),
        ],
      },
    ];
  }

  return candidates.sort((left, right) => right.confidence - left.confidence).slice(0, 5);
}

function likelyChecksumRegions(buffer: Buffer): OffsetRegion[] {
  if (buffer.length === 0) {
    return [];
  }

  const regions: OffsetRegion[] = [];
  const tailLength = Math.min(4096, buffer.length);
  const tail = buffer.subarray(buffer.length - tailLength);

  if (calculateEntropy(tail) > 1 && byteRatio(tail, 0xff) + byteRatio(tail, 0x00) < 0.85) {
    regions.push(offsetRegion(buffer.length - tailLength, tailLength));
  }

  for (let offset = 0; offset + 16 <= buffer.length; offset += 0x1000) {
    const slice = buffer.subarray(offset, offset + 16);
    if (byteRatio(slice, 0xff) + byteRatio(slice, 0x00) < 0.5) {
      regions.push(offsetRegion(offset, 16));
    }
  }

  return regions.slice(0, 8);
}

function detectChecksumFamilies(
  haystack: string,
  asciiPatterns: PatternMatch[],
  platforms: EcuPlatformDetection[],
  buffer: Buffer,
  collector: EvidenceCollector
): ChecksumFamilyHeuristic[] {
  const probableRegions = likelyChecksumRegions(buffer);
  const rules: Array<{
    family: string;
    supplier: string;
    patterns: RegExp[];
    confidence: number;
    notes: string[];
  }> = [
    {
      family: 'Bosch EDC/MED/MG checksum and CVN family',
      supplier: 'Bosch',
      patterns: [
        /\bCVN\b/i,
        /\bCSM\b/i,
        /\bCRC(?:16|32)?\b/i,
        /\bBOSCH\b/i,
        /\b(?:EDC17|MED17|MG1|MD1)\b/i,
      ],
      confidence: 0.7,
      notes: [
        'Read-only checksum-family identification only; no checksum correction is performed.',
      ],
    },
    {
      family: 'Siemens/Continental SID checksum family',
      supplier: 'Siemens/Continental',
      patterns: [/\bSID\d{2,4}\b/i, /\bSIEMENS\b/i, /\bCONTINENTAL\b/i, /\bCRC(?:16|32)?\b/i],
      confidence: 0.66,
      notes: [
        'SID family checksum heuristic; map editing and correction are intentionally out of scope.',
      ],
    },
    {
      family: 'Denso checksum family',
      supplier: 'Denso',
      patterns: [/\bDENSO\b/i, /\bCHECKSUM\b/i, /\bCRC(?:16|32)?\b/i, /\bV850\b/i, /\b76F\d+/i],
      confidence: 0.62,
      notes: ['Denso checksum heuristic based on supplier and MCU evidence.'],
    },
    {
      family: 'Delphi checksum family',
      supplier: 'Delphi',
      patterns: [/\bDELPHI\b/i, /\bACDELCO\b/i, /\bCRC(?:16|32)?\b/i, /\bDCM\d/i, /\bMT\d{2,3}\b/i],
      confidence: 0.6,
      notes: ['Delphi checksum heuristic based on supplier and platform evidence.'],
    },
  ];

  const detections = rules.flatMap((rule) => {
    const matchedPatterns = rule.patterns.filter((pattern) => pattern.test(haystack));
    const platformMatch = platforms.some((platform) => platform.supplier === rule.supplier);

    if (matchedPatterns.length === 0 && !platformMatch) {
      return [];
    }

    const evidenceIds = matchedPatterns.map((pattern) =>
      collector.add({
        category: 'checksum',
        label: `${rule.family} indicator matched /${pattern.source}/`,
        confidence: rule.confidence,
        offsets: matchingAsciiOffsets(pattern, asciiPatterns),
        details: {
          family: rule.family,
        },
      })
    );

    if (probableRegions.length > 0) {
      evidenceIds.push(
        collector.add({
          category: 'checksum',
          label: `${rule.family} candidate checksum/footer regions found`,
          confidence: 0.38,
          region: probableRegions[0],
          details: {
            regionCount: probableRegions.length,
          },
        })
      );
    }

    return [
      {
        family: rule.family,
        confidence: combineScores([
          ...matchedPatterns.map(() => rule.confidence),
          platformMatch ? 0.5 : 0,
          probableRegions.length > 0 ? 0.28 : 0,
        ]),
        evidenceIds,
        regions: probableRegions,
        notes: rule.notes,
      },
    ];
  });

  return detections.sort((left, right) => right.confidence - left.confidence).slice(0, 4);
}

function detectNumericDtcRegions(
  buffer: Buffer,
  endian: 'little' | 'big'
): Array<OffsetRegion & { codes: string[] }> {
  const regions: Array<OffsetRegion & { codes: string[] }> = [];
  let runStart = -1;
  let runCodes: string[] = [];

  const flush = (offset: number) => {
    if (runStart >= 0 && runCodes.length >= 10) {
      regions.push({
        ...offsetRegion(runStart, offset - runStart),
        codes: runCodes.slice(0, 16),
      });
    }

    runStart = -1;
    runCodes = [];
  };

  for (let offset = 0; offset + 2 <= buffer.length; offset += 2) {
    const value = safeReadUInt16(buffer, offset, endian);
    const probableCode = value !== null && value >= 0x0100 && value <= 0x3fff && value !== 0xffff;

    if (probableCode) {
      if (runStart < 0) {
        runStart = offset;
      }

      runCodes.push(`P${value.toString(16).toUpperCase().padStart(4, '0').slice(-4)}`);
    } else {
      flush(offset);
    }
  }

  flush(buffer.length);

  return regions.slice(0, 8);
}

function detectDtcTables(
  asciiPatterns: PatternMatch[],
  buffer: Buffer,
  collector: EvidenceCollector
): DtcTableHeuristic[] {
  const asciiDtcPatterns = asciiPatterns.filter((pattern) =>
    /\b(?:P|C|B|U)[0-3][0-9A-F]{3}\b/i.test(pattern.value)
  );
  const beRegions = detectNumericDtcRegions(buffer, 'big');
  const leRegions = detectNumericDtcRegions(buffer, 'little');
  const heuristics: DtcTableHeuristic[] = [];

  if (asciiDtcPatterns.length > 0) {
    const evidenceId = collector.add({
      category: 'diagnostics',
      label: 'ASCII DTC code table/string candidates found',
      confidence: Math.min(0.55 + asciiDtcPatterns.length * 0.05, 0.86),
      offsets: asciiDtcPatterns.map((pattern) => pattern.offset).slice(0, 12),
      details: {
        sampleCodes: asciiDtcPatterns.map((pattern) => pattern.value).slice(0, 12),
      },
    });
    heuristics.push({
      probable: true,
      confidence: Math.min(0.55 + asciiDtcPatterns.length * 0.05, 0.86),
      encoding: 'ascii',
      regions: asciiDtcPatterns.map((pattern) => offsetRegion(pattern.offset, pattern.length)),
      sampleCodes: asciiDtcPatterns.map((pattern) => pattern.value).slice(0, 12),
      evidenceIds: [evidenceId],
    });
  }

  for (const [encoding, regions] of [
    ['uint16-be', beRegions],
    ['uint16-le', leRegions],
  ] as const) {
    if (regions.length === 0) {
      continue;
    }

    const firstRegion = regions[0];
    const evidenceId = collector.add({
      category: 'diagnostics',
      label: `${encoding} DTC numeric table candidate found`,
      confidence: Math.min(0.5 + firstRegion.codes.length * 0.025, 0.82),
      region: firstRegion,
      details: {
        regionCount: regions.length,
        sampleCodes: firstRegion.codes,
      },
    });
    heuristics.push({
      probable: true,
      confidence: Math.min(0.5 + firstRegion.codes.length * 0.025, 0.82),
      encoding,
      regions,
      sampleCodes: firstRegion.codes,
      evidenceIds: [evidenceId],
    });
  }

  return heuristics.sort((left, right) => right.confidence - left.confidence).slice(0, 4);
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return Number((values.reduce((total, value) => total + value, 0) / values.length).toFixed(4));
}

function regionsOverlap(left: OffsetRegion, right: OffsetRegion): boolean {
  return left.offset < right.endOffset && right.offset < left.endOffset;
}

function regionEntropy(windows: EntropyWindow[], region: OffsetRegion): number {
  const overlaps = windows.filter((window) => regionsOverlap(window, region));
  return average(overlaps.map((window) => window.entropy));
}

function groupWindowsAsRegions(
  windows: EntropyWindow[],
  type: FirmwareRegionType,
  predicate: (window: EntropyWindow) => boolean,
  collector: EvidenceCollector,
  label: string,
  confidence: number,
  notes: string[]
): FirmwareRegion[] {
  const regions: FirmwareRegion[] = [];
  let active: EntropyWindow[] = [];

  const flush = () => {
    if (active.length === 0) {
      return;
    }

    const first = active[0];
    const last = active[active.length - 1];
    const region = offsetRegion(first.offset, last.endOffset - first.offset);
    const evidenceId = collector.add({
      category: 'region',
      label,
      confidence,
      region,
      details: {
        type,
        windowCount: active.length,
      },
    });

    regions.push({
      ...region,
      type,
      entropy: average(active.map((window) => window.entropy)),
      confidence: clampConfidence(confidence),
      evidenceIds: [evidenceId],
      notes,
    });
    active = [];
  };

  for (const window of windows) {
    if (predicate(window)) {
      active.push(window);
    } else {
      flush();
    }
  }

  flush();
  return regions;
}

function detectCalibrationRegions(
  windows: EntropyWindow[],
  dtcTables: DtcTableHeuristic[],
  collector: EvidenceCollector,
  fileLength: number
): FirmwareRegion[] {
  const candidates = groupWindowsAsRegions(
    windows,
    'calibration',
    (window) => {
      const isStructured = window.entropy >= 2.2 && window.entropy <= 7.35;
      const isNotBlank = window.zeroByteRatio + window.ffByteRatio < 0.72;
      const scalarLike = window.scalarScore >= 0.35;
      const likelyPlacement = window.offset >= fileLength * 0.25;
      return isStructured && isNotBlank && scalarLike && likelyPlacement;
    },
    collector,
    'Probable calibration/scalar table region',
    0.62,
    ['Read-only probable calibration region; no map definitions or editing are produced.']
  );

  for (const candidate of candidates) {
    if (dtcTables.some((dtc) => dtc.regions.some((region) => regionsOverlap(candidate, region)))) {
      candidate.type = 'diagnostics';
      candidate.confidence = clampConfidence(candidate.confidence + 0.08);
      candidate.notes.push('Overlaps probable DTC table area.');
    }
  }

  return candidates.sort(
    (left, right) => right.confidence - left.confidence || left.offset - right.offset
  );
}

function segmentFirmwareRegions(
  windows: EntropyWindow[],
  vectorTables: VectorTableDetection[],
  calibrationRegions: FirmwareRegion[],
  asciiPatterns: PatternMatch[],
  collector: EvidenceCollector
): FirmwareRegion[] {
  const vectorRegions = vectorTables.map((vector) => ({
    ...offsetRegion(vector.offset, vector.length),
    type: 'vectors' as const,
    entropy: regionEntropy(windows, vector),
    confidence: vector.confidence,
    evidenceIds: vector.evidenceIds,
    notes: [`${vector.architecture} vector table candidate.`],
  }));
  const blankRegions = groupWindowsAsRegions(
    windows,
    'blank',
    (window) => window.zeroByteRatio + window.ffByteRatio >= 0.85 || window.entropy < 0.5,
    collector,
    'Blank/fill firmware region',
    0.58,
    ['Mostly 0x00/0xFF fill bytes.']
  );
  const highEntropyRegions = groupWindowsAsRegions(
    windows,
    'code',
    (window) =>
      window.entropy >= 6.2 &&
      window.entropy < 7.7 &&
      window.zeroByteRatio + window.ffByteRatio < 0.55 &&
      window.asciiRatio < 0.25,
    collector,
    'Probable executable/code region',
    0.52,
    ['High structured entropy, low printable text ratio.']
  );
  const metadataRegions = asciiPatterns
    .filter((pattern) => pattern.confidence >= 0.66)
    .slice(0, 16)
    .map((pattern) => ({
      ...offsetRegion(pattern.offset, pattern.length),
      type: 'metadata' as const,
      entropy: 0,
      confidence: pattern.confidence,
      evidenceIds: pattern.evidenceIds,
      notes: [`${pattern.label} string region.`],
    }));

  return [
    ...vectorRegions,
    ...calibrationRegions,
    ...blankRegions,
    ...highEntropyRegions,
    ...metadataRegions,
  ]
    .sort((left, right) => left.offset - right.offset || right.confidence - left.confidence)
    .slice(0, 80);
}

function createConfidenceScores(analysis: {
  architectures: ArchitectureFingerprint[];
  platforms: EcuPlatformDetection[];
  mcuCandidates: EcuMcuCandidate[];
  calibrationRegions: FirmwareRegion[];
  dtcTables: DtcTableHeuristic[];
  checksumFamilies: ChecksumFamilyHeuristic[];
}): ConfidenceScore[] {
  const scores: ConfidenceScore[] = [];
  const push = (name: string, score: number, evidenceIds: string[]) => {
    scores.push({
      name,
      score: clampConfidence(score),
      band: confidenceBand(score),
      evidenceIds: Array.from(new Set(evidenceIds)),
    });
  };

  const primaryArchitecture = analysis.architectures[0];
  const primaryPlatform = analysis.platforms[0];
  const primaryMcu = analysis.mcuCandidates[0];
  const calibrationConfidence = analysis.calibrationRegions[0]?.confidence ?? 0;
  const dtcConfidence = analysis.dtcTables[0]?.confidence ?? 0;
  const checksumConfidence = analysis.checksumFamilies[0]?.confidence ?? 0;

  if (primaryArchitecture) {
    push('architecture', primaryArchitecture.confidence, primaryArchitecture.evidenceIds);
  }
  if (primaryMcu) {
    push('mcu', primaryMcu.confidence, primaryMcu.evidenceIds);
  }
  if (primaryPlatform) {
    push('platform', primaryPlatform.confidence, primaryPlatform.evidenceIds);
  }
  push(
    'calibration-region',
    calibrationConfidence,
    analysis.calibrationRegions.flatMap((region) => region.evidenceIds)
  );
  push(
    'dtc-table',
    dtcConfidence,
    analysis.dtcTables.flatMap((table) => table.evidenceIds)
  );
  push(
    'checksum-family',
    checksumConfidence,
    analysis.checksumFamilies.flatMap((checksum) => checksum.evidenceIds)
  );

  return scores;
}

export function analyzeEcuBinary(
  buffer: Buffer,
  options: EcuAnalysisOptions = {}
): EcuBinaryIntelligence {
  const collector = createEvidenceCollector();
  const hashes = hashBinFile(buffer);
  const metadata = extractBinMetadata(buffer);
  const windowSize = chooseWindowSize(buffer.length);
  const entropyWindows = createEntropyWindows(buffer, windowSize);
  const asciiPatterns = extractAsciiPatterns(buffer, collector, options.maxAsciiPatterns ?? 120);
  const hexPatterns = extractHexPatterns(buffer, collector, options.maxHexPatterns ?? 80);
  const haystack = haystackFrom(options, asciiPatterns);
  const vectorTables = detectVectorTables(buffer, collector);
  const architectures = detectArchitectureFingerprints(
    haystack,
    asciiPatterns,
    vectorTables,
    collector
  );
  const platforms = detectPlatforms(haystack, asciiPatterns, architectures, collector);
  const mcuCandidates = detectMcuSignatures(
    haystack,
    asciiPatterns,
    architectures,
    platforms,
    collector
  );
  const checksumFamilies = detectChecksumFamilies(
    haystack,
    asciiPatterns,
    platforms,
    buffer,
    collector
  );
  const dtcTables = detectDtcTables(asciiPatterns, buffer, collector);
  const calibrationRegions = detectCalibrationRegions(
    entropyWindows,
    dtcTables,
    collector,
    buffer.length
  );
  const regions = segmentFirmwareRegions(
    entropyWindows,
    vectorTables,
    calibrationRegions,
    asciiPatterns,
    collector
  );
  const lowEntropyRegions = regions.filter((region) => region.type === 'blank');
  const highEntropyRegions = regions.filter((region) => region.type === 'code');
  const calibrationConfidence = calibrationRegions[0]?.confidence ?? 0;
  const confidenceScores = createConfidenceScores({
    architectures,
    platforms,
    mcuCandidates,
    calibrationRegions,
    dtcTables,
    checksumFamilies,
  });
  const primaryArchitecture = architectures[0] ?? null;
  const primaryMcu = mcuCandidates[0] ?? null;
  const primaryPlatform = platforms[0] ?? null;
  const primaryDtc = dtcTables[0] ?? null;

  return {
    schemaVersion: ecuIntelligenceSchemaVersion,
    readOnly: true,
    input: {
      byteSize: buffer.length,
      ...(options.fileName ? { fileName: options.fileName } : {}),
      ...(options.productContext ? { productContext: options.productContext } : {}),
    },
    file: {
      sha256: hashes.sha256,
      md5: hashes.md5,
      entropy: metadata.entropy,
      entropyBand: classifyEntropyBand(
        metadata.entropy,
        metadata.zeroByteRatio,
        metadata.ffByteRatio
      ),
      magicHex: metadata.magicHex,
      trailingHex: metadata.trailingHex,
      likelyEndian: metadata.likelyEndian,
      zeroByteRatio: metadata.zeroByteRatio,
      ffByteRatio: metadata.ffByteRatio,
    },
    entropy: {
      global: metadata.entropy,
      windowSize,
      windows: entropyWindows,
      lowEntropyRegions,
      highEntropyRegions,
    },
    architecture: architectures,
    mcu: {
      candidates: mcuCandidates,
    },
    platforms,
    checksumFamilies,
    vectors: vectorTables,
    regions,
    calibration: {
      probableRegions: calibrationRegions,
      confidence: calibrationConfidence,
      evidenceIds: calibrationRegions.flatMap((region) => region.evidenceIds),
    },
    patterns: {
      ascii: asciiPatterns,
      hex: hexPatterns,
    },
    diagnostics: {
      dtcTables,
    },
    confidenceScores,
    evidence: collector.evidence,
    normalizedSummary: {
      primaryArchitecture,
      primaryMcu,
      probableSupplier: primaryPlatform?.supplier ?? null,
      probablePlatform: primaryPlatform?.platform ?? null,
      probableOem: primaryPlatform?.probableOem ?? probableOemFromHaystack(haystack) ?? null,
      calibrationConfidence,
      dtcConfidence: primaryDtc?.confidence ?? 0,
    },
  };
}
