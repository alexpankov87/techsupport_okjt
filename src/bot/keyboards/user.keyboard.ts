import { Markup } from 'telegraf';

export const userMainKeyboard = Markup.keyboard([
  ['📝 Подать заявку', '📋 Мои заявки'],
  ['❓ Как подать заявку'],
]).resize();