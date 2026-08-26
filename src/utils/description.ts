/** Ticket body must be a real problem, not a bot command or keyboard chrome. */

export const DESCRIPTION_RETRY =
  'Нужно описать проблему своими словами, не командой и не кнопкой.\n' +
  'Например: «Не печатает принтер в 305 кабинете»';

const SLASH_CMD = /^\/\S+/;
const MIN_LEN = 5;

const CHROME = new Set([
  '❌ Отмена',
  '❌ Отменить создание',
  '⏭ Пропустить',
  '📝 Подать заявку',
  '📋 Новая заявка',
  '📋 Мои заявки',
  '📖 Инструкция',
  '❓ Как подать заявку',
  '🔙 Главное меню',
  '📊 Журнал заявок',
  '✅ Выполнено сегодня',
  '📦 Архив заявок',
  '👥 Пользователи',
  '👥 Сотрудники',
  '👑 Админы',
  '📈 Статистика',
  '📊 Отчеты',
  '⚙️ Настройки',
  '🧹 Очистить завершенные',
  '✅ Завершенные',
  '📊 Моя статистика',
  '🆕 Не назначенные',
  '📌 Назначенные',
  '🔧 В работе',
  '⏳ Не взятые в работу',
  '📋 Все активные',
]);

export type ParsedDescription =
  | { ok: true; text: string }
  | { ok: false };

export function parseTicketDescription(raw: unknown): ParsedDescription {
  const text = String(raw ?? '').trim().replace(/\s+/g, ' ');
  if (!text || text.length < MIN_LEN) return { ok: false };
  if (SLASH_CMD.test(text)) return { ok: false };
  if (CHROME.has(text)) return { ok: false };
  return { ok: true, text };
}
