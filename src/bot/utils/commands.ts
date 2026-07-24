import { UserRole } from '../../models';

export type BotCommandItem = { command: string; description: string };

const start: BotCommandItem = { command: 'start', description: 'Главное меню' };
const help: BotCommandItem = { command: 'help', description: 'Помощь по боту' };
const apply: BotCommandItem = { command: 'apply', description: 'Подать заявку' };
const my: BotCommandItem = { command: 'my', description: 'Мои заявки' };
const done: BotCommandItem = { command: 'done', description: 'Завершенные' };
const today: BotCommandItem = { command: 'today', description: 'Выполнено сегодня' };
const stats: BotCommandItem = { command: 'stats', description: 'Статистика' };
const newTicket: BotCommandItem = { command: 'new', description: 'Новая заявка' };
const journal: BotCommandItem = { command: 'journal', description: 'Журнал заявок' };
const archive: BotCommandItem = { command: 'archive', description: 'Архив заявок' };
const users: BotCommandItem = { command: 'users', description: 'Пользователи' };
const staff: BotCommandItem = { command: 'staff', description: 'Сотрудники' };
const reports: BotCommandItem = { command: 'reports', description: 'Отчеты' };

/** Default menu before /start — for applicants. */
export const DEFAULT_COMMANDS: BotCommandItem[] = [start, help, apply, my];

const WORKER_COMMANDS: BotCommandItem[] = [start, help, apply, my, done, today, stats];

const ADMIN_COMMANDS: BotCommandItem[] = [
  start, help, apply, my, newTicket, journal, archive, users, staff, stats, today, done, reports,
];

export function commandsForRole(role?: UserRole | string): BotCommandItem[] {
  if (role === UserRole.WORKER) return WORKER_COMMANDS;
  if (role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN) return ADMIN_COMMANDS;
  return DEFAULT_COMMANDS;
}
