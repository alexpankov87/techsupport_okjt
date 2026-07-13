import { Markup } from 'telegraf';

export const adminMainKeyboard = Markup.keyboard([
  ['📋 Новая заявка', '📊 Журнал заявок'],
  ['✅ Выполнено сегодня', '📦 Архив заявок'],
  ['👥 Пользователи', '👥 Сотрудники'],
  ['📈 Статистика', '📊 Отчеты'],
  ['⚙️ Настройки', '🧹 Очистить завершенные'],
]).resize();

export const adminCancelKeyboard = Markup.keyboard([
  ['❌ Отменить создание'],
]).resize();