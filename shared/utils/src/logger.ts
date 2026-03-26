export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

const currentLevel: LogLevel = (process.env['LOG_LEVEL'] as LogLevel) ?? 'info';

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[currentLevel];
}

function format(level: LogLevel, context: string, message: string, data?: unknown): string {
  const ts = new Date().toISOString();
  const base = `[${ts}] [${level.toUpperCase()}] [${context}] ${message}`;
  return data !== undefined ? `${base} ${JSON.stringify(data)}` : base;
}

export function createLogger(context: string) {
  return {
    debug: (msg: string, data?: unknown) => {
      if (shouldLog('debug')) process.stderr.write(format('debug', context, msg, data) + '\n');
    },
    info: (msg: string, data?: unknown) => {
      if (shouldLog('info')) process.stderr.write(format('info', context, msg, data) + '\n');
    },
    warn: (msg: string, data?: unknown) => {
      if (shouldLog('warn')) process.stderr.write(format('warn', context, msg, data) + '\n');
    },
    error: (msg: string, data?: unknown) => {
      if (shouldLog('error')) process.stderr.write(format('error', context, msg, data) + '\n');
    },
  };
}
