import type { EcuBinaryIntelligence } from '../bin-analysis/ecu-intelligence.js';

export interface CorpusClassifierSignals {
  fileName: string;
  extension: string;
  filenameTokens: string[];
  strings: string[];
  labelNames: string[];
  intelligence?: EcuBinaryIntelligence | null;
}

export interface CorpusFamilyDetection {
  familyKey: string;
  familyLabel: string;
  supplier?: string;
  oem?: string;
  controllerType?: 'ECU' | 'TCU' | 'UNKNOWN';
  fuelType?: 'PETROL' | 'DIESEL' | 'HYBRID' | 'UNKNOWN';
  architecture?: string;
  confidence: number;
  evidence: Array<{
    label: string;
    confidence: number;
    source: 'filename' | 'string' | 'label' | 'binary-intelligence';
    value?: string;
  }>;
}

interface FamilyRule {
  familyKey: string;
  familyLabel: string;
  supplier?: string;
  controllerType?: CorpusFamilyDetection['controllerType'];
  fuelType?: CorpusFamilyDetection['fuelType'];
  architecture?: string;
  patterns: RegExp[];
  confidence: number;
}

const familyRules: FamilyRule[] = [
  {
    familyKey: 'BOSCH_MED',
    familyLabel: 'Bosch MED/ME petrol ECU',
    supplier: 'Bosch',
    controllerType: 'ECU',
    fuelType: 'PETROL',
    architecture: 'tricore',
    patterns: [/\bMED\d+/i, /\bME\d+(?:\.\d+)*\b/i, /\bBOSCH\b/i],
    confidence: 0.76,
  },
  {
    familyKey: 'BOSCH_EDC',
    familyLabel: 'Bosch EDC diesel ECU',
    supplier: 'Bosch',
    controllerType: 'ECU',
    fuelType: 'DIESEL',
    architecture: 'tricore',
    patterns: [/\bEDC\d+/i, /\bBOSCH\b/i, /\b0281\d+/i],
    confidence: 0.78,
  },
  {
    familyKey: 'BOSCH_MG1_MD1',
    familyLabel: 'Bosch MG1/MD1 AURIX ECU',
    supplier: 'Bosch',
    controllerType: 'ECU',
    fuelType: 'UNKNOWN',
    architecture: 'tricore',
    patterns: [/\bMG1\w*\b/i, /\bMD1\w*\b/i, /\bAURIX\b/i, /\bBOSCH\b/i],
    confidence: 0.8,
  },
  {
    familyKey: 'CONTINENTAL_SID',
    familyLabel: 'Siemens/Continental SID ECU',
    supplier: 'Siemens/Continental',
    controllerType: 'ECU',
    fuelType: 'DIESEL',
    patterns: [/\bSID\d{2,4}\b/i, /\bSIEMENS\b/i, /\bCONTINENTAL\b/i, /\bVDO\b/i],
    confidence: 0.76,
  },
  {
    familyKey: 'CONTINENTAL_SIMOS',
    familyLabel: 'Siemens/Continental SIMOS ECU',
    supplier: 'Siemens/Continental',
    controllerType: 'ECU',
    fuelType: 'PETROL',
    patterns: [/\bSIMOS\d*(?:\.\d+)?\b/i, /\bSIEMENS\b/i, /\bCONTINENTAL\b/i, /\bVDO\b/i],
    confidence: 0.74,
  },
  {
    familyKey: 'CONTINENTAL_MSD_MSV',
    familyLabel: 'Siemens/Continental MSD/MSV ECU',
    supplier: 'Siemens/Continental',
    controllerType: 'ECU',
    fuelType: 'PETROL',
    patterns: [/\bMSD\d+(?:\.\d+)?\b/i, /\bMSV\d+(?:\.\d+)?\b/i, /\bSIEMENS\b/i],
    confidence: 0.72,
  },
  {
    familyKey: 'DELPHI_DELCO',
    familyLabel: 'Delphi/Delco ECU',
    supplier: 'Delphi/Delco',
    controllerType: 'ECU',
    fuelType: 'UNKNOWN',
    patterns: [/\bDELPHI\b/i, /\bDELCO\b/i, /\bACDELCO\b/i, /\bDCM\d/i, /\bMT\d{2,3}\b/i],
    confidence: 0.72,
  },
  {
    familyKey: 'DENSO',
    familyLabel: 'Denso ECU',
    supplier: 'Denso',
    controllerType: 'ECU',
    fuelType: 'UNKNOWN',
    patterns: [/\bDENSO\b/i, /\b76F\d+\b/i, /\bV850\b/i, /\bRH850\b/i],
    confidence: 0.72,
  },
  {
    familyKey: 'HITACHI',
    familyLabel: 'Hitachi/Renesas ECU',
    supplier: 'Hitachi',
    controllerType: 'ECU',
    fuelType: 'UNKNOWN',
    architecture: 'renesas-sh',
    patterns: [/\bHITACHI\b/i, /\bSH705\d\b/i, /\bRENESAS\b/i],
    confidence: 0.7,
  },
  {
    familyKey: 'VALEO',
    familyLabel: 'Valeo ECU',
    supplier: 'Valeo',
    controllerType: 'ECU',
    patterns: [/\bVALEO\b/i, /\bVD\d{2,3}\b/i, /\bV\d{4}\b/i],
    confidence: 0.65,
  },
  {
    familyKey: 'MAGNETI_MARELLI',
    familyLabel: 'Magneti Marelli ECU',
    supplier: 'Magneti Marelli',
    controllerType: 'ECU',
    patterns: [/\bMARELLI\b/i, /\bMAGNETI\b/i, /\bIAW\b/i, /\bMM\d/i],
    confidence: 0.68,
  },
  {
    familyKey: 'MITSUBISHI',
    familyLabel: 'Mitsubishi ECU',
    supplier: 'Mitsubishi',
    controllerType: 'ECU',
    patterns: [/\bMITSUBISHI\b/i, /\bMH8\d/i, /\bE6T\d/i],
    confidence: 0.64,
  },
  {
    familyKey: 'KEIHIN',
    familyLabel: 'Keihin ECU',
    supplier: 'Keihin',
    controllerType: 'ECU',
    patterns: [/\bKEIHIN\b/i, /\bHONDA\b/i],
    confidence: 0.62,
  },
  {
    familyKey: 'ZF_TCU',
    familyLabel: 'ZF transmission controller',
    supplier: 'ZF',
    controllerType: 'TCU',
    patterns: [/\bZF\b/i, /\b8HP\b/i, /\b6HP\b/i, /\b9HP\b/i, /\bTCU\b/i],
    confidence: 0.72,
  },
  {
    familyKey: 'VAG_DSG_DQ',
    familyLabel: 'VAG DSG/DQ transmission controller',
    supplier: 'VAG/BorgWarner',
    controllerType: 'TCU',
    patterns: [/\bDSG\b/i, /\bDQ(?:200|250|381|500)\b/i, /\b0AM\b/i, /\b02E\b/i],
    confidence: 0.76,
  },
  {
    familyKey: 'MERCEDES_VGS',
    familyLabel: 'Mercedes VGS transmission controller',
    supplier: 'Mercedes-Benz',
    controllerType: 'TCU',
    patterns: [/\bVGS\b/i, /\bEGS52\b/i, /\b722\.9\b/i, /\bMERCEDES\b/i],
    confidence: 0.72,
  },
  {
    familyKey: 'BMW_EGS',
    familyLabel: 'BMW EGS transmission controller',
    supplier: 'BMW',
    controllerType: 'TCU',
    patterns: [/\bEGS\b/i, /\bGS19\b/i, /\bGS20\b/i, /\bBMW\b/i],
    confidence: 0.7,
  },
  {
    familyKey: 'JATCO_NISSAN_TCM',
    familyLabel: 'Jatco/Nissan transmission controller',
    supplier: 'Jatco/Nissan',
    controllerType: 'TCU',
    patterns: [/\bJATCO\b/i, /\bJF0\d/i, /\bRE\dF/i, /\bNISSAN\b/i, /\bTCM\b/i],
    confidence: 0.68,
  },
];

