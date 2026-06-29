import { BotContext } from '../middlewares/auth.middleware';
import { TicketStatus } from '../../models';
import { logger } from '../../utils/logger';

export const setupCallbackHandlers = (bot: any): void => {
  // Управление заявкой
  bot.action(/^manage_(.+)$/, async (ctx: BotContext) => {
    const match = ctx.callbackQuery && 'data' in ctx.callbackQuery
      ? ctx.callbackQuery.data.match(/^manage_(.+)$/)
      : null;
    const ticketId = match ? match[1] : null;

    if (!ticketId) {
      await ctx.answerCbQuery('Ошибка');
      return;
    }

    await ctx.answerCbQuery();
    await ctx.scene.enter('manage_ticket', { ticketId });
  });

  // Переназначение
  bot.action(/^reassign_(.+)$/, async (ctx: BotContext) => {
    await ctx.answerCbQuery('Функция в разработке');
  });

  // Обработка статусов
  bot.action(/^status_(.+)_(.+)$/, async (ctx: BotContext) => {
    const match = ctx.callbackQuery && 'data' in ctx.callbackQuery
      ? ctx.callbackQuery.data.match(/^status_(.+)_(.+)$/)
      : null;
    const ticketId = match ? match[1] : null;
    const newStatus = match ? match[2] : null;
    const user = ctx.user!;

    if (!ticketId || !newStatus) {
      await ctx.answerCbQuery('Ошибка');
      return;
    }

    await ctx.answerCbQuery('Обновляю...');

    try {
      const ticket = await ctx.ticketService.updateStatus(
        ticketId,
        newStatus as TicketStatus,
        user._id.toString(),
      );

      await ctx.reply(`✅ Статус заявки #${ticket.number}: ${ticket.status}`);
    } catch (error: any) {
      await ctx.reply(`❌ Ошибка: ${error.message}`);
      logger.error('Error in status callback:', error);
    }
  });
};