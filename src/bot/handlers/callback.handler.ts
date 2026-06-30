import { BotContext } from '../middlewares/auth.middleware';
import { TicketStatus } from '../../models';
import { logger } from '../../utils/logger';

export const setupCallbackHandlers = (bot: any): void => {
  bot.action(/^manage_(.+)$/, async (ctx: BotContext) => {
    const match = ctx.callbackQuery && 'data' in ctx.callbackQuery
      ? ctx.callbackQuery.data.match(/^manage_(.+)$/)
      : null;
    const ticketId = match ? match[1] : null;
    if (!ticketId) { await ctx.answerCbQuery('Ошибка'); return; }
    await ctx.answerCbQuery();
    await ctx.scene.enter('manage_ticket', { ticketId });
  });

  bot.action(/^reassign_(.+)$/, async (ctx: BotContext) => {
    await ctx.answerCbQuery('Функция в разработке');
  });

  bot.action(/^status_(.+?)_(in_progress|resolved|unresolved|completed|cancelled)$/, async (ctx: BotContext) => {
    const match = ctx.callbackQuery && 'data' in ctx.callbackQuery
      ? ctx.callbackQuery.data.match(/^status_(.+?)_(in_progress|resolved|unresolved|completed|cancelled)$/)
      : null;

    if (!match) { await ctx.answerCbQuery('Ошибка'); return; }

    const ticketId = match[1];
    const newStatus = match[2] as TicketStatus;
    const user = ctx.user!;
    const workerId = (user as any)._id?.toString() || '';

    if (!workerId) {
      await ctx.answerCbQuery('Ошибка: пользователь не найден');
      return;
    }

    await ctx.answerCbQuery('Обновляю...');

    try {
      const ticket = await ctx.ticketService.updateStatus(ticketId, newStatus, workerId);
      await ctx.reply(`✅ Статус заявки #${ticket.number}: ${ticket.status}`);
    } catch (error: any) {
      await ctx.reply(`❌ ${error.message}`);
      logger.error('Error in status callback:', error);
    }
  });
};