import { Markup } from 'telegraf';

export const adminMainKeyboard = Markup.keyboard([
  ['📋 Новая заявка', '📊 Журнал заявок'],
  ['📦 Архив заявок', '👥 Сотрудники'],
  ['📈 Статистика', '📊 Отчеты'],
  ['⚙️ Настройки', '🧹 Очистить завершенные'],
]).resize();

export const adminCancelKeyboard = Markup.keyboard([
  ['❌ Отменить создание'],
]).resize();