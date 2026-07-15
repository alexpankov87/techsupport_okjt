import { Markup } from 'telegraf';

export const workerMainKeyboard = Markup.keyboard([
  ['📝 Подать заявку', '📋 Мои заявки'],
  ['✅ Завершенные', '✅ Выполнено сегодня'],
  ['📊 Моя статистика'],
]).resize();