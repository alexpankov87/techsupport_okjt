import { Scenes, Markup } from 'telegraf';
import { BotContext } from '../middlewares/auth.middleware';
import { TicketCategory, IUser, UserRole } from '../../models';
import { categoryKeyboard, workersKeyboard } from '../keyboards';
import { logger } from '../../utils/logger';

interface CreateTicketState {
  title?: string;
  description?: string;
  phone?: string;
  media?: string[];
  category?: TicketCategory;
}

async function getUserId(ctx: BotContext): Promise<string> {
  const user = ctx.user;
  if (user && (user as any)._id) return (user as any)._id.toString();
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
    if (!ctx.message || !('text' in ctx.message)) return;
    (ctx.scene.state as CreateTicketState).title = ctx.message.text;
    await ctx.reply('📄 Введите описание проблемы:\n\nУкажите детали: что не работает, где находится, срочность');
    return ctx.wizard.next();
  },

  async (ctx) => {
    if (!ctx.message || !('text' in ctx.message)) return;
    (ctx.scene.state as CreateTicketState).description = ctx.message.text;
    await ctx.reply('📞 Введите номер телефона для связи:');
    return ctx.wizard.next();
  },

  async (ctx) => {
    if (!ctx.message || !('text' in ctx.message)) return;
    (ctx.scene.state as CreateTicketState).phone = ctx.message.text;
    await ctx.reply(
      '📎 Прикрепите фото, видео, голосовое, аудио или документ (или нажмите "Пропустить"):',
      Markup.keyboard([['⏭ Пропустить', '❌ Отмена']]).resize(),
    );
    return ctx.wizard.next();
  },

  async (ctx) => {
    const state = ctx.scene.state as CreateTicketState;

    if (ctx.message && 'photo' in ctx.message) {
      state.media = [ctx.message.photo[ctx.message.photo.length - 1].file_id];
    } else if (ctx.message && 'video' in ctx.message) {
      state.media = [ctx.message.video.file_id];
    } else if (ctx.message && 'voice' in ctx.message) {
      state.media = [ctx.message.voice.file_id];
    } else if (ctx.message && 'audio' in ctx.message) {
      state.media = [ctx.message.audio.file_id];
    } else if (ctx.message && 'document' in ctx.message) {
      state.media = [ctx.message.document.file_id];
    } else if (ctx.message && 'text' in ctx.message) {
      state.media = [];
    }

    await ctx.reply('📂 Выберите категорию заявки:', categoryKeyboard);
    return ctx.wizard.next();
  },

  async (ctx) => {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) {
      await ctx.reply('Пожалуйста, выберите категорию из списка или нажмите ❌ Отмена');
      return;
    }
    const category = ctx.callbackQuery.data.replace('category_', '') as TicketCategory;
    const state = ctx.scene.state as CreateTicketState;
    state.category = category;
    await ctx.answerCbQuery(`Выбрано: ${category}`);

    try {
      const workers = await ctx.userService.getActiveWorkers();
      const userId = await getUserId(ctx);
      if (!userId) { await ctx.reply('❌ Пользователь не найден'); return ctx.scene.leave(); }

      if (workers.length === 0) {
        await ctx.answerCbQuery('Нет сотрудников');
        await ctx.reply('Нет доступных сотрудников. Создаю заявку без назначения...');
        const ticket = await ctx.ticketService.createTicket(
          state.title!, state.description!, state.category!, userId, undefined,
          state.phone, state.media,
        );
        await ctx.reply(
          `✅ Заявка #${ticket.number} создана!\n\n📋 ${ticket.title}\n📂 ${ticket.category}\n📞 ${state.phone || 'Не указан'}\n📌 Статус: Новая\n\nНазначьте исполнителя вручную.`,
        );

        // Уведомление админам
        const { UserModel } = await import('../../models');
        const admins = await UserModel.find({ role: { $in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] }, isActive: true });
        for (const admin of admins) {
          await ctx.telegram.sendMessage(
            admin.telegramId,
            `🔔 Новая заявка #${ticket.number}!\n📋 ${ticket.title}\n👤 От: ${ctx.user?.firstName || 'Пользователь'}\n📂 ${ticket.category}\n\nНазначьте исполнителя!`,
          );
        }
        return ctx.scene.leave();
      }

      const workerList = workers.map((w: IUser) => ({
        id: (w as any)._id?.toString() || '',
        name: `${w.firstName} ${(w as any).lastName || ''}`.trim(),
      }));
      await ctx.reply('👤 Выберите сотрудника:', workersKeyboard(workerList));
      return ctx.wizard.next();
    } catch (error) {
      logger.error('Error:', error);
      await ctx.reply('Ошибка');
      return ctx.scene.leave();
    }
  },

  async (ctx) => {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;
    const workerId = ctx.callbackQuery.data.replace('worker_', '');
    const state = ctx.scene.state as CreateTicketState;
    const userId = await getUserId(ctx);
    if (!userId) { await ctx.reply('❌ Ошибка'); return ctx.scene.leave(); }

    await ctx.answerCbQuery('Создаю заявку...');
    try {
      const ticket = await ctx.ticketService.createTicket(
        state.title!, state.description!, state.category!, userId, workerId,
        state.phone, state.media,
      );
      await ctx.reply(
        `✅ Заявка #${ticket.number} создана!\n\n📋 ${ticket.title}\n📂 ${ticket.category}\n📞 ${state.phone || 'Не указан'}\n📌 Статус: Назначена`,
      );

      const worker = await ctx.userService.getUserById(workerId);
      if (worker) {
        await ctx.telegram.sendMessage(
          worker.telegramId,
          `🔔 Новая заявка #${ticket.number}\n\n📋 ${ticket.title}\n📄 ${ticket.description}\n📞 ${state.phone || 'Не указан'}\n📂 ${ticket.category}\n\nПримите заявку в работу!`,
        );
        if (state.media?.length) {
          for (const fileId of state.media) {
            try {
              await ctx.telegram.sendPhoto(worker.telegramId, fileId).catch(() =>
                ctx.telegram.sendVideo(worker.telegramId, fileId).catch(() =>
                  ctx.telegram.sendVoice(worker.telegramId, fileId).catch(() =>
                    ctx.telegram.sendAudio(worker.telegramId, fileId).catch(() =>
                      ctx.telegram.sendDocument(worker.telegramId, fileId)
                    )
                  )
                )
              );
            } catch {}
          }
        }
      }

      // Уведомление админам
      const { UserModel } = await import('../../models');
      const admins = await UserModel.find({ role: { $in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] }, isActive: true });
      for (const admin of admins) {
        await ctx.telegram.sendMessage(
          admin.telegramId,
          `🔔 Новая заявка #${ticket.number}!\n📋 ${ticket.title}\n👤 От: ${ctx.user?.firstName || 'Пользователь'}\n👤 Исполнитель: ${worker?.firstName || 'Не назначен'}\n📂 ${ticket.category}\n\nЗаявка создана и назначена.`,
        );
      }
    } catch (error: any) {
      await ctx.reply(`❌ Ошибка: ${error.message}`);
      logger.error('Error creating ticket:', error);
    }
    return ctx.scene.leave();
  },
);

createTicketScene.hears(/Отмена/i, async (ctx) => {
  await ctx.scene.leave();
  if (ctx.backToMainMenu) {
    await ctx.backToMainMenu(ctx);
  }
});