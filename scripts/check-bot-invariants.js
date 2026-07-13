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

// journal excludes resolved (they go to "Выполнено сегодня")
if (botTs.includes('TicketStatus.RESOLVED, TicketStatus.UNRESOLVED') ||
    botTs.includes('IN_PROGRESS, TicketStatus.RESOLVED')) {
  fail('journal must not include RESOLVED tickets');
} else ok('journal excludes resolved');

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

const userMgmt = read('src/bot/handlers/userManagement.handler.ts');
if (!userMgmt.includes('📞 Телефон:')) fail('user list must show phone');
else ok('user list shows phone');

const phoneCore = read('src/utils/phone.ts');
if (!phoneCore.includes('isValidPhone')) fail('phone validation missing');
else ok('phone validation present');

if (failed) process.exit(1);
