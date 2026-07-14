/**
 * ponytail: invariant checks — fail fast on regressions.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

let failed = false;
const ok = (msg) => console.log('OK:', msg);
const fail = (msg) => { console.error('FAIL:', msg); failed = true; };

// auth before stage
const botTs = read('src/bot/bot.ts');
const auth = botTs.indexOf('authMiddleware(userService)');
const stage = botTs.indexOf('stage.middleware()');
if (auth < 0 || stage < 0 || auth > stage) fail('authMiddleware must run before stage.middleware()');
else ok('auth before stage');

// journal excludes resolved (they go to "Выполнено сегодня" / archive)
const journalKb = read('src/bot/keyboards/journal.keyboard.ts');
if (journalKb.includes('TicketStatus.RESOLVED')) fail('journal filters must not include RESOLVED');
else ok('journal excludes resolved');

if (!botTs.includes('sendJournalTickets') || !botTs.includes('journalMenuKeyboard')) {
  fail('journal menu filters missing');
} else ok('journal menu with filters');

if (botTs.includes('dateFrom: today, dateTo: tomorrow')) {
  fail('active journal must not be limited to today only');
} else ok('journal not today-only');

if (!botTs.includes("bot.hears('✅ Выполнено сегодня'")) fail('handler for Выполнено сегодня missing');
else ok('resolved-today handler present');

// scenes restore main menu after finish
for (const file of ['src/bot/scenes/createTicket.scene.ts', 'src/bot/scenes/createUserTicket.scene.ts']) {
  const src = read(file);
  if (!src.includes('finishScene')) fail(`${file} must call finishScene on exit`);
  else ok(`${path.basename(file)} uses finishScene`);
}

// staff keyboards expose the menu
for (const file of ['src/bot/keyboards/superAdmin.keyboard.ts', 'src/bot/keyboards/admin.keyboard.ts', 'src/bot/keyboards/worker.keyboard.ts']) {
  const src = read(file);
  if (!src.includes('✅ Выполнено сегодня')) fail(`${file} missing Выполнено сегодня button`);
  else ok(`${path.basename(file)} has staff menu button`);
}

// repo supports resolvedAt filter
const repo = read('src/repositories/TicketRepository.ts');
if (!repo.includes('resolvedFrom') || !repo.includes('resolvedTo')) fail('TicketRepository missing resolvedAt filters');
else ok('resolvedAt filters in repository');

const userModel = read('src/models/User.model.ts');
if (!userModel.includes('phone')) fail('User model missing phone field');
else ok('user phone field present');

const phoneUtil = read('src/bot/utils/phone.ts');
if (!phoneUtil.includes('resolveUserPhone')) fail('resolveUserPhone helper missing');
else ok('phone auto-fill helper present');

for (const file of ['src/bot/scenes/createTicket.scene.ts', 'src/bot/scenes/createUserTicket.scene.ts']) {
  const src = read(file);
  if (!src.includes('resolveUserPhone') || !src.includes('selectStep(4)')) fail(`${file} must skip phone step when known`);
  else ok(`${path.basename(file)} skips phone when cached`);
}

const usersUtil = read('src/bot/utils/users.ts');
if (!usersUtil.includes('📞 Телефон:')) fail('user cards must show phone');
else ok('user list shows phone');

const phoneCore = read('src/utils/phone.ts');
if (!phoneCore.includes('isValidPhone')) fail('phone validation missing');
else ok('phone validation present');

const userMgmt = read('src/bot/handlers/userManagement.handler.ts');
if (!userMgmt.includes("ctx.scene.enter('users')")) fail('users scene entry missing');
else ok('users search scene wired');

const usersScene = read('src/bot/scenes/users.scene.ts');
if (!usersScene.includes('sendUserSearch')) fail('users scene must support search');
else ok('users scene has search');

const userRepo = read('src/repositories/UserRepository.ts');
if (!userRepo.includes('searchActive')) fail('UserRepository missing searchActive');
else ok('user search in repository');

const assignees = read('src/bot/utils/assignees.ts');
if (!assignees.includes('mergeAssignable') || !assignees.includes('На себя')) fail('admin self-assign helpers missing');
else ok('admin self-assign helpers');

const userSvc = read('src/services/UserService.ts');
if (!userSvc.includes('getAssignableUsers')) fail('UserService.getAssignableUsers missing');
else ok('getAssignableUsers in UserService');

if (!botTs.includes('getAssignableUsers')) fail('assign picker must use getAssignableUsers');
else ok('assign picker uses getAssignableUsers');

for (const file of ['src/bot/keyboards/admin.keyboard.ts', 'src/bot/keyboards/superAdmin.keyboard.ts']) {
  const src = read(file);
  if (!src.includes('📋 Мои заявки')) fail(`${file} missing Мои заявки for self-assigned work`);
  else ok(`${path.basename(file)} has Мои заявки`);
}

const ticketRepo = read('src/repositories/TicketRepository.ts');
if (!ticketRepo.includes('TicketStatus.RESOLVED') || !ticketRepo.includes('archiveCompleted')) {
  fail('archiveCompleted must include RESOLVED');
} else ok('archive includes resolved tickets');

const appTs = read('src/app.ts');
if (!appTs.includes('archiveOldTickets(1)')) fail('bootstrap must archive finished tickets after 1 day');
else ok('auto-archive after 1 day');

const journalFilters = read('src/bot/keyboards/journal.keyboard.ts');
for (const label of ['Не назначенные', 'Назначенные', 'Не взятые в работу']) {
  if (!journalFilters.includes(label)) fail(`journal missing filter: ${label}`);
  else ok(`journal filter: ${label}`);
}

if (failed) process.exit(1);
