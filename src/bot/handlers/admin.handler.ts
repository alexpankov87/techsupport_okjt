import { BotContext } from '../middlewares/auth.middleware';
import { logger } from '../../utils/logger';

export const setupAdminActions = (bot: any): void => {
  // Настройки админа
  bot.hears('⚙️ Настройки', async (ctx: BotContext) => {
    const { adminSettingsKeyboard } = await import('../keyboards/report.keyboard');
    await ctx.reply('⚙️ Настройки администратора:', adminSettingsKeyboard);
  });

  // Перезагрузка бота
  bot.action('admin_reboot', async (ctx: BotContext) => {
    await ctx.answerCbQuery('Перезагружаю бота...');

    await ctx.reply('🔄 Бот перезагружается...');

    logger.info('Admin initiated bot reboot');

    // Даем время на отправку сообщения
    setTimeout(() => {
      process.exit(0); // Процесс перезапустится через Docker/PM2
    }, 1000);
  });

  // Информация о системе
  bot.action('admin_sysinfo', async (ctx: BotContext) => {
    await ctx.answerCbQuery();

    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);

    const memoryUsage = process.memoryUsage();
    const memoryMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);

    const info = 
      `🖥 Информация о системе:\n\n` +
      `⏱ Аптайм: ${hours}ч ${minutes}м ${seconds}с\n` +
      `💾 Память: ${memoryMB} MB\n` +
      `🟢 Node.js: ${process.version}\n` +
      `📦 Платформа: ${process.platform}`;

    await ctx.reply(info);
  });
};