import dotenv from 'dotenv';

dotenv.config({ quiet: true });

export const config = {
  bot: {
    token: process.env.BOT_TOKEN || '',
  },
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/techsupport_okjt',
  },
  app: {
    nodeEnv: process.env.NODE_ENV || 'development',
    isProduction: process.env.NODE_ENV === 'production',
  },
  superAdmin: {
    telegramId: parseInt(process.env.SUPER_ADMIN_ID || '0'),
  },
};

export const validateConfig = (): void => {
  const errors: string[] = [];
  if (!config.bot.token) errors.push('BOT_TOKEN обязателен');
  if (!config.database.uri) errors.push('MONGODB_URI обязателен');
  if (!config.superAdmin.telegramId) errors.push('SUPER_ADMIN_ID обязателен');
  if (errors.length > 0) throw new Error(`Ошибки конфигурации:\n${errors.join('\n')}`);
};