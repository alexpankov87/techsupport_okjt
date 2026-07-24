/**
 * ponytail: commandsForRole — applicants get apply/my, not admin journal.
 */
const fs = require('fs');
const path = require('path');

const UserRole = { USER: 'user', WORKER: 'worker', ADMIN: 'admin', SUPER_ADMIN: 'super_admin' };

// mirror src/bot/utils/commands.ts
const start = { command: 'start', description: 'Главное меню' };
const help = { command: 'help', description: 'Помощь по боту' };
const apply = { command: 'apply', description: 'Подать заявку' };
const my = { command: 'my', description: 'Мои заявки' };
const done = { command: 'done', description: 'Завершенные' };
const today = { command: 'today', description: 'Выполнено сегодня' };
const stats = { command: 'stats', description: 'Статистика' };
const newTicket = { command: 'new', description: 'Новая заявка' };
const journal = { command: 'journal', description: 'Журнал заявок' };
const DEFAULT_COMMANDS = [start, help, apply, my];
const WORKER_COMMANDS = [start, help, apply, my, done, today, stats];
const ADMIN_COMMANDS = [start, help, apply, my, newTicket, journal];

function commandsForRole(role) {
  if (role === UserRole.WORKER) return WORKER_COMMANDS;
  if (role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN) return ADMIN_COMMANDS;
  return DEFAULT_COMMANDS;
}

let failed = false;
const ok = (m) => console.log('OK:', m);
const fail = (m) => { console.error('FAIL:', m); failed = true; };

const userCmds = commandsForRole(UserRole.USER).map((c) => c.command);
if (!userCmds.includes('apply') || !userCmds.includes('my') || userCmds.includes('journal')) {
  fail('USER menu must be apply/my without journal');
} else ok('USER commands');

const workerCmds = commandsForRole(UserRole.WORKER).map((c) => c.command);
if (!workerCmds.includes('done') || workerCmds.includes('journal')) {
  fail('WORKER menu must include done, not journal');
} else ok('WORKER commands');

const src = fs.readFileSync(path.join(__dirname, '../src/bot/utils/commands.ts'), 'utf8');
if (!src.includes('commandsForRole') || !src.includes('DEFAULT_COMMANDS')) fail('commands.ts API missing');
else ok('commands.ts present');

const bot = fs.readFileSync(path.join(__dirname, '../src/bot/bot.ts'), 'utf8');
if (!bot.includes('syncChatCommands') || !bot.includes("type: 'chat'")) fail('chat scope sync missing');
else ok('bot syncs chat commands');

if (failed) process.exit(1);
console.log('All command-menu checks passed');
