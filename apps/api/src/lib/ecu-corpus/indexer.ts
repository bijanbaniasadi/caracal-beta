import { createHash } from 'node:crypto';
import path from 'node:path';
import { readdir, stat } from 'node:fs/promises';
import { getPrismaClient } from '@caracal/db';

import { toPrismaJson } from '../prisma-json.js';
import {
  classifyKnownFamilies,
  extractVersionHints,
  inferControllerType,
  inferFuelType,
  inferProbableOem,
  type CorpusFamilyDetection,
} from './classifiers.js';
import {
  binaryLikeExtensions,
  detectFileKind,
  fingerprintCorpusFile,
  sha256File,
} from './fingerprint.js';
import { extractProjectLabels } from './label-extraction.js';
import { sizeBucket, stableKey, toJsonSafe } from './serialization.js';

const defaultCorpusRoot = 'C:\\Users\\Bijan\\Desktop\\SAFE\\Damos and files';

export interface ScanEcuCorpusInput {
  rootPath?: string;
  maxAnalysisBytes?: number;
  maxFiles?: number;
  maxPairCandidates?: number;
}

export interface EcuCorpusValidationSummary {
  runId: string;
  rootPath: string;
  totalFilesIndexed: number;
  extensionBreakdown: Record<string, number>;
  duplicateCount: number;
  clusterCount: number;
  knownFamilyCount: number;
  unknownFamilyCount: number;
  oriModPairCandidates: number;
  topReusableSignatures: Array<{
    signatureType: string;
    label: string;
    confidence: number;
    clusterId?: string | null;
  }>;
  failedUnreadableFiles: Array<{
    fullPath: string;
    error: string;
  }>;
}

interface FileFeature {
  fileId: string;
  fullPath: string;
  relativePath: string;
  directory: string;
  fileName: string;
  extension: string;
  detectedKind: string;
  sizeBytes: bigint;
  sha256: string;
  entropy: number;
  filenameTokens: string[];
  strings: string[];
  byteSignatures: Array<{ offset: number; hex: string }>;
  labelNames: string[];
  detections: CorpusFamilyDetection[];
  architecture?: string | null;
  supplier?: string | null;
  probableOem?: string | null;
  controllerType?: string | null;
  fuelType?: string | null;
  calibrationRegions: Array<{ offset: number; length: number; confidence: number }>;
  mapRegions: Array<{ offset?: string; length?: number; name?: string; confidence?: number }>;
  softwareVersion?: string;
  hardwareNumber?: string;
}

interface WalkFailure {
  fullPath: string;
  error: string;
}

function maxAnalysisBytes(): number {
  return Number.parseInt(process.env.ECU_CORPUS_MAX_ANALYSIS_BYTES ?? String(2 * 1024 * 1024), 10);
}

function maxPairCandidates(): number {
  return Number.parseInt(process.env.ECU_CORPUS_MAX_PAIR_CANDIDATES ?? '5000', 10);
}

function fallbackUnreadableHash(filePath: string): string {
  return `UNREADABLE:${createHash('sha256').update(filePath).digest('hex')}`;
}

function extensionOf(filePath: string): string {
  return path.extname(filePath).toLowerCase();
}

async function* walkFiles(rootPath: string, failures: WalkFailure[]): AsyncGenerator<string> {
  let entries;

  try {
    entries = await readdir(rootPath, { withFileTypes: true });
  } catch (error) {
    failures.push({
      fullPath: rootPath,
      error: error instanceof Error ? error.message : 'Unable to read directory.',
    });
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(rootPath, entry.name);

    if (entry.isDirectory()) {
      yield* walkFiles(fullPath, failures);
    } else if (entry.isFile()) {
      yield fullPath;
    } else if (entry.isSymbolicLink()) {
      try {
        const linkStat = await stat(fullPath);
        if (linkStat.isFile()) {
          yield fullPath;
        }
      } catch (error) {
        failures.push({
          fullPath,
          error: error instanceof Error ? error.message : 'Unable to stat symlink.',
        });
      }
    }
  }
}

function extensionBreakdown(features: FileFeature[], failures: WalkFailure[]) {
  const breakdown: Record<string, number> = {};

  for (const feature of features) {
    const extension = feature.extension || '[none]';
    breakdown[extension] = (breakdown[extension] ?? 0) + 1;
  }

  for (const failure of failures) {
    const extension = extensionOf(failure.fullPath) || '[none]';
    breakdown[extension] = (breakdown[extension] ?? 0) + 1;
  }

  return Object.fromEntries(Object.entries(breakdown).sort((left, right) => right[1] - left[1]));
}

function duplicateCount(features: FileFeature[]): number {
  const counts = new Map<string, number>();

  for (const feature of features) {
    counts.set(feature.sha256, (counts.get(feature.sha256) ?? 0) + 1);
  }

  return Array.from(counts.values()).reduce((total, count) => total + Math.max(count - 1, 0), 0);
}

function familyClusterKey(feature: FileFeature): string {
  const primary = feature.detections[0];
  const size = sizeBucket(feature.sizeBytes);
  const architecture = stableKey(feature.architecture ?? 'unknown');

  if (primary && primary.confidence >= 0.62) {
    return `KNOWN:${primary.familyKey}:${architecture}:${size}`;
  }

  const usefulTokens = feature.filenameTokens
    .filter((token) => !/^(ORI|ORIGINAL|MOD|STAGE1|STAGE2|TUNED|FILE|READ|NEW|OLD)$/i.test(token))
    .slice(0, 5)
    .join('_');
  const tokenKey = stableKey(
    usefulTokens || feature.byteSignatures[0]?.hex.slice(0, 16) || 'unclustered'
  );

  return `UNKNOWN:${feature.extension || 'NOEXT'}:${architecture}:${size}:${tokenKey}`;
}

function clusterLabel(clusterKey: string, members: FileFeature[]): string {
  const primary = members.find((member) => member.detections[0])?.detections[0];

  if (primary) {
    return primary.familyLabel;
  }

  const tokens = new Map<string, number>();
  for (const member of members) {
    for (const token of member.filenameTokens.slice(0, 12)) {
      tokens.set(token, (tokens.get(token) ?? 0) + 1);
    }
  }

  const topTokens = Array.from(tokens.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4)
    .map(([token]) => token)
    .join(' ');

  return topTokens ? `Unknown ECU/TCU cluster: ${topTokens}` : clusterKey;
}

function commonTokenSignatures(members: FileFeature[]) {
  const counts = new Map<string, number>();

  for (const member of members) {
    for (const token of new Set([...member.filenameTokens, ...member.labelNames.slice(0, 100)])) {
      if (token.length >= 3) {
        counts.set(token, (counts.get(token) ?? 0) + 1);
      }
    }
  }

  return Array.from(counts.entries())
    .filter(([, count]) => count >= Math.max(2, Math.ceil(members.length * 0.25)))
    .sort((left, right) => right[1] - left[1])
    .slice(0, 20)
    .map(([token, count]) => ({ token, count }));
}

function commonByteSignatures(members: FileFeature[]) {
  const counts = new Map<string, number>();

  for (const member of members) {
    for (const signature of member.byteSignatures) {
      const key = `${signature.offset}:${signature.hex}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .filter(([, count]) => count >= Math.max(2, Math.ceil(members.length * 0.2)))
    .sort((left, right) => right[1] - left[1])
    .slice(0, 12)
    .map(([key, count]) => ({ key, count }));
}

function jaccard(left: string[], right: string[]): number {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const intersection = Array.from(leftSet).filter((token) => rightSet.has(token)).length;
  const union = new Set([...leftSet, ...rightSet]).size;
  return union === 0 ? 0 : intersection / union;
}

function stockModSignal(feature: FileFeature): 'stock' | 'modified' | 'unknown' {
  const haystack = [feature.fileName, ...feature.filenameTokens].join(' ');

  if (/\b(?:ORI|ORIGINAL|STOCK|READ|VR|BACKUP)\b/i.test(haystack)) return 'stock';
  if (/\b(?:MOD|STAGE\d|TUNED|TUNE|REMAPPED|CUSTOM)\b/i.test(haystack)) return 'modified';
  return 'unknown';
}

async function diffFiles(leftPath: string, rightPath: string, maxBytes: number) {
  const { readSample } = await import('./fingerprint.js');
  const [left, right] = await Promise.all([
    readSample(leftPath, maxBytes),
    readSample(rightPath, maxBytes),
  ]);
  const length = Math.min(left.length, right.length);
  const regions: Array<{ offset: number; length: number; density: number }> = [];
  let diffCount = 0;
  let regionStart = -1;
  let regionDiffs = 0;

  const flush = (offset: number) => {
    if (regionStart >= 0) {
      regions.push({
        offset: regionStart,
        length: offset - regionStart,
        density: Number((regionDiffs / Math.max(offset - regionStart, 1)).toFixed(4)),
      });
      regionStart = -1;
      regionDiffs = 0;
    }
  };

  for (let offset = 0; offset < length; offset += 1) {
    const different = left[offset] !== right[offset];
    if (different) {
      diffCount += 1;
      if (regionStart < 0) regionStart = offset;
      regionDiffs += 1;
    } else if (regionStart >= 0 && offset - regionStart > 16) {
      flush(offset);
    }
  }

  flush(length);

  return {
    shaDistance: Number((diffCount / Math.max(length, 1)).toFixed(6)),
    changedRegions: regions.filter((region) => region.length > 1).slice(0, 120),
  };
}

async function indexCorpusFile(input: {
  runId: string;
  rootPath: string;
  fullPath: string;
  maxAnalysisBytes: number;
}): Promise<FileFeature> {
  const prisma = getPrismaClient();
  const fileStat = await stat(input.fullPath);
  const extension = extensionOf(input.fullPath);
  const fileName = path.basename(input.fullPath);
  const relativePath = path.relative(input.rootPath, input.fullPath);
  const detectedKind = detectFileKind(extension);
  const sha256 = await sha256File(input.fullPath);
  const fingerprint = await fingerprintCorpusFile({
    filePath: input.fullPath,
    fileName,
    extension,
    productContext: relativePath,
    maxAnalysisBytes: input.maxAnalysisBytes,
  });
  const projectLabels = extractProjectLabels({
    buffer: fingerprint.sampleBuffer,
    extension,
    strings: fingerprint.strings,
    fileName,
  });
  const labelNames = [
    ...projectLabels.labels.map((label) => label.name.toUpperCase()),
    ...projectLabels.maps.map((map) => map.name.toUpperCase()),
  ].slice(0, 400);
  const stringValues = fingerprint.strings.map((item) => item.value).slice(0, 300);
  const detections = classifyKnownFamilies({
    fileName,
    extension,
    filenameTokens: fingerprint.filenameTokens,
    strings: stringValues,
    labelNames,
    intelligence: fingerprint.intelligence,
  });
  const allValues = [
    fileName,
    relativePath,
    ...fingerprint.filenameTokens,
    ...stringValues,
    ...labelNames,
  ];
  const versionHints = extractVersionHints(allValues);
  const primaryDetection = detections[0];
  const architecture =
    primaryDetection?.architecture ??
    fingerprint.intelligence?.normalizedSummary.primaryArchitecture?.architecture;
  const supplier =
    primaryDetection?.supplier ?? fingerprint.intelligence?.normalizedSummary.probableSupplier;
  const probableOem =
    primaryDetection?.oem ??
    fingerprint.intelligence?.normalizedSummary.probableOem ??
    inferProbableOem(allValues);
  const controllerType = primaryDetection?.controllerType ?? inferControllerType(allValues);
  const fuelType = primaryDetection?.fuelType ?? inferFuelType(allValues);

  const corpusFile = await prisma.ecuCorpusFile.upsert({
    where: { fullPath: input.fullPath },
    update: {
      runId: input.runId,
      rootPath: input.rootPath,
      relativePath,
      fileName,
      extension,
      detectedKind,
      sizeBytes: BigInt(fileStat.size),
      sha256,
      createdAtOnDisk: fileStat.birthtime,
      modifiedAtOnDisk: fileStat.mtime,
      indexedAt: new Date(),
      isReadable: true,
      readError: null,
      metadata: toPrismaJson({
        sampledBytes: fingerprint.sampledBytes,
        sampledOnly: fileStat.size > fingerprint.sampledBytes,
        project: projectLabels.metadata,
      }),
    },
    create: {
      runId: input.runId,
      rootPath: input.rootPath,
      relativePath,
      fullPath: input.fullPath,
      fileName,
      extension,
      detectedKind,
      sizeBytes: BigInt(fileStat.size),
      sha256,
      createdAtOnDisk: fileStat.birthtime,
      modifiedAtOnDisk: fileStat.mtime,
      isReadable: true,
      metadata: toPrismaJson({
        sampledBytes: fingerprint.sampledBytes,
        sampledOnly: fileStat.size > fingerprint.sampledBytes,
        project: projectLabels.metadata,
      }),
    },
  });

  await prisma.$transaction([
    prisma.ecuDetectedFamily.deleteMany({ where: { fileId: corpusFile.id } }),
    prisma.ecuProjectLabel.deleteMany({ where: { fileId: corpusFile.id } }),
    prisma.ecuMapDefinition.deleteMany({ where: { fileId: corpusFile.id } }),
    prisma.ecuMapRegion.deleteMany({ where: { fileId: corpusFile.id } }),
    prisma.ecuChecksumCandidate.deleteMany({ where: { fileId: corpusFile.id } }),
    prisma.ecuDtcCandidate.deleteMany({ where: { fileId: corpusFile.id } }),
  ]);

  await prisma.ecuBinaryFingerprint.upsert({
    where: { fileId: corpusFile.id },
    update: {
      entropy: fingerprint.entropy,
      entropyProfile: toPrismaJson(fingerprint.entropyProfile),
      architecture,
      supplier,
      probableOem,
      controllerType,
      fuelType,
      softwareVersion: versionHints.softwareVersion,
      hardwareNumber: versionHints.hardwareNumber,
      filenameTokens: toPrismaJson(fingerprint.filenameTokens),
      stringTable: toPrismaJson(fingerprint.strings.slice(0, 300)),
      byteSignatures: toPrismaJson(fingerprint.byteSignatures),
      vectorPatterns: toPrismaJson(fingerprint.intelligence?.vectors ?? []),
      calibrationRegions: toPrismaJson(fingerprint.intelligence?.calibration.probableRegions ?? []),
      mapBlockCandidates: toPrismaJson(projectLabels.maps.slice(0, 200)),
      checksumCandidates: toPrismaJson(fingerprint.intelligence?.checksumFamilies ?? []),
      dtcCandidates: toPrismaJson(fingerprint.intelligence?.diagnostics.dtcTables ?? []),
      intelligenceSummary: toPrismaJson(fingerprint.intelligence?.normalizedSummary ?? null),
      metadata: toPrismaJson({
        entropyBand: fingerprint.intelligence?.file.entropyBand,
        project: projectLabels.metadata,
      }),
    },
    create: {
      fileId: corpusFile.id,
      entropy: fingerprint.entropy,
      entropyProfile: toPrismaJson(fingerprint.entropyProfile),
      architecture,
      supplier,
      probableOem,
      controllerType,
      fuelType,
      softwareVersion: versionHints.softwareVersion,
      hardwareNumber: versionHints.hardwareNumber,
      filenameTokens: toPrismaJson(fingerprint.filenameTokens),
      stringTable: toPrismaJson(fingerprint.strings.slice(0, 300)),
      byteSignatures: toPrismaJson(fingerprint.byteSignatures),
      vectorPatterns: toPrismaJson(fingerprint.intelligence?.vectors ?? []),
      calibrationRegions: toPrismaJson(fingerprint.intelligence?.calibration.probableRegions ?? []),
      mapBlockCandidates: toPrismaJson(projectLabels.maps.slice(0, 200)),
      checksumCandidates: toPrismaJson(fingerprint.intelligence?.checksumFamilies ?? []),
      dtcCandidates: toPrismaJson(fingerprint.intelligence?.diagnostics.dtcTables ?? []),
      intelligenceSummary: toPrismaJson(fingerprint.intelligence?.normalizedSummary ?? null),
      metadata: toPrismaJson({
        entropyBand: fingerprint.intelligence?.file.entropyBand,
        project: projectLabels.metadata,
      }),
    },
  });

  if (detections.length > 0) {
    await prisma.ecuDetectedFamily.createMany({
      data: detections.map((detection) => ({
        fileId: corpusFile.id,
        familyKey: detection.familyKey,
        familyLabel: detection.familyLabel,
        supplier: detection.supplier,
        oem: detection.oem,
        controllerType: detection.controllerType,
        fuelType: detection.fuelType,
        architecture: detection.architecture,
        confidence: detection.confidence,
        evidence: toPrismaJson(detection.evidence),
      })),
    });
  }

  if (projectLabels.labels.length > 0) {
    await prisma.ecuProjectLabel.createMany({
      data: projectLabels.labels.slice(0, 2000).map((label) => ({
        fileId: corpusFile.id,
        labelType: label.labelType,
        name: label.name,
        address: label.address,
        dataType: label.dataType,
        unit: label.unit,
        factor: label.factor,
        offset: label.offset,
        source: label.source,
        confidence: label.confidence,
        comments: label.comments,
        metadata: toPrismaJson(label.metadata),
      })),
    });
  }

  if (projectLabels.maps.length > 0) {
    await prisma.ecuMapDefinition.createMany({
      data: projectLabels.maps.slice(0, 2000).map((map) => ({
        fileId: corpusFile.id,
        name: map.name,
        address: map.address,
        dataType: map.dataType,
        axes: toPrismaJson(map.axes),
        factor: map.factor,
        offset: map.offset,
        unit: map.unit,
        comments: map.comments,
        metadata: toPrismaJson(map.metadata),
      })),
    });
  }

  const checksumFamilies = fingerprint.intelligence?.checksumFamilies ?? [];
  if (checksumFamilies.length > 0) {
    await prisma.ecuChecksumCandidate.createMany({
      data: checksumFamilies.flatMap((checksum) =>
        (checksum.regions.length > 0 ? checksum.regions : [{ offset: 0, length: 0 }]).map(
          (region) => ({
            fileId: corpusFile.id,
            family: checksum.family,
            offset: BigInt(region.offset),
            length: region.length,
            confidence: checksum.confidence,
            evidence: toPrismaJson({
              evidenceIds: checksum.evidenceIds,
              notes: checksum.notes,
            }),
          })
        )
      ),
    });
  }

  const dtcTables = fingerprint.intelligence?.diagnostics.dtcTables ?? [];
  if (dtcTables.length > 0) {
    await prisma.ecuDtcCandidate.createMany({
      data: dtcTables.flatMap((dtc) =>
        dtc.regions.map((region) => ({
          fileId: corpusFile.id,
          offset: BigInt(region.offset),
          length: region.length,
          encoding: dtc.encoding,
          confidence: dtc.confidence,
          sampleCodes: toPrismaJson(dtc.sampleCodes),
          evidence: toPrismaJson({
            evidenceIds: dtc.evidenceIds,
          }),
        }))
      ),
    });
  }

  return {
    fileId: corpusFile.id,
    fullPath: input.fullPath,
    relativePath,
    directory: path.dirname(input.fullPath),
    fileName,
    extension,
    detectedKind,
    sizeBytes: BigInt(fileStat.size),
    sha256,
    entropy: fingerprint.entropy,
    filenameTokens: fingerprint.filenameTokens,
    strings: stringValues.slice(0, 80),
    byteSignatures: fingerprint.byteSignatures,
    labelNames,
    detections,
    architecture,
    supplier,
    probableOem,
    controllerType,
    fuelType,
    calibrationRegions: (fingerprint.intelligence?.calibration.probableRegions ?? []).map(
      (region) => ({
        offset: region.offset,
        length: region.length,
        confidence: region.confidence,
      })
    ),
    mapRegions: projectLabels.maps.slice(0, 100).map((map) => ({
      offset: map.address?.toString(),
      name: map.name,
      confidence: 0.5,
    })),
    softwareVersion: versionHints.softwareVersion,
    hardwareNumber: versionHints.hardwareNumber,
  };
}

async function indexUnreadableFile(input: {
  runId: string;
  rootPath: string;
  fullPath: string;
  error: string;
}) {
  const prisma = getPrismaClient();
  const fileStat = await stat(input.fullPath).catch(() => null);
  const extension = extensionOf(input.fullPath);
  const fileName = path.basename(input.fullPath);

  await prisma.ecuCorpusFile.upsert({
    where: { fullPath: input.fullPath },
    update: {
      runId: input.runId,
      rootPath: input.rootPath,
      relativePath: path.relative(input.rootPath, input.fullPath),
      fileName,
      extension,
      detectedKind: detectFileKind(extension),
      sizeBytes: BigInt(fileStat?.size ?? 0),
      sha256: fallbackUnreadableHash(input.fullPath),
      createdAtOnDisk: fileStat?.birthtime,
      modifiedAtOnDisk: fileStat?.mtime,
      indexedAt: new Date(),
      isReadable: false,
      readError: input.error,
    },
    create: {
      runId: input.runId,
      rootPath: input.rootPath,
      relativePath: path.relative(input.rootPath, input.fullPath),
      fullPath: input.fullPath,
      fileName,
      extension,
      detectedKind: detectFileKind(extension),
      sizeBytes: BigInt(fileStat?.size ?? 0),
      sha256: fallbackUnreadableHash(input.fullPath),
      createdAtOnDisk: fileStat?.birthtime,
      modifiedAtOnDisk: fileStat?.mtime,
      isReadable: false,
      readError: input.error,
    },
  });
}

async function createClusters(runId: string, features: FileFeature[]) {
  const prisma = getPrismaClient();
  const groups = new Map<string, FileFeature[]>();

  for (const feature of features) {
    const key = familyClusterKey(feature);
    groups.set(key, [...(groups.get(key) ?? []), feature]);
  }

  await prisma.ecuFileCluster.deleteMany({ where: { runId } });

  let unknownCount = 0;

  for (const [clusterKey, members] of groups.entries()) {
    const primary = members.find((member) => member.detections[0])?.detections[0];
    const clusterType = primary ? 'KNOWN_FAMILY' : 'UNKNOWN_FAMILY';
    const tokenSignatures = commonTokenSignatures(members);
    const byteSignatures = commonByteSignatures(members);
    const confidence = primary
      ? Math.max(...members.map((member) => member.detections[0]?.confidence ?? 0.4))
      : Math.min(0.35 + members.length / 100, 0.72);
    const cluster = await prisma.ecuFileCluster.create({
      data: {
        runId,
        clusterKey,
        clusterType,
        label: clusterLabel(clusterKey, members),
        familyKey: primary?.familyKey,
        confidence,
        memberCount: members.length,
        evidence: toPrismaJson({
          tokenSignatures,
          byteSignatures,
          sampleFiles: members.slice(0, 12).map((member) => member.relativePath),
        }),
        metadata: toPrismaJson({
          sizeBuckets: Array.from(new Set(members.map((member) => sizeBucket(member.sizeBytes)))),
          extensions: Array.from(new Set(members.map((member) => member.extension || '[none]'))),
        }),
      },
    });

    await prisma.ecuFileClusterMember.createMany({
      data: members.map((member) => ({
        clusterId: cluster.id,
        fileId: member.fileId,
        score: primary ? (member.detections[0]?.confidence ?? 0.5) : confidence,
        evidence: toPrismaJson({
          familyKey: member.detections[0]?.familyKey,
          tokens: member.filenameTokens.slice(0, 12),
        }),
      })),
    });

    if (!primary) {
      unknownCount += 1;
      await prisma.ecuUnknownFamily.create({
        data: {
          runId,
          clusterId: cluster.id,
          unknownKey: clusterKey,
          label: cluster.label,
          confidence,
          memberCount: members.length,
          evidence: toPrismaJson({
            reason: 'No known-family classifier reached confidence threshold.',
            tokenSignatures,
            byteSignatures,
          }),
          metadata: toPrismaJson({
            recommendedNextManualReviewStep:
              'Open representative files and inspect shared labels/strings before adding a new family classifier.',
          }),
        },
      });
    }

    const signatureRows = [
      ...tokenSignatures.map((signature) => ({
        signatureType: 'token',
        signatureKey: stableKey(signature.token),
        label: signature.token,
        confidence: Math.min(0.45 + signature.count / Math.max(members.length, 1), 0.9),
        evidence: toPrismaJson(signature),
      })),
      ...byteSignatures.map((signature) => ({
        signatureType: 'byte',
        signatureKey: stableKey(signature.key),
        label: signature.key,
        confidence: Math.min(0.4 + signature.count / Math.max(members.length, 1), 0.86),
        evidence: toPrismaJson(signature),
      })),
    ].slice(0, 40);

    if (signatureRows.length > 0) {
      await prisma.ecuLearnedSignature.createMany({
        data: signatureRows.map((signature) => ({
          runId,
          clusterId: cluster.id,
          ...signature,
          metadata: toPrismaJson({
            clusterKey,
            clusterType,
          }),
        })),
      });
    }
  }

  return {
    clusterCount: groups.size,
    unknownFamilyCount: unknownCount,
  };
}

async function detectOriModPairs(runId: string, features: FileFeature[], maxCandidates: number) {
  const prisma = getPrismaClient();
  const binaryFeatures = features.filter((feature) => binaryLikeExtensions.has(feature.extension));
  const bySize = new Map<string, FileFeature[]>();

  for (const feature of binaryFeatures) {
    const key = feature.sizeBytes.toString();
    bySize.set(key, [...(bySize.get(key) ?? []), feature]);
  }

  await prisma.ecuOriModPair.deleteMany({ where: { runId } });

  let created = 0;

  for (const group of bySize.values()) {
    if (created >= maxCandidates) break;

    const sorted = group
      .slice(0, 400)
      .sort((left, right) => left.directory.localeCompare(right.directory));

    for (let leftIndex = 0; leftIndex < sorted.length; leftIndex += 1) {
      if (created >= maxCandidates) break;

      for (let rightIndex = leftIndex + 1; rightIndex < sorted.length; rightIndex += 1) {
        if (created >= maxCandidates) break;

        const left = sorted[leftIndex];
        const right = sorted[rightIndex];

        if (left.sha256 === right.sha256) continue;

        const tokenScore = jaccard(left.filenameTokens, right.filenameTokens);
        const folderScore =
          left.directory === right.directory
            ? 0.28
            : path.dirname(left.directory) === path.dirname(right.directory)
              ? 0.12
              : 0;
        const leftState = stockModSignal(left);
        const rightState = stockModSignal(right);
        const stockModScore =
          leftState !== rightState && leftState !== 'unknown' && rightState !== 'unknown'
            ? 0.28
            : 0;
        const versionScore =
          left.softwareVersion && left.softwareVersion === right.softwareVersion ? 0.12 : 0;
        const confidence = Math.min(
          0.28 + tokenScore * 0.28 + folderScore + stockModScore + versionScore,
          0.95
        );

        if (confidence < 0.58) {
          continue;
        }

        const original = leftState === 'modified' && rightState === 'stock' ? right : left;
        const modified = original === left ? right : left;
        const diff = await diffFiles(original.fullPath, modified.fullPath, 8 * 1024 * 1024).catch(
          () => ({
            shaDistance: null,
            changedRegions: [],
          })
        );
        const changedMapCandidates = modified.calibrationRegions.filter((region) =>
          diff.changedRegions.some(
            (changed) =>
              changed.offset < region.offset + region.length &&
              region.offset < changed.offset + changed.length
          )
        );
        const density = diff.shaDistance ?? 0;
        const probableModificationType =
          density === 0
            ? 'metadata_or_format_variant'
            : density < 0.08
              ? 'calibration_variant'
              : density < 0.35
                ? 'software_and_calibration_variant'
                : 'different_binary_same_size';

        const pair = await prisma.ecuOriModPair.create({
          data: {
            runId,
            originalFileId: original.fileId,
            modifiedFileId: modified.fileId,
            confidence: Number(
              Math.min(confidence + (density > 0 && density < 0.35 ? 0.08 : 0)).toFixed(2)
            ),
            sizeBytes: original.sizeBytes,
            shaDistance: diff.shaDistance,
            changedRegions: toPrismaJson(diff.changedRegions),
            probableModificationType,
            changedMapCandidates: toPrismaJson(changedMapCandidates),
            evidence: toPrismaJson({
              tokenScore,
              folderScore,
              stockModScore,
              versionScore,
              leftState,
              rightState,
            }),
          },
        });

        await prisma.ecuModificationSignature.create({
          data: {
            runId,
            pairId: pair.id,
            signatureType: 'ori_mod_diff',
            signatureKey: stableKey(
              `${probableModificationType}:${sizeBucket(original.sizeBytes)}`
            ),
            confidence: pair.confidence,
            regions: toPrismaJson(diff.changedRegions.slice(0, 20)),
            evidence: toPrismaJson({
              originalFileId: original.fileId,
              modifiedFileId: modified.fileId,
              shaDistance: diff.shaDistance,
            }),
          },
        });

        created += 1;
      }
    }
  }

  return created;
}

export async function scanEcuCorpus(
  input: ScanEcuCorpusInput = {}
): Promise<EcuCorpusValidationSummary> {
  const prisma = getPrismaClient();
  const rootPath = path.resolve(input.rootPath ?? process.env.ECU_CORPUS_ROOT ?? defaultCorpusRoot);
  const run = await prisma.ecuAnalysisRun.create({
    data: {
      rootPath,
      status: 'RUNNING',
      metadata: toPrismaJson({
        maxAnalysisBytes: input.maxAnalysisBytes ?? maxAnalysisBytes(),
      }),
    },
  });
  const features: FileFeature[] = [];
  const failures: WalkFailure[] = [];
  let scanned = 0;

  try {
    for await (const fullPath of walkFiles(rootPath, failures)) {
      if (input.maxFiles && scanned >= input.maxFiles) {
        break;
      }

      scanned += 1;

      try {
        const feature = await indexCorpusFile({
          runId: run.id,
          rootPath,
          fullPath,
          maxAnalysisBytes: input.maxAnalysisBytes ?? maxAnalysisBytes(),
        });
        features.push(feature);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to index file.';
        failures.push({ fullPath, error: message });
        await indexUnreadableFile({
          runId: run.id,
          rootPath,
          fullPath,
          error: message,
        });
      }
    }

    const clusterSummary = await createClusters(run.id, features);
    const pairCount = await detectOriModPairs(
      run.id,
      features,
      input.maxPairCandidates ?? maxPairCandidates()
    );
    const breakdown = extensionBreakdown(features, failures);
    const duplicates = duplicateCount(features);
    const knownFamilyCount = features.filter(
      (feature) => feature.detections[0]?.confidence >= 0.62
    ).length;
    const topReusableSignatures = await prisma.ecuLearnedSignature.findMany({
      where: { runId: run.id },
      orderBy: [{ confidence: 'desc' }],
      take: 25,
      select: {
        signatureType: true,
        label: true,
        confidence: true,
        clusterId: true,
      },
    });
    const summary: EcuCorpusValidationSummary = {
      runId: run.id,
      rootPath,
      totalFilesIndexed: features.length,
      extensionBreakdown: breakdown,
      duplicateCount: duplicates,
      clusterCount: clusterSummary.clusterCount,
      knownFamilyCount,
      unknownFamilyCount: clusterSummary.unknownFamilyCount,
      oriModPairCandidates: pairCount,
      topReusableSignatures,
      failedUnreadableFiles: failures.slice(0, 500),
    };

    await prisma.ecuAnalysisRun.update({
      where: { id: run.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        totalFiles: scanned,
        indexedFiles: features.length,
        unreadableFiles: failures.length,
        duplicateFiles: duplicates,
        clusterCount: clusterSummary.clusterCount,
        knownFamilyCount,
        unknownFamilyCount: clusterSummary.unknownFamilyCount,
        oriModPairCount: pairCount,
        extensionBreakdown: toPrismaJson(breakdown),
        failedFiles: toPrismaJson(failures.slice(0, 1000)),
        summary: toPrismaJson(summary),
      },
    });

    return toJsonSafe(summary);
  } catch (error) {
    await prisma.ecuAnalysisRun.update({
      where: { id: run.id },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        totalFiles: scanned,
        indexedFiles: features.length,
        unreadableFiles: failures.length,
        failedFiles: toPrismaJson(failures.slice(0, 1000)),
        metadata: toPrismaJson({
          error: error instanceof Error ? error.message : 'Corpus scan failed.',
        }),
      },
    });
    throw error;
  }
}

export async function compareCorpusFiles(leftFileId: string, rightFileId: string) {
  const prisma = getPrismaClient();
  const [left, right] = await Promise.all([
    prisma.ecuCorpusFile.findUnique({ where: { id: leftFileId }, include: { fingerprint: true } }),
    prisma.ecuCorpusFile.findUnique({ where: { id: rightFileId }, include: { fingerprint: true } }),
  ]);

  if (!left || !right) {
    throw new Error('Both corpus files must exist.');
  }

  const sameSize = left.sizeBytes === right.sizeBytes;
  const sameHash = left.sha256 === right.sha256;
  const tokenScore = jaccard(
    (left.fingerprint?.filenameTokens as string[] | null) ?? [],
    (right.fingerprint?.filenameTokens as string[] | null) ?? []
  );
  const diff =
    sameSize && !sameHash ? await diffFiles(left.fullPath, right.fullPath, 8 * 1024 * 1024) : null;

  return toJsonSafe({
    left,
    right,
    sameSize,
    sameHash,
    tokenScore,
    shaDistance: diff?.shaDistance ?? (sameHash ? 0 : null),
    changedRegions: diff?.changedRegions ?? [],
    recommendedNextManualReviewStep: sameHash
      ? 'Files are byte-identical by SHA-256; review duplicates and project labels.'
      : sameSize
        ? 'Review changed regions against probable calibration/map labels; no patching is performed.'
        : 'Compare project labels and family signatures first because binary sizes differ.',
  });
}
