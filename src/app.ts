import { config, validateConfig } from './config';
import { connectDatabase } from './config/database';
import { createBot } from './bot/bot';
import { TicketRepository } from './repositories';
import { TicketService } from './services';
import { logger } from './utils/logger';

const bootstrap = async (): Promise<void> => {
  try {
    logger.info('Запуск techsupport_okjt...');
    validateConfig();
    await connectDatabase(config.database.uri);

    const ticketRepo = new TicketRepository();
    const ticketSvc = new TicketService(ticketRepo);

    // Автоархивация завершенных старше 30 дней
    const archivedCompleted = await ticketSvc.archiveOldTickets(30);
    if (archivedCompleted > 0) logger.info(`Автоархивация завершенных: ${archivedCompleted} заявок`);

    // Автоархивация открытых старше 2 дней (не в работе, не решено)
    const archivedOpen = await ticketSvc.archiveOldOpen(2);
    if (archivedOpen > 0) logger.info(`Автоархивация открытых: ${archivedOpen} заявок`);

    // Удаление архивных старше 30 дней
    const deletedArchived = await ticketSvc.deleteOldArchived(30);
    if (deletedArchived > 0) logger.info(`Удалено из архива: ${deletedArchived} заявок`);

    const { UserModel, UserRole } = await import('./models');
    const superAdmin = await UserModel.findOne({ telegramId: config.superAdmin.telegramId });
    if (!superAdmin) {
      await UserModel.create({ telegramId: config.superAdmin.telegramId, firstName: 'Супер-админ', role: UserRole.SUPER_ADMIN, isActive: true });
      logger.info('Супер-админ создан');
    } else {
      await UserModel.updateOne({ telegramId: config.superAdmin.telegramId }, { $set: { role: UserRole.SUPER_ADMIN, isActive: true } });
      logger.info('Супер-админ обновлен');
    }

    const bot = createBot(config.bot.token);
    await bot.launch();
    logger.info('Бот запущен');

    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
  } catch (error) {
    logger.error('Критическая ошибка запуска:', error);
    process.exit(1);
  }
};

bootstrap();