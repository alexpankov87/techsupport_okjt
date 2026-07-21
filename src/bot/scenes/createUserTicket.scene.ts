import { Scenes, Markup } from 'telegraf';
import { BotContext } from '../middlewares/auth.middleware';
import { TicketCategory, UserRole } from '../../models';
import { categoryKeyboard } from '../keyboards';
import { logger } from '../../utils/logger';
import { finishScene } from '../utils/scene';
import { acceptPhoneInput, promptMediaStep, resolveUserPhone } from '../utils/phone';
import { isValidPhone } from '../../utils/phone';
import { titleFromDescription } from '../../utils/title';
import { takeMediaStep } from '../utils/mediaStep';
import { parseCategoryCallback } from '../utils/ids';

interface UserTicketState {
  description?: string;
  phone?: string;
  media?: string[];
  category?: TicketCategory;
}

const STEP_MEDIA = 3;
const STEP_CATEGORY = 4;

export const createUserTicketScene = new Scenes.WizardScene<BotContext>(
  'create_user_ticket',

  async (ctx) => {
    await ctx.reply(
      '📄 Опишите проблему:\n\nНапример: "Не печатает принтер в 305 кабинете"',
      Markup.keyboard([['❌ Отмена']]).resize(),
    );
    return ctx.wizard.next();
  },

  async (ctx) => {
    if (!ctx.message || !('text' in ctx.message)) return;
    const state = ctx.scene.state as UserTicketState;
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
    (ctx.scene.state as UserTicketState).phone = phone;
    await promptMediaStep(ctx, phone);
    return ctx.wizard.next();
  },

  async (ctx) => {
    if (!ctx.message || !ctx.chat) return;
    const state = ctx.scene.state as UserTicketState;

    const goCategory = async (media: string[]) => {
      state.media = media;
      if (ctx.wizard.cursor !== STEP_MEDIA) return;
      await ctx.reply('📂 Выберите категорию:', categoryKeyboard);
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
      return;
    }
    const state = ctx.scene.state as UserTicketState;
    const user = ctx.user;

    if (!user || !(user as any)._id) {
      await ctx.reply('❌ Ошибка: пользователь не найден');
      return finishScene(ctx);
    }

    const firstName = ctx.from?.first_name || user.firstName || 'Пользователь';
    await ctx.answerCbQuery('Создаю заявку...');

    if (!isValidPhone(state.phone)) {
      const fallback = await resolveUserPhone(ctx);
      if (fallback) state.phone = fallback;
    }

    const title = titleFromDescription(state.description || '');

    try {
      const ticket = await ctx.ticketService.createTicket(title, state.description!, category, (user as any)._id.toString(), undefined, state.phone, state.media);
      await ctx.reply(`✅ Заявка #${ticket.number} создана!\n\n📋 ${ticket.title}\n📂 ${ticket.category}\n📞 ${state.phone || 'Не указан'}\n📌 Статус: Новая\n\nАдминистратор назначит исполнителя.`);

      const { UserModel } = await import('../../models');
      const admins = await UserModel.find({ role: { $in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] }, isActive: true });
      for (const admin of admins) {
        await ctx.telegram.sendMessage(admin.telegramId, `🔔 Новая заявка #${ticket.number}\n\n📋 ${ticket.title}\n📄 ${ticket.description}\n📞 ${state.phone || 'Не указан'}\n📂 ${ticket.category}\n👤 От: ${firstName}\n\nНазначьте исполнителя!`);
        if (state.media?.length) {
          for (const fileId of state.media) {
            try { await ctx.telegram.sendPhoto(admin.telegramId, fileId).catch(() => ctx.telegram.sendVideo(admin.telegramId, fileId).catch(() => ctx.telegram.sendVoice(admin.telegramId, fileId).catch(() => ctx.telegram.sendAudio(admin.telegramId, fileId).catch(() => ctx.telegram.sendDocument(admin.telegramId, fileId))))); } catch {}
          }
        }
      }
    } catch (error: any) {
      await ctx.reply(`❌ Ошибка: ${error.message}`);
      logger.error('Error creating user ticket:', error);
    }

    return finishScene(ctx);
  },
);

createUserTicketScene.hears(/Отмена/i, async (ctx) => finishScene(ctx));
