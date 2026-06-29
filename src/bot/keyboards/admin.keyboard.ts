import { Markup } from 'telegraf';

export const adminMainKeyboard = Markup.keyboard([
  ['📋 Новая заявка', '📊 Журнал заявок'],
  ['👥 Сотрудники', '📈 Статистика'],
]).resize();

export const adminCancelKeyboard = Markup.keyboard([
  ['❌ Отменить создание'],
]).resize();