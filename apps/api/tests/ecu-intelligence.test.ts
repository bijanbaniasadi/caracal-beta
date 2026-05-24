import { describe, expect, it } from 'vitest';

import { analyzeEcuBinary } from '../src/lib/bin-analysis/ecu-intelligence.js';
import { classifyKnownFamilies } from '../src/lib/ecu-corpus/classifiers.js';

function writeAscii(buffer: Buffer, offset: number, value: string) {
  buffer.write(value, offset, 'ascii');
}

function writeTricoreVectors(buffer: Buffer) {
  for (let index = 0; index < 16; index += 1) {
    buffer.writeUInt32BE(0x80001000 + index * 0x40, index * 4);
  }
}

function writeCalibrationRamp(buffer: Buffer, offset: number) {
  for (let index = 0; index < 4096; index += 2) {
    buffer.writeUInt16BE((index / 2) % 1024, offset + index);
  }
}

function syntheticSample(signature: string, options: { tricore?: boolean } = {}) {
  const buffer = Buffer.alloc(128 * 1024, 0xff);

  if (options.tricore) {
    writeTricoreVectors(buffer);
  }

  writeAscii(buffer, 0x2000, signature);
  writeAscii(buffer, 0x2400, 'P0100 P0200 P0301 CVN CRC CHECKSUM');
  writeCalibrationRamp(buffer, 0x10000);

  return buffer;
}

describe('ECU binary intelligence heuristics', () => {
  it.each([
    ['Bosch MED17', 'BOSCH MED17.5 TC1797 VAG 0261 CVN', 'Bosch', 'MED17', 'tricore'],
    ['EDC17', 'BOSCH EDC17CP52 TC1797 0281031352 DIESEL CVN', 'Bosch', 'EDC17', 'tricore'],
    ['MG1', 'BOSCH MG1CS011 AURIX TC277 BMW CVN', 'Bosch', 'MG1/MD1', 'tricore'],
    [
      'SID',
      'SIEMENS CONTINENTAL SID807 MPC564 POWERPC CRC',
      'Siemens/Continental',
      'SID',
      'powerpc',
    ],
    ['SH7058', 'HITACHI SH7058 RENESAS NISSAN CHECKSUM', 'Hitachi', 'SH705x', 'renesas-sh'],
    ['Denso', 'DENSO TOYOTA 76F V850 CHECKSUM', 'Denso', 'Denso', 'v850'],
  ])('detects %s synthetic sample', (_name, signature, supplier, platform, architecture) => {
    const analysis = analyzeEcuBinary(
      syntheticSample(signature, { tricore: architecture === 'tricore' }),
      {
        fileName: `${signature}.bin`,
        productContext: signature,
      }
    );

    expect(analysis.readOnly).toBe(true);
    expect(analysis.platforms[0]?.supplier).toBe(supplier);
    expect(analysis.platforms.some((item) => item.platform === platform)).toBe(true);
    expect(analysis.architecture.some((item) => item.architecture === architecture)).toBe(true);
    expect(analysis.calibration.confidence).toBeGreaterThan(0);
    expect(analysis.diagnostics.dtcTables.length).toBeGreaterThan(0);
    expect(analysis.evidence.length).toBeGreaterThan(0);
  });
});

describe('open ECU corpus family classifiers', () => {
  it('keeps unknown files indexable when no known family matches', () => {
    const detections = classifyKnownFamilies({
      fileName: 'mystery-controller-project-x.bin',
      extension: '.bin',
      filenameTokens: ['MYSTERY', 'CONTROLLER', 'PROJECT'],
      strings: ['CUSTOM BOOT 1234'],
      labelNames: ['TORQUE_LIMITER_MAIN'],
      intelligence: null,
    });

    expect(detections).toEqual([]);
  });

  it('classifies initial known ECU and TCU families without making them mandatory', () => {
    const detections = classifyKnownFamilies({
      fileName: 'VW_DQ250_DSG_original.bin',
      extension: '.bin',
      filenameTokens: ['VW', 'DQ250', 'DSG', 'ORIGINAL'],
      strings: ['VAG DSG DQ250 TCU'],
      labelNames: [],
      intelligence: null,
    });

    expect(detections[0]?.familyKey).toBe('VAG_DSG_DQ');
    expect(detections[0]?.controllerType).toBe('TCU');
  });
});
