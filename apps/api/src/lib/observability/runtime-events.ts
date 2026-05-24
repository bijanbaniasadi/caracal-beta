import { logger } from '../logger.js';

export function installRuntimeProcessGuards(input: {
  service: string;
  workerId?: string;
  onFatal?: (error: Error) => Promise<void>;
}): void {
  process.on('unhandledRejection', (reason) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    logger.error(
      { err: error, service: input.service, workerId: input.workerId },
      'unhandled promise rejection'
    );
    void input.onFatal?.(error);
  });

  process.on('uncaughtException', (error) => {
    logger.fatal(
      { err: error, service: input.service, workerId: input.workerId },
      'uncaught exception'
    );
    void input.onFatal?.(error);
  });

  process.on('warning', (warning) => {
    logger.warn(
      {
        err: warning,
        service: input.service,
        workerId: input.workerId,
        warningName: warning.name,
      },
      'node process warning'
    );
  });
}
