import { config, validateConfig } from './config';
import { connectDatabase } from './config/database';
import { createBot } from './bot/bot';
import { logger } from './utils/logger';

const bootstrap = async (): Promise<void> => {
  try {
    logger.info('Запуск techsupport_okjt...');

    validateConfig();
    logger.info('Конфигурация валидна');

    await connectDatabase(config.database.uri);
    // Авто-создание супер-админаы
    const { UserModel, UserRole } = await import('./models');
    const superAdmin = await UserModel.findOne({ telegramId: config.superAdmin.telegramId });
    if (!superAdmin) {
      await UserModel.create({
        telegramId: config.superAdmin.telegramId,
        firstName: 'Супер-админ',
        role: UserRole.SUPER_ADMIN,
        isActive: true,
      });
      logger.info('Супер-админ создан');
    } else {
      await UserModel.updateOne(
        { telegramId: config.superAdmin.telegramId },
        { $set: { role: UserRole.SUPER_ADMIN, isActive: true } },
      );
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