import 'dotenv/config';

import { disconnectPrismaClient } from '@caracal/db';

import { scanEcuCorpus } from '../src/lib/ecu-corpus/indexer.js';

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  const summary = await scanEcuCorpus({
    rootPath: argValue('root'),
    maxFiles: argValue('max-files') ? Number.parseInt(argValue('max-files') ?? '', 10) : undefined,
    maxAnalysisBytes: argValue('max-analysis-bytes')
      ? Number.parseInt(argValue('max-analysis-bytes') ?? '', 10)
      : undefined,
    maxPairCandidates: argValue('max-pair-candidates')
      ? Number.parseInt(argValue('max-pair-candidates') ?? '', 10)
      : undefined,
  });

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrismaClient();
  });
