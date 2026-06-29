import { Scenes } from 'telegraf';
import { BotContext } from '../middlewares/auth.middleware';
import { TicketStatus } from '../../models';
import { ticketStatusKeyboard } from '../keyboards';
import { logger } from '../../utils/logger';

export const manageTicketScene = new Scenes.WizardScene<BotContext>(
  'manage_ticket',

  async (ctx) => {
    const ticketId = (ctx.scene.state as { ticketId: string }).ticketId;

    try {
      const ticket = await ctx.ticketService.getTicketById(ticketId);

      await ctx.reply(
        `📋 Заявка #${ticket.number}\n` +
          `📝 ${ticket.title}\n` +
          `📊 Текущий статус: ${ticket.status}\n\n` +
          `Выберите новый статус:`,
        ticketStatusKeyboard(ticketId, ticket.status as TicketStatus),
      );

      return ctx.wizard.next();
    } catch (error: any) {
      await ctx.reply(`❌ Ошибка: ${error.message}`);
      return ctx.scene.leave();
    }
  },

  async (ctx) => {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) {
      return;
    }

    const data = ctx.callbackQuery.data;
    const [action, ticketId, newStatus] = data.split('_');
    const user = ctx.user!;

    await ctx.answerCbQuery('Обновляю статус...');

    try {
      const ticket = await ctx.ticketService.updateStatus(
        ticketId,
        newStatus as TicketStatus,
        user._id.toString(),
      );

      await ctx.reply(
        `✅ Статус заявки #${ticket.number} обновлен\nНовый статус: ${ticket.status}`,
      );

      const adminUser = await ctx.userService.getUserById(ticket.createdBy.toString());
      if (adminUser) {
        await ctx.telegram.sendMessage(
          adminUser.telegramId,
          `🔄 Статус заявки #${ticket.number} изменен\n` +
            `📝 ${ticket.title}\n` +
            `👤 Исполнитель: ${user.firstName}\n` +
            `📊 Новый статус: ${ticket.status}`,
        );
      }
    } catch (error: any) {
      await ctx.reply(`❌ Ошибка: ${error.message}`);
      logger.error('Error updating ticket status:', error);
    }

    return ctx.scene.leave();
  },
);