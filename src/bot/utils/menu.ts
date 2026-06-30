import { BotContext } from '../middlewares/auth.middleware';
import { UserRole } from '../../models';
import { superAdminMainKeyboard } from '../keyboards/superAdmin.keyboard';
import { workerMainKeyboard } from '../keyboards';
import { userMainKeyboard } from '../keyboards/user.keyboard';

export const showMainMenu = async (ctx: BotContext) => {
  const user = ctx.user;
  if (!user) {
    await ctx.reply('Главное меню', userMainKeyboard);
    return;
  }
  if (user.role === UserRole.SUPER_ADMIN) {
    await ctx.reply('Главное меню', superAdminMainKeyboard);
  } else if (user.role === UserRole.ADMIN) {
    await ctx.reply('Главное меню', {
      reply_markup: {
        keyboard: [
          ['📋 Новая заявка', '📊 Журнал заявок'],
          ['👥 Сотрудники', '📈 Статистика'],
          ['📊 Отчеты', '⚙️ Настройки'],
        ],
        resize_keyboard: true,
      },
    });
  } else if (user.role === UserRole.WORKER) {
    await ctx.reply('Главное меню', workerMainKeyboard);
  } else {
    await ctx.reply('Главное меню', userMainKeyboard);
  }
};