import { BotContext } from './auth.middleware';
import { logger } from '../../utils/logger';

export const loggerMiddleware = async (ctx: BotContext, next: () => Promise<void>) => {
  const start = Date.now();

  try {
    await next();
    const ms = Date.now() - start;
    logger.info(`Update processed: ${ctx.updateType} | ${ms}ms`);
  } catch (error) {
    const ms = Date.now() - start;
    logger.error(`Update failed: ${ctx.updateType} | ${ms}ms | ${error}`);
    throw error;
  }
};