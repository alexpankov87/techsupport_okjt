import { BotContext } from '../middlewares/auth.middleware';
import { TicketStatus, UserRole } from '../../models';
import { logger } from '../../utils/logger';
import mongoose from 'mongoose';

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

    const rawId = (user as any)._id ?? (user as any).id;
    const workerId = rawId instanceof mongoose.Types.ObjectId
      ? rawId.toHexString()
      : String(rawId ?? '');

    if (!workerId) {
      await ctx.answerCbQuery('Ошибка: не удалось определить ID');
      return;
    }

    await ctx.answerCbQuery('Обновляю...');

    try {
      const ticket = await ctx.ticketService.updateStatus(ticketId, newStatus, workerId);
      await ctx.reply(`Статус заявки #${ticket.number}: ${ticket.status}`);

      // Уведомление админам при взятии в работу
      if (newStatus === TicketStatus.IN_PROGRESS) {
        const { UserModel } = await import('../../models');
        const admins = await UserModel.find({ role: { $in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] }, isActive: true });
        for (const admin of admins) {
          await ctx.telegram.sendMessage(
            admin.telegramId,
            `🔔 Работник взял заявку в работу\n📋 #${ticket.number} - ${ticket.title}\n👤 ${user.firstName || 'Работник'}`,
          );
        }
      }

      // Уведомление админам при решении
      if (newStatus === TicketStatus.RESOLVED) {
        const { UserModel } = await import('../../models');
        const admins = await UserModel.find({ role: { $in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] }, isActive: true });
        for (const admin of admins) {
          await ctx.telegram.sendMessage(
            admin.telegramId,
            `✅ Заявка решена\n📋 #${ticket.number} - ${ticket.title}\n👤 ${user.firstName || 'Работник'}`,
          );
        }
      }
    } catch (error: any) {
      await ctx.reply(`${error.message}`);
      logger.error('Error in status callback:', error);
    }
  });
};