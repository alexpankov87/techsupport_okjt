import { BotContext } from '../middlewares/auth.middleware';
import { UserRole } from '../../models';
import { logger } from '../../utils/logger';
import { formatUserPhone } from '../utils/phone';

export const setupUserManagementHandlers = (bot: any): void => {
  bot.hears('👥 Пользователи', async (ctx: BotContext) => {
    const user = ctx.user!;
    if (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.ADMIN) return;
    await ctx.scene.enter('users');
  });

  bot.hears('👑 Админы', async (ctx: BotContext) => {
    const user = ctx.user!;
    if (user.role !== UserRole.SUPER_ADMIN) return;

    try {
      const admins = await ctx.userService.getAdmins();
      if (admins.length === 0) {
        await ctx.reply('Нет админов');
        return;
      }

      let message = '👑 Список админов:\n\n';
      for (const admin of admins) {
        let phone = admin.phone;
        if (!phone) phone = await ctx.ticketService.getLastPhoneForUser(admin._id.toString());
        message += `• ${admin.firstName} ${admin.lastName || ''} (ID: ${admin.telegramId}, 📞 ${formatUserPhone(phone)})\n`;
      }

      await ctx.reply(message);
    } catch (error) {
      logger.error('Error loading admins:', error);
      await ctx.reply('❌ Ошибка');
    }
  });

  bot.action(/^promote_admin_(.+)$/, async (ctx: BotContext) => {
    const match = ctx.callbackQuery && 'data' in ctx.callbackQuery
      ? ctx.callbackQuery.data.match(/^promote_admin_(.+)$/)
      : null;
    const userId = match ? match[1] : null;
    if (!userId) { await ctx.answerCbQuery('Ошибка'); return; }

    if (ctx.user!.role !== UserRole.SUPER_ADMIN) {
      await ctx.answerCbQuery('Только супер-админ может назначать админов');
      return;
    }

    await ctx.answerCbQuery('Назначаю...');
    try {
      await ctx.userService.promoteToAdmin(userId, ctx.user!);
      await ctx.reply('✅ Пользователь назначен админом');
    } catch (error: any) {
      await ctx.reply(`❌ Ошибка: ${error.message}`);
    }
  });

  bot.action(/^assign_worker_(.+)$/, async (ctx: BotContext) => {
    const match = ctx.callbackQuery && 'data' in ctx.callbackQuery
      ? ctx.callbackQuery.data.match(/^assign_worker_(.+)$/)
      : null;
    const userId = match ? match[1] : null;
    if (!userId) { await ctx.answerCbQuery('Ошибка'); return; }

    await ctx.answerCbQuery('Назначаю...');
    try {
      await ctx.userService.assignWorker(userId, ctx.user!);
      await ctx.reply('✅ Пользователь назначен работником');
    } catch (error: any) {
      await ctx.reply(`❌ Ошибка: ${error.message}`);
    }
  });

  bot.action(/^deactivate_(.+)$/, async (ctx: BotContext) => {
    const match = ctx.callbackQuery && 'data' in ctx.callbackQuery
      ? ctx.callbackQuery.data.match(/^deactivate_(.+)$/)
      : null;
    const userId = match ? match[1] : null;
    if (!userId) { await ctx.answerCbQuery('Ошибка'); return; }

    await ctx.answerCbQuery('Деактивирую...');
    try {
      await ctx.userService.deactivateUser(userId, ctx.user!);
      await ctx.reply('✅ Пользователь деактивирован');
    } catch (error: any) {
      await ctx.reply(`❌ Ошибка: ${error.message}`);
    }
  });
};
