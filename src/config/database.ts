import mongoose from 'mongoose';
import { logger } from '../utils/logger';

export const connectDatabase = async (uri: string): Promise<void> => {
  try {
    mongoose.set('strictQuery', true);

    await mongoose.connect(uri, {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
    });

    logger.info('MongoDB подключена');

    mongoose.connection.on('error', (error) => {
      logger.error('Ошибка MongoDB:', error);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB отключена');
    });
  } catch (error) {
    logger.error('Критическая ошибка подключения к MongoDB:', error);
    process.exit(1);
  }
};