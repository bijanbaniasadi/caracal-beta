import { createHash } from 'node:crypto';
import type { EcuPatcherModule } from '@prisma/client';

import { legacyPatchSets, type LegacyPatchTuple } from './legacy-patch-data.js';

export type PatcherJobStatus = 'COMPLETED' | 'FAILED' | 'REJECTED';

interface ModuleConfig {
  module: EcuPatcherModule;
  legacyKey?: keyof typeof legacyPatchSets;
  label: string;
  expectedFileSize?: number;
  suffix: string;
  checksum?: {
    offset: number;
    value: number;
    label: string;
  };
}

export interface PatchExecutionInput {
  module: EcuPatcherModule;
  fileName: string;
  bytes: Buffer;
  fixChecksum?: boolean;
}

export interface PatchExecutionResult {
  status: PatcherJobStatus;
  outputBytes?: Buffer;
  outputFileName?: string;
  resultSha256?: string;
  resultByteSize?: number;
  patchesTotal: number;
  patchesReady: number;
  patchesApplied: number;
  patchesAlreadyApplied: number;
  patchesMismatched: number;
  checksumApplied: boolean;
  checksumOffset?: number;
  checksumValue?: string;
  failureCode?: string;
  failureMessage?: string;
  logs: Array<{ level: 'info' | 'ok' | 'warn' | 'error'; message: string }>;
  metadata: Record<string, unknown>;
}

export const moduleConfigs: Record<EcuPatcherModule, ModuleConfig> = {
  DCM71B_DPF: {
    module: 'DCM71B_DPF',
    legacyKey: 'DCM71B_DPF',
    label: 'PSA Delphi DCM7.1b DPF-Off',
    expectedFileSize: 6_291_456,
    suffix: '_DPF_off',
    checksum: {
      offset: 0x180184,
      value: 0xfacf5b2a,
      label: 'Viezu verified checksum marker',
    },
  },
  DCM71B_EGR: {
    module: 'DCM71B_EGR',
    legacyKey: 'DCM71B_EGR',
    label: 'PSA Delphi DCM7.1b EGR-Off',
    expectedFileSize: 6_291_456,
    suffix: '_EGR_off',
  },
  SID208_DPF_EGR: {
    module: 'SID208_DPF_EGR',
    legacyKey: 'SID208_ALL',
    label: 'PSA Siemens SID208 DPF+EGR Off',
    expectedFileSize: 4_194_304,
    suffix: '_DPF_EGR_off',
  },
  DTC_REMOVER: {
    module: 'DTC_REMOVER',
    label: 'DTC Remover',
    suffix: '_DTC_patched',
  },
};

function hexToBytes(hex: string): Buffer {
  if (hex.length % 2 !== 0) {
    throw new Error(`Invalid hex string length: ${hex.length}`);
  }

  return Buffer.from(hex, 'hex');
}

function bytesMatch(data: Buffer, offset: number, expected: Buffer): boolean {
  if (offset < 0 || offset + expected.length > data.length) {
    return false;
  }

  for (let index = 0; index < expected.length; index += 1) {
    if (data[offset + index] !== expected[index]) return false;
  }

  return true;
}

function writeBytes(data: Buffer, offset: number, value: Buffer): void {
  value.copy(data, offset);
}

function writeU32LE(data: Buffer, offset: number, value: number): void {
  data[offset] = value & 0xff;
  data[offset + 1] = (value >> 8) & 0xff;
  data[offset + 2] = (value >> 16) & 0xff;
  data[offset + 3] = (value >> 24) & 0xff;
}

function resultFileName(fileName: string, suffix: string): string {
  const base = fileName.replace(/\.[^.]+$/, '') || 'patched';
  return `${base}${suffix}.bin`;
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function statusForPatchSet(data: Buffer, patches: LegacyPatchTuple[]) {
  let ready = 0;
  let already = 0;
  let mismatched = 0;

  for (const patch of patches) {
    const original = hexToBytes(patch.originalHex);
    const patched = hexToBytes(patch.patchedHex);

    if (bytesMatch(data, patch.offset, original)) {
      ready += 1;
    } else if (bytesMatch(data, patch.offset, patched)) {
      already += 1;
    } else {
      mismatched += 1;
    }
  }

  return { ready, already, mismatched, total: patches.length };
}

function applyPatchSet(data: Buffer, patches: LegacyPatchTuple[]): number {
  let applied = 0;

  for (const patch of patches) {
    const original = hexToBytes(patch.originalHex);
    if (!bytesMatch(data, patch.offset, original)) continue;

    writeBytes(data, patch.offset, hexToBytes(patch.patchedHex));
    applied += 1;
  }

  return applied;
}

function scanDtcTables(data: Buffer) {
  const regions: Array<{
    start: number;
    entries: number;
    activeEntries: number;
  }> = [];
  const seen = new Set<number>();
  let index = 0;

  while (index < data.length - 2) {
    if (data[index] >= 1 && data[index] <= 3 && data[index + 1] === 0) {
      const start = index;
      let count = 0;
      let active = 0;
      let cursor = index;

      while (cursor + 1 < data.length && data[cursor] <= 3 && data[cursor + 1] === 0) {
        if (data[cursor] > 0) active += 1;
        count += 1;
        cursor += 2;
      }

      if (count >= 16 && active >= Math.floor(count / 3) && !seen.has(start)) {
        regions.push({ start, entries: count, activeEntries: active });
        seen.add(start);
      }

      index = cursor;
    } else {
      index += 1;
    }
  }

  return regions;
}

function applyDtcAllOff(data: Buffer, regions: ReturnType<typeof scanDtcTables>): number {
  let changed = 0;

  for (const region of regions) {
    for (let row = 0; row < region.entries; row += 1) {
      const offset = region.start + row * 2;
      if (data[offset] > 0) {
        data[offset] = 0;
        changed += 1;
      }
    }
  }

  return changed;
}

export function executeLegacyPatch(input: PatchExecutionInput): PatchExecutionResult {
  const config = moduleConfigs[input.module];
  const output = Buffer.from(input.bytes);
  const logs: PatchExecutionResult['logs'] = [
    { level: 'info', message: `Loaded ${input.fileName} (${input.bytes.length} bytes).` },
  ];

  if (!config) {
    return {
      status: 'FAILED',
      patchesTotal: 0,
      patchesReady: 0,
      patchesApplied: 0,
      patchesAlreadyApplied: 0,
      patchesMismatched: 0,
      checksumApplied: false,
      failureCode: 'unsupported_module',
      failureMessage: 'Selected patcher module is not supported.',
      logs,
      metadata: {},
    };
  }

  if (config.expectedFileSize && input.bytes.length !== config.expectedFileSize) {
    logs.push({
      level: 'warn',
      message: `Unexpected file size. Expected ${config.expectedFileSize} bytes.`,
    });
  }

  if (input.module === 'DTC_REMOVER') {
    const regions = scanDtcTables(output);
    const entries = regions.reduce((total, region) => total + region.entries, 0);
    const activeEntries = regions.reduce((total, region) => total + region.activeEntries, 0);

    if (regions.length === 0) {
      return {
        status: 'REJECTED',
        patchesTotal: 0,
        patchesReady: 0,
        patchesApplied: 0,
        patchesAlreadyApplied: 0,
        patchesMismatched: 0,
        checksumApplied: false,
        failureCode: 'dtc_tables_not_found',
        failureMessage: 'No DTC table candidates were detected in this file.',
        logs: [
          ...logs,
          { level: 'warn', message: 'No DTC table candidates found by the legacy stride-2 scan.' },
        ],
        metadata: { regions: [] },
      };
    }

    const changed = applyDtcAllOff(output, regions);
    const outputFileName = resultFileName(input.fileName, config.suffix);
    logs.push({
      level: 'ok',
      message: `Detected ${regions.length} DTC region(s), ${entries} entries, ${activeEntries} active.`,
    });
    logs.push({ level: 'ok', message: `Disabled ${changed} active DTC entries.` });

    return {
      status: 'COMPLETED',
      outputBytes: output,
      outputFileName,
      resultSha256: sha256(output),
      resultByteSize: output.length,
      patchesTotal: entries,
      patchesReady: activeEntries,
      patchesApplied: changed,
      patchesAlreadyApplied: entries - activeEntries,
      patchesMismatched: 0,
      checksumApplied: false,
      logs,
      metadata: { regions },
    };
  }

  const patches = config.legacyKey ? legacyPatchSets[config.legacyKey] : [];
  const before = statusForPatchSet(output, patches);
  const applied = applyPatchSet(output, patches);
  let checksumApplied = false;

  logs.push({
    level: 'info',
    message: `${config.label}: ${before.total} patch entries loaded from legacy source.`,
  });
  logs.push({
    level: before.ready > 0 ? 'ok' : 'warn',
    message: `${before.ready} ready, ${before.already} already patched, ${before.mismatched} mismatched.`,
  });
  logs.push({
    level: applied > 0 ? 'ok' : 'warn',
    message: `Applied ${applied} / ${before.total} patch entries.`,
  });

  if (config.checksum && input.fixChecksum !== false) {
    writeU32LE(output, config.checksum.offset, config.checksum.value);
    checksumApplied = true;
    logs.push({
      level: 'ok',
      message: `Checksum marker written at 0x${config.checksum.offset.toString(16).toUpperCase()}.`,
    });
  }

  if (applied === 0 && before.already === 0) {
    return {
      status: 'REJECTED',
      patchesTotal: before.total,
      patchesReady: before.ready,
      patchesApplied: applied,
      patchesAlreadyApplied: before.already,
      patchesMismatched: before.mismatched,
      checksumApplied,
      checksumOffset: checksumApplied ? config.checksum?.offset : undefined,
      checksumValue: checksumApplied
        ? `0x${config.checksum?.value.toString(16).toUpperCase()}`
        : undefined,
      failureCode: 'no_matching_legacy_patches',
      failureMessage:
        'No legacy patch signatures matched this file. The file was not stored as a patched result.',
      logs: [
        ...logs,
        {
          level: 'error',
          message: 'Patch rejected because no original legacy signatures matched this binary.',
        },
      ],
      metadata: { expectedFileSize: config.expectedFileSize },
    };
  }

  const outputFileName = resultFileName(input.fileName, config.suffix);

  return {
    status: 'COMPLETED',
    outputBytes: output,
    outputFileName,
    resultSha256: sha256(output),
    resultByteSize: output.length,
    patchesTotal: before.total,
    patchesReady: before.ready,
    patchesApplied: applied,
    patchesAlreadyApplied: before.already,
    patchesMismatched: before.mismatched,
    checksumApplied,
    checksumOffset: checksumApplied ? config.checksum?.offset : undefined,
    checksumValue: checksumApplied
      ? `0x${config.checksum?.value.toString(16).toUpperCase()}`
      : undefined,
    logs,
    metadata: {
      expectedFileSize: config.expectedFileSize,
      moduleLabel: config.label,
      legacySource: 'ecu-patcher.php',
    },
  };
}