function clampConfidence(value: number): number {
  return Number(Math.max(0, Math.min(0.99, value)).toFixed(2));
}

function combineScores(scores: number[]): number {
  return clampConfidence(scores.reduce((total, score) => total + score * (1 - total), 0));
}

function sourceMatches(pattern: RegExp, values: string[], source: 'filename' | 'string' | 'label') {
  return values
    .filter((value) => pattern.test(value))
    .slice(0, 8)
    .map((value) => ({
      label: `Matched /${pattern.source}/`,
      confidence: source === 'filename' ? 0.7 : source === 'label' ? 0.78 : 0.64,
      source,
      value,
    }));
}

export function inferProbableOem(values: string[]): string | undefined {
  const haystack = values.join('\n');
  const rules: Array<[RegExp, string]> = [
    [/\b(?:VAG|VW|AUDI|SEAT|SKODA|VOLKSWAGEN)\b/i, 'Volkswagen Group'],
    [/\bBMW\b/i, 'BMW Group'],
    [/\b(?:MERCEDES|DAIMLER|BENZ|AMG)\b/i, 'Mercedes-Benz'],
    [/\b(?:FORD|FOMOCO)\b/i, 'Ford'],
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

export function inferFuelType(values: string[]): CorpusFamilyDetection['fuelType'] {
  const haystack = values.join('\n');

  if (/\b(?:DIESEL|TDI|HDI|JTD|CDI|DCI|CRDI|EDC)\b/i.test(haystack)) return 'DIESEL';
  if (/\b(?:PETROL|GASOLINE|TFSI|TSI|FSI|MED|ME17|SIMOS|MSD|MSV)\b/i.test(haystack)) {
    return 'PETROL';
  }
  if (/\b(?:HYBRID|PHEV|HEV)\b/i.test(haystack)) return 'HYBRID';
  return 'UNKNOWN';
}

export function inferControllerType(values: string[]): CorpusFamilyDetection['controllerType'] {
  const haystack = values.join('\n');

  if (/\b(?:TCU|TCM|DSG|DQ\d+|VGS|EGS|ZF|JATCO|CVT|TRANSMISSION)\b/i.test(haystack)) {
    return 'TCU';
  }

  if (/\b(?:ECU|ECM|DME|DDE|PCM|EDC|MED|ME\d|MG1|MD1|SID|SIMOS)\b/i.test(haystack)) {
    return 'ECU';
  }

  return 'UNKNOWN';
}

export function extractVersionHints(values: string[]) {
  const haystack = values.join('\n');
  const softwareVersion =
    haystack.match(/\b(?:SW|SOFTWARE|CAL|CVN|10SW|1037)[\s:_-]*([A-Z0-9._-]{4,40})\b/i)?.[1] ??
    haystack.match(/\b\d{4,6}[A-Z0-9._-]{3,30}\b/i)?.[0];
  const hardwareNumber =
    haystack.match(/\b(?:HW|HARDWARE|ECU)[\s:_-]*([A-Z0-9._-]{4,40})\b/i)?.[1] ??
    haystack.match(
      /\b(?:0 281|0281|0 261|0261|A\d{3}\s?\d{3}\s?\d{2}\s?\d{2})[A-Z0-9 ]{0,24}\b/i
    )?.[0];

  return {
    softwareVersion,
    hardwareNumber,
  };
}

export function classifyKnownFamilies(signals: CorpusClassifierSignals): CorpusFamilyDetection[] {
  const filenameValues = [signals.fileName, signals.extension, ...signals.filenameTokens];
  const stringValues = signals.strings;
  const labelValues = signals.labelNames;
  const allValues = [...filenameValues, ...stringValues, ...labelValues];
  const intelligence = signals.intelligence;
  const intelligencePlatform = intelligence?.platforms[0];
  const intelligenceArchitecture = intelligence?.architecture[0];
  const probableOem = intelligence?.normalizedSummary.probableOem ?? inferProbableOem(allValues);
  const inferredFuel = inferFuelType(allValues);
  const inferredController = inferControllerType(allValues);

  const detections = familyRules.flatMap((rule) => {
    const evidence = rule.patterns.flatMap((pattern) => [
      ...sourceMatches(pattern, filenameValues, 'filename'),
      ...sourceMatches(pattern, stringValues, 'string'),
      ...sourceMatches(pattern, labelValues, 'label'),
    ]);
    const intelligenceEvidence =
      intelligencePlatform &&
      (intelligencePlatform.platform
        .toLowerCase()
        .includes(rule.familyKey.split('_')[1]?.toLowerCase() ?? '') ||
        intelligencePlatform.supplier === rule.supplier)
        ? [
            {
              label: `Binary intelligence platform: ${intelligencePlatform.family}`,
              confidence: intelligencePlatform.confidence,
              source: 'binary-intelligence' as const,
              value: intelligencePlatform.platform,
            },
          ]
        : [];
    const allEvidence = [...evidence, ...intelligenceEvidence];

    if (allEvidence.length === 0) {
      return [];
    }

    const confidence = combineScores([
      ...allEvidence.map((item) => item.confidence),
      rule.confidence,
      intelligenceArchitecture?.architecture === rule.architecture ? 0.2 : 0,
    ]);

    return [
      {
        familyKey: rule.familyKey,
        familyLabel: rule.familyLabel,
        supplier: rule.supplier,
        oem: probableOem,
        controllerType: rule.controllerType ?? inferredController,
        fuelType: rule.fuelType === 'UNKNOWN' ? inferredFuel : (rule.fuelType ?? inferredFuel),
        architecture: rule.architecture ?? intelligenceArchitecture?.architecture,
        confidence,
        evidence: allEvidence.slice(0, 16),
      },
    ];
  });

  return detections.sort((left, right) => right.confidence - left.confidence).slice(0, 5);
}
