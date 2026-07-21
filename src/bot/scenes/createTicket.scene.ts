import { Scenes, Markup } from 'telegraf';
import { BotContext } from '../middlewares/auth.middleware';
import { TicketCategory, IUser, UserRole } from '../../models';
import { categoryKeyboard, workersKeyboard } from '../keyboards';
import { logger } from '../../utils/logger';
import { finishScene } from '../utils/scene';
import { acceptPhoneInput, promptMediaStep, resolveUserPhone } from '../utils/phone';
import { isValidPhone } from '../../utils/phone';
import { assigneeLabel } from '../utils/assignees';
import { titleFromDescription } from '../../utils/title';
import { takeMediaStep } from '../utils/mediaStep';
import { parseCategoryCallback, parseObjectId, parseWorkerCallback } from '../utils/ids';

interface CreateTicketState {
  description?: string;
  phone?: string;
  media?: string[];
  category?: TicketCategory;
}

/** Wizard step indices in create_ticket (must match handler order). */
const STEP_MEDIA = 3;
const STEP_CATEGORY = 4;

async function getUserId(ctx: BotContext): Promise<string> {
  const user = ctx.user;
  if (user && (user as any)._id) return parseObjectId(String((user as any)._id)) || '';
  if (ctx.from) {
    const { UserModel } = await import('../../models');
    const dbUser = await UserModel.findOne({ telegramId: ctx.from.id });
    return parseObjectId(dbUser?._id?.toString()) || '';
  }
  return '';
}

function ticketTitle(state: CreateTicketState): string {
  return titleFromDescription(state.description || '');
}

export const createTicketScene = new Scenes.WizardScene<BotContext>(
  'create_ticket',

  async (ctx) => {
    await ctx.reply(
      '📄 Опишите проблему:\n\nУкажите детали: что не работает, где находится, срочность',
      Markup.keyboard([['❌ Отмена']]).resize(),
    );
    return ctx.wizard.next();
  },

  async (ctx) => {
    if (!ctx.message || !('text' in ctx.message)) return;
    const state = ctx.scene.state as CreateTicketState;
    state.description = ctx.message.text.trim();
    if (!state.description) {
      await ctx.reply('Опишите проблему текстом:');
      return;
    }

    const phone = await resolveUserPhone(ctx);
    if (phone) {
      state.phone = phone;
      await promptMediaStep(ctx, phone);
      return ctx.wizard.selectStep(3);
    }

    await ctx.reply('📞 Введите номер телефона для связи:');
    return ctx.wizard.next();
  },

  async (ctx) => {
    if (!ctx.message || !('text' in ctx.message)) return;
    const phone = await acceptPhoneInput(ctx, ctx.message.text);
    if (!phone) return;
    (ctx.scene.state as CreateTicketState).phone = phone;
    await promptMediaStep(ctx, phone);
    return ctx.wizard.next();
  },

  async (ctx) => {
    if (!ctx.message || !ctx.chat) return;
    const state = ctx.scene.state as CreateTicketState;

    const goCategory = async (media: string[]) => {
      state.media = media;
      // Album flush is async — don't advance if user already left the media step
      if (ctx.wizard.cursor !== STEP_MEDIA) return;
      await ctx.reply('📂 Выберите категорию заявки:', categoryKeyboard);
      return ctx.wizard.selectStep(STEP_CATEGORY);
    };

    const outcome = takeMediaStep(ctx.chat.id, ctx.message as any, (media) => {
      void goCategory(media);
    });
    if (outcome.kind === 'advance') return goCategory(outcome.media);
  },

  async (ctx) => {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) {
      await ctx.reply('Пожалуйста, выберите категорию из списка или нажмите ❌ Отмена');
      return;
    }
    const category = parseCategoryCallback(ctx.callbackQuery.data);
    if (!category) {
      await ctx.answerCbQuery();
      return; // ignore stale worker_/other buttons on this step
    }
    const state = ctx.scene.state as CreateTicketState;
    state.category = category;
    await ctx.answerCbQuery(`Выбрано: ${category}`);

    try {
      const workers = await ctx.userService.getAssignableUsers(ctx.user);
      const userId = await getUserId(ctx);
      if (!userId) { await ctx.reply('❌ Пользователь не найден'); return finishScene(ctx); }
      const title = ticketTitle(state);

      if (workers.length === 0) {
        await ctx.answerCbQuery('Нет сотрудников');
        await ctx.reply('Нет доступных сотрудников. Создаю заявку без назначения...');
        const ticket = await ctx.ticketService.createTicket(
          title, state.description!, state.category!, userId, undefined,
          state.phone, state.media,
        );
        await ctx.reply(
          `✅ Заявка #${ticket.number} создана!\n\n📋 ${ticket.title}\n📂 ${ticket.category}\n📞 ${state.phone || 'Не указан'}\n📌 Статус: Новая\n\nНазначьте исполнителя вручную.`,
        );

        const { UserModel } = await import('../../models');
        const admins = await UserModel.find({ role: { $in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] }, isActive: true });
        for (const admin of admins) {
          await ctx.telegram.sendMessage(
            admin.telegramId,
            `🔔 Новая заявка #${ticket.number}!\n📋 ${ticket.title}\n👤 От: ${ctx.user?.firstName || 'Пользователь'}\n📂 ${ticket.category}\n\nНазначьте исполнителя!`,
          );
        }
        return finishScene(ctx);
      }

      const actorId = (ctx.user as any)?._id?.toString();
      const workerList = workers
        .map((w: IUser) => ({
          id: parseObjectId(String((w as any)._id)) || '',
          name: assigneeLabel(w, actorId),
        }))
        .filter((w) => w.id);
      if (workerList.length === 0) {
        await ctx.reply('Нет сотрудников с корректным id');
        return finishScene(ctx);
      }
      await ctx.reply('👤 Выберите сотрудника:', workersKeyboard(workerList));
      return ctx.wizard.next();
    } catch (error) {
      logger.error('Error:', error);
      await ctx.reply('Ошибка');
      return finishScene(ctx);
    }
  },

  async (ctx) => {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;
    const workerId = parseWorkerCallback(ctx.callbackQuery.data);
    if (!workerId) {
      await ctx.answerCbQuery();
      await ctx.reply('Выберите сотрудника из списка ниже (не категорию).');
      return;
    }
    const state = ctx.scene.state as CreateTicketState;
    const userId = await getUserId(ctx);
    if (!userId) { await ctx.reply('❌ Ошибка'); return finishScene(ctx); }

    await ctx.answerCbQuery('Создаю заявку...');
    try {
      const ticket = await ctx.ticketService.createTicket(
        ticketTitle(state), state.description!, state.category!, userId, workerId,
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
    return finishScene(ctx);
  },
);

createTicketScene.hears(/Отмена/i, async (ctx) => finishScene(ctx));
