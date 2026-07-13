import { Scenes, Markup } from 'telegraf';
import { BotContext } from '../middlewares/auth.middleware';
import { finishScene } from '../utils/scene';
import { canBrowseUsers, sendAllUsers, sendUserSearch } from '../utils/users';

const browseKeyboard = Markup.keyboard([
  ['📋 Показать всех', '🔙 Главное меню'],
]).resize();

export const usersScene = new Scenes.WizardScene<BotContext>(
  'users',

  async (ctx) => {
    if (!canBrowseUsers(ctx)) {
      await ctx.reply('Недостаточно прав');
      return finishScene(ctx);
    }
    await ctx.reply(
      '👥 Пользователи\n\n🔍 Введите имя, Telegram ID или телефон для поиска.\nИли нажмите «Показать всех».',
      browseKeyboard,
    );
    return ctx.wizard.next();
  },

  async (ctx) => {
    if (!ctx.message || !('text' in ctx.message)) return;
    const text = ctx.message.text.trim();
    if (/главное меню/i.test(text)) return finishScene(ctx);
    if (/показать всех/i.test(text)) {
      await sendAllUsers(ctx);
      return;
    }
    await sendUserSearch(ctx, text);
  },
);

usersScene.hears(/главное меню/i, async (ctx) => finishScene(ctx));
