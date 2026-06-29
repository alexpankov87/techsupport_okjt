import { Scenes, Markup } from 'telegraf';
import { BotContext } from '../middlewares/auth.middleware';
import { TicketCategory, IUser } from '../../models';
import { categoryKeyboard, workersKeyboard } from '../keyboards';
import { logger } from '../../utils/logger';

interface CreateTicketState {
  title?: string;
  description?: string;
  category?: TicketCategory;
}

async function getUserId(ctx: BotContext): Promise<string> {
  const user = ctx.user;
  if (user && (user as any)._id) {
    return (user as any)._id.toString();
  }
  if (ctx.from) {
    const { UserModel } = await import('../../models');
    const dbUser = await UserModel.findOne({ telegramId: ctx.from.id });
    return dbUser?._id?.toString() || '';
  }
  return '';
}

export const createTicketScene = new Scenes.WizardScene<BotContext>(
  'create_ticket',

  async (ctx) => {
    await ctx.reply(
      '📝 Введите название заявки:\n\nНапример: "Замена картриджа в МФУ HP LaserJet"',
      Markup.keyboard([['❌ Отмена']]).resize(),
    );
    return ctx.wizard.next();
  },

  async (ctx) => {
    if (!ctx.message || !('text' in ctx.message)) {
      await ctx.reply('Пожалуйста, введите текст названия');
      return;
    }
    if (ctx.message.text === '❌ Отмена') {
      await ctx.reply('Создание заявки отменено', Markup.removeKeyboard());
      return ctx.scene.leave();
    }
    (ctx.scene.state as CreateTicketState).title = ctx.message.text;
    await ctx.reply('📄 Введите описание проблемы:\n\nУкажите детали: что не работает, где находится, срочность');
    return ctx.wizard.next();
  },

  async (ctx) => {
    if (!ctx.message || !('text' in ctx.message)) {
      await ctx.reply('Пожалуйста, введите текст описания');
      return;
    }
    (ctx.scene.state as CreateTicketState).description = ctx.message.text;
    await ctx.reply('📂 Выберите категорию заявки:', categoryKeyboard);
    return ctx.wizard.next();
  },

  async (ctx) => {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) {
      await ctx.reply('Пожалуйста, выберите категорию из списка');
      return;
    }
    const category = ctx.callbackQuery.data.replace('category_', '') as TicketCategory;
    (ctx.scene.state as CreateTicketState).category = category;
    await ctx.answerCbQuery(`Выбрано: ${category}`);

    try {
      const workers = await ctx.userService.getActiveWorkers();
      const userId = await getUserId(ctx);

      if (!userId) {
        await ctx.reply('❌ Ошибка: пользователь не найден');
        return ctx.scene.leave();
      }

      if (workers.length === 0) {
        await ctx.answerCbQuery('Нет сотрудников');
        await ctx.reply('Нет доступных сотрудников. Создаю заявку без назначения...');
        const state = ctx.scene.state as CreateTicketState;

        const ticket = await ctx.ticketService.createTicket(
          state.title!,
          state.description!,
          state.category!,
          userId,
          undefined,
        );
        await ctx.reply(
          `✅ Заявка #${ticket.number} создана!\n\n` +
            `📋 ${ticket.title}\n` +
            `📂 Категория: ${ticket.category}\n` +
            `📌 Статус: Новая\n\n` +
            `Назначьте исполнителя вручную.`,
          Markup.removeKeyboard(),
        );
        return ctx.scene.leave();
      }

      const workerList = workers.map((w: IUser) => ({
        id: (w as any)._id?.toString() || '',
        name: `${w.firstName} ${w.lastName || ''}`.trim(),
      }));
      await ctx.reply('👤 Выберите сотрудника:', workersKeyboard(workerList));
      return ctx.wizard.next();
    } catch (error) {
      logger.error('Error loading workers:', error);
      await ctx.reply('Ошибка при загрузке сотрудников');
      return ctx.scene.leave();
    }
  },

  async (ctx) => {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) {
      await ctx.reply('Пожалуйста, выберите сотрудника из списка');
      return;
    }
    const workerId = ctx.callbackQuery.data.replace('worker_', '');
    const state = ctx.scene.state as CreateTicketState;
    const userId = await getUserId(ctx);

    if (!userId) {
      await ctx.reply('❌ Ошибка: пользователь не найден');
      return ctx.scene.leave();
    }

    await ctx.answerCbQuery('Создаю заявку...');

    try {
      const ticket = await ctx.ticketService.createTicket(
        state.title!,
        state.description!,
        state.category!,
        userId,
        workerId,
      );

      await ctx.reply(
        `✅ Заявка #${ticket.number} создана!\n\n` +
          `📋 ${ticket.title}\n` +
          `📂 Категория: ${ticket.category}\n` +
          `📌 Статус: Назначена`,
        Markup.removeKeyboard(),
      );

      const worker = await ctx.userService.getUserById(workerId);
      if (worker) {
        await ctx.telegram.sendMessage(
          worker.telegramId,
          `🔔 Новая заявка #${ticket.number}\n\n` +
            `📋 ${ticket.title}\n` +
            `📄 ${ticket.description}\n` +
            `📂 Категория: ${ticket.category}\n\n` +
            `Примите заявку в работу!`,
        );
      }
    } catch (error: any) {
      await ctx.reply(`❌ Ошибка при создании заявки: ${error.message}`);
      logger.error('Error creating ticket:', error);
    }
    return ctx.scene.leave();
  },
);

createTicketScene.command('cancel', async (ctx) => {
  await ctx.reply('Создание заявки отменено', Markup.removeKeyboard());
  return ctx.scene.leave();
});