import type { PrintableStringMatch } from './fingerprint.js';

export interface ExtractedProjectLabel {
  labelType: string;
  name: string;
  address?: bigint;
  dataType?: string;
  unit?: string;
  factor?: number;
  offset?: number;
  source?: string;
  confidence: number;
  comments?: string;
  metadata?: Record<string, unknown>;
}

export interface ExtractedMapDefinition {
  name: string;
  address?: bigint;
  dataType?: string;
  axes?: Record<string, unknown>;
  factor?: number;
  offset?: number;
  unit?: string;
  comments?: string;
  metadata?: Record<string, unknown>;
}

export interface ProjectLabelExtraction {
  labels: ExtractedProjectLabel[];
  maps: ExtractedMapDefinition[];
  metadata: Record<string, unknown>;
}

function decodeBestEffort(buffer: Buffer): string {
  const utf8 = buffer.toString('utf8');
  const replacementRatio = (utf8.match(/\uFFFD/g) ?? []).length / Math.max(utf8.length, 1);
  return replacementRatio > 0.05 ? buffer.toString('latin1') : utf8;
}

function parseAddress(value: string | undefined): bigint | undefined {
  if (!value) {
    return undefined;
  }

  try {
    if (/^0x/i.test(value)) return BigInt(value);
    return BigInt(Number.parseInt(value, 16));
  } catch {
    return undefined;
  }
}

function uniqueByName<T extends { name: string; address?: bigint }>(items: T[]): T[] {
  const seen = new Set<string>();
  const output: T[] = [];

  for (const item of items) {
    const key = `${item.name}:${item.address?.toString() ?? ''}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(item);
  }

  return output;
}

function extractA2lLike(text: string, source: string) {
  const labels: ExtractedProjectLabel[] = [];
  const maps: ExtractedMapDefinition[] = [];
  const characteristicPattern =
    /\/begin\s+CHARACTERISTIC\s+([A-Za-z0-9_.$-]+)\s+"([^"]*)"\s+(0x[0-9A-Fa-f]+|[0-9A-Fa-f]{4,})\s+([A-Za-z0-9_.$-]+)/g;
  const measurementPattern =
    /\/begin\s+MEASUREMENT\s+([A-Za-z0-9_.$-]+)\s+"([^"]*)"\s+([A-Za-z0-9_.$-]+)/g;

  for (const match of text.matchAll(characteristicPattern)) {
    const name = match[1];
    const comments = match[2];
    const address = parseAddress(match[3]);
    const dataType = match[4];
    labels.push({
      labelType: 'CHARACTERISTIC',
      name,
      address,
      dataType,
      source,
      confidence: 0.9,
      comments,
    });
    maps.push({
      name,
      address,
      dataType,
      comments,
      metadata: { source },
    });
  }

  for (const match of text.matchAll(measurementPattern)) {
    labels.push({
      labelType: 'MEASUREMENT',
      name: match[1],
      dataType: match[3],
      source,
      confidence: 0.82,
      comments: match[2],
    });
  }

  return { labels, maps };
}

function extractXdf(text: string, source: string) {
  const labels: ExtractedProjectLabel[] = [];
  const maps: ExtractedMapDefinition[] = [];
  const tablePattern =
    /<(?:XDFTABLE|table)\b[^>]*>[\s\S]{0,3000}?<title>([^<]{2,180})<\/title>[\s\S]{0,2000}?(?:<address>(0x[0-9A-Fa-f]+|[0-9A-Fa-f]{4,})<\/address>)?/gi;

  for (const match of text.matchAll(tablePattern)) {
    const name = match[1].trim();
    const address = parseAddress(match[2]);
    labels.push({
      labelType: 'XDF_TABLE',
      name,
      address,
      source,
      confidence: 0.78,
    });
    maps.push({
      name,
      address,
      metadata: { source },
    });
  }

  return { labels, maps };
}

function extractCsvOrTextLabels(text: string, source: string) {
  const labels: ExtractedProjectLabel[] = [];
  const maps: ExtractedMapDefinition[] = [];
  const lines = text.split(/\r?\n/g).slice(0, 20000);
  const labelLinePattern =
    /\b([A-Za-z][A-Za-z0-9_.$ -]{2,100})\b[,;\t ]+(0x[0-9A-Fa-f]+|[0-9A-Fa-f]{5,8})\b(?:[,;\t ]+([A-Za-z0-9_./%]+))?/;

  for (const line of lines) {
    const match = labelLinePattern.exec(line);
    if (!match) {
      continue;
    }

    const name = match[1].trim();
    const address = parseAddress(match[2]);
    const unit = match[3];

    labels.push({
      labelType: 'TEXT_LABEL',
      name,
      address,
      unit,
      source,
      confidence: 0.52,
      comments: line.slice(0, 240),
    });
    maps.push({
      name,
      address,
      unit,
      comments: line.slice(0, 240),
      metadata: { source },
    });
  }

  return { labels, maps };
}

function extractStringLabels(strings: PrintableStringMatch[], source: string) {
  const labels: ExtractedProjectLabel[] = [];
  const mapNamePattern =
    /\b(?:KFM|KF|KOR|LDR|DRL|NMAX|TORQUE|BOOST|LAMBDA|IGN|DWELL|RAIL|SOI|START|PEDAL|MAF|MAP|DTC)[A-Za-z0-9_.$-]{2,80}\b/i;

  for (const item of strings) {
    if (!mapNamePattern.test(item.value)) {
      continue;
    }

    labels.push({
      labelType: 'STRING_LABEL',
      name: item.value.slice(0, 180),
      source,
      confidence: 0.46,
      metadata: {
        stringOffset: item.offset,
      },
    });
  }

  return labels;
}

export function extractProjectLabels(input: {
  buffer: Buffer;
  extension: string;
  strings: PrintableStringMatch[];
  fileName: string;
}): ProjectLabelExtraction {
  const extension = input.extension.toLowerCase();
  const text = decodeBestEffort(input.buffer);
  const source = extension || 'unknown';
  const a2lLike = ['.a2l', '.damos', '.dam'].includes(extension)
    ? extractA2lLike(text, source)
    : { labels: [], maps: [] };
  const xdf =
    extension === '.xdf' || extension === '.xml'
      ? extractXdf(text, source)
      : { labels: [], maps: [] };
  const textLabels = ['.csv', '.txt', '.kp', '.ols', '.xml'].includes(extension)
    ? extractCsvOrTextLabels(text, source)
    : { labels: [], maps: [] };
  const stringLabels = extractStringLabels(input.strings, source);
  const projectName =
    text.match(/\b(?:PROJECT|PROJECTNAME|WinOLS project)[\s:=_-]+([^\r\n]{3,180})/i)?.[1]?.trim() ??
    input.fileName.replace(/\.[^.]+$/, '');

  return {
    labels: uniqueByName([
      ...a2lLike.labels,
      ...xdf.labels,
      ...textLabels.labels,
      ...stringLabels,
    ]).slice(0, 2000),
    maps: uniqueByName([...a2lLike.maps, ...xdf.maps, ...textLabels.maps]).slice(0, 2000),
    metadata: {
      projectName,
      readableAsText: text.length > 0,
      extractedLabelCount:
        a2lLike.labels.length + xdf.labels.length + textLabels.labels.length + stringLabels.length,
      winolsHints: input.strings
        .filter((item) => /winols|ols|bosch|damos|a2l/i.test(item.value))
        .slice(0, 40),
    },
  };
}
