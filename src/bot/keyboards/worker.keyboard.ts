import { Markup } from 'telegraf';

export const workerMainKeyboard = Markup.keyboard([
  ['📋 Мои заявки', '✅ Завершенные'],
  ['📊 Моя статистика'],
]).resize();