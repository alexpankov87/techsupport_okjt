import { Markup } from 'telegraf';

export const workerMainKeyboard = Markup.keyboard([
  ['📋 Мои заявки', '✅ Завершенные'],
  ['✅ Выполнено сегодня', '📊 Моя статистика'],
]).resize();