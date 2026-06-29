import { Scenes, Markup } from 'telegraf';
import { BotContext } from '../middlewares/auth.middleware';
import { TicketCategory } from '../../models';
import { categoryKeyboard } from '../keyboards';
import { logger } from '../../utils/logger';
import { UserRole } from '../../models';

interface UserTicketState {
  title?: string;
  description?: string;
  category?: TicketCategory;
}

export const createUserTicketScene = new Scenes.WizardScene<BotContext>(
  'create_user_ticket',

  async (ctx) => {
    await ctx.reply(
      '📝 Опишите проблему кратко:\n\nНапример: "Не печатает принтер в 305 кабинете"',
      Markup.keyboard([['❌ Отмена']]).resize(),
    );
    return ctx.wizard.next();
  },

  async (ctx) => {
    if (!ctx.message || !('text' in ctx.message)) {
      await ctx.reply('Пожалуйста, введите текст');
      return;
    }

    if (ctx.message.text === '❌ Отмена') {
      await ctx.reply('Отменено', Markup.removeKeyboard());
      return ctx.scene.leave();
    }

    (ctx.scene.state as UserTicketState).title = ctx.message.text;

    await ctx.reply('📄 Опишите проблему подробнее:');
    return ctx.wizard.next();
  },

  async (ctx) => {
    if (!ctx.message || !('text' in ctx.message)) {
      await ctx.reply('Пожалуйста, введите текст');
      return;
    }

    (ctx.scene.state as UserTicketState).description = ctx.message.text;

    await ctx.reply('📂 Выберите категорию:', categoryKeyboard);
    return ctx.wizard.next();
  },

  async (ctx) => {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) {
      return;
    }

    const category = ctx.callbackQuery.data.replace('category_', '') as TicketCategory;
    const state = ctx.scene.state as UserTicketState;
    const user = ctx.user;

    if (!user || !user._id) {
      await ctx.reply('❌ Ошибка: пользователь не найден');
      return ctx.scene.leave();
    }

    const firstName = ctx.from?.first_name || user.firstName || 'Пользователь';

    await ctx.answerCbQuery('Создаю заявку...');

    try {
      const ticket = await ctx.ticketService.createTicket(
        state.title!,
        state.description!,
        category,
        user._id.toString(),
        undefined,
      );

      await ctx.reply(
        `✅ Заявка #${ticket.number} создана!\n\n` +
          `📋 ${ticket.title}\n` +
          `📂 ${ticket.category}\n` +
          `📌 Статус: Новая\n\n` +
          `Администратор назначит исполнителя.`,
        Markup.removeKeyboard(),
      );

      const { UserModel } = await import('../../models');
      const admins = await UserModel.find({ role: UserRole.ADMIN, isActive: true });
      for (const admin of admins) {
        await ctx.telegram.sendMessage(
          admin.telegramId,
          `🔔 Новая заявка #${ticket.number}\n\n` +
            `📋 ${ticket.title}\n` +
            `📄 ${ticket.description}\n` +
            `📂 ${ticket.category}\n` +
            `👤 От: ${firstName}\n\n` +
            `Назначьте исполнителя!`,
        );
      }
    } catch (error: any) {
      await ctx.reply(`❌ Ошибка: ${error.message}`);
      logger.error('Error creating user ticket:', error);
    }

    return ctx.scene.leave();
  },
);