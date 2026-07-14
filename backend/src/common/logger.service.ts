import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV !== 'production'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
});

export class LoggerService {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  debug(message: string, data?: any) {
    logger.debug({ context: this.context, ...data }, message);
  }

  info(message: string, data?: any) {
    logger.info({ context: this.context, ...data }, message);
  }

  warn(message: string, data?: any) {
    logger.warn({ context: this.context, ...data }, message);
  }

  error(message: string, error?: any, data?: any) {
    logger.error(
      {
        context: this.context,
        error: error?.message || error,
        stack: error?.stack,
        ...data,
      },
      message,
    );
  }

  // Specialized loggers for common patterns
  logTransaction(event: string, txHash: string, data?: any) {
    this.info(`Transaction: ${event}`, { txHash, ...data });
  }

  logDeal(event: string, dealId: number, data?: any) {
    this.info(`Deal: ${event}`, { dealId, ...data });
  }

  logKeeper(summary: string, stats: any) {
    this.info(`Keeper: ${summary}`, stats);
  }

  logBalance(wallet: string, balance: string, threshold?: string) {
    const isLow = threshold && parseFloat(balance) < parseFloat(threshold);
    if (isLow) {
      this.warn('Treasury balance LOW', { wallet, balance, threshold });
    } else {
      this.info('Treasury balance check', { wallet, balance });
    }
  }
}

export default logger;
