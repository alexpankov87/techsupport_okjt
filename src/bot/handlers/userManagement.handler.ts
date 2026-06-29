import { BotContext } from '../middlewares/auth.middleware';
import { UserService } from '../../services/UserService';
import { UserRepository } from '../../repositories/UserRepository';
import { UserRole, IUser } from '../../models';
import { userManagementKeyboard } from '../keyboards/superAdmin.keyboard';
import { logger } from '../../utils/logger';

export const setupUserManagementHandlers = (bot: any): void => {
  bot.hears('👥 Пользователи', async (ctx: BotContext) => {
    const user = ctx.user!;
    if (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.ADMIN) return;

    try {
      const userRepo = new UserRepository();
      const userService = new UserService(userRepo);
      const users = await userService.getAllUsers();

      if (users.length === 0) {
        await ctx.reply('Нет пользователей');
        return;
      }

      for (const u of users) {
        const roleLabel: Record<string, string> = {
          super_admin: '👑 Супер-админ',
          admin: '👑 Админ',
          worker: '🔧 Работник',
          user: '👤 Пользователь',
        };

        await ctx.reply(
          `👤 ${u.firstName} ${u.lastName || ''}\n` +
            `🆔 ID: ${u.telegramId}\n` +
            `📌 Роль: ${roleLabel[u.role] || 'Не назначена'}\n` +
            `🟢 Активен: ${u.isActive ? 'Да' : 'Нет'}`,
          userManagementKeyboard(u),
        );
      }
    } catch (error) {
      logger.error('Error loading users:', error);
      await ctx.reply('❌ Ошибка при загрузке пользователей');
    }
  });

  bot.hears('👑 Админы', async (ctx: BotContext) => {
    const user = ctx.user!;
    if (user.role !== UserRole.SUPER_ADMIN) return;

    try {
      const userRepo = new UserRepository();
      const userService = new UserService(userRepo);
      const admins = await userService.getAdmins();

      if (admins.length === 0) {
        await ctx.reply('Нет админов');
        return;
      }

      let message = '👑 Список админов:\n\n';
      for (const admin of admins) {
        message += `• ${admin.firstName} ${admin.lastName || ''} (ID: ${admin.telegramId})\n`;
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
      const userRepo = new UserRepository();
      const userService = new UserService(userRepo);
      await userService.promoteToAdmin(userId, ctx.user!);
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
      const userRepo = new UserRepository();
      const userService = new UserService(userRepo);
      await userService.assignWorker(userId, ctx.user!);
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
      const userRepo = new UserRepository();
      const userService = new UserService(userRepo);
      await userService.deactivateUser(userId, ctx.user!);
      await ctx.reply('✅ Пользователь деактивирован');
    } catch (error: any) {
      await ctx.reply(`❌ Ошибка: ${error.message}`);
    }
  });
};