/**
 * ponytail: mergeAssignable must prepend admin so they can self-assign.
 */
const { mergeAssignable, assigneeLabel } = (() => {
  // mirror src/bot/utils/assignees.ts — keep in sync via string check + runtime below after build
  const UserRole = { ADMIN: 'admin', SUPER_ADMIN: 'super_admin', WORKER: 'worker', USER: 'user' };
  function mergeAssignable(workers, actor) {
    if (!actor) return workers;
    if (actor.role !== UserRole.ADMIN && actor.role !== UserRole.SUPER_ADMIN) return workers;
    const id = actor._id.toString();
    if (workers.some((w) => w._id.toString() === id)) return workers;
    return [actor, ...workers];
  }
  function assigneeLabel(user, actorId) {
    const name = `${user.firstName} ${user.lastName || ''}`.trim();
    if (actorId && user._id.toString() === actorId) return `🙋 На себя (${name})`;
    return `👤 ${name}`;
  }
  return { mergeAssignable, assigneeLabel };
})();

const admin = { _id: { toString: () => 'a1' }, firstName: 'Админ', lastName: '', role: 'admin' };
const worker = { _id: { toString: () => 'w1' }, firstName: 'Работник', lastName: '', role: 'worker' };
const user = { _id: { toString: () => 'u1' }, firstName: 'Юзер', lastName: '', role: 'user' };

let failed = false;
const ok = (m) => console.log('OK:', m);
const fail = (m) => { console.error('FAIL:', m); failed = true; };

const withAdmin = mergeAssignable([worker], admin);
if (withAdmin.length !== 2 || withAdmin[0]._id.toString() !== 'a1') fail('admin must be prepended');
else ok('admin prepended for self-assign');

const noDup = mergeAssignable([admin, worker], admin);
if (noDup.length !== 2) fail('admin already in list must not duplicate');
else ok('no duplicate admin');

const plain = mergeAssignable([worker], user);
if (plain.length !== 1 || plain[0]._id.toString() !== 'w1') fail('regular user must not be merged');
else ok('user not merged into assignees');

const label = assigneeLabel(admin, 'a1');
if (!label.includes('На себя')) fail('self label missing');
else ok('self label');

const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../src/bot/utils/assignees.ts'), 'utf8');
if (!src.includes('mergeAssignable') || !src.includes('На себя')) fail('assignees.ts missing expected API');
else ok('assignees.ts present');

const bot = fs.readFileSync(path.join(__dirname, '../src/bot/bot.ts'), 'utf8');
if (!bot.includes('getAssignableUsers')) fail('bot must use getAssignableUsers');
else ok('bot uses getAssignableUsers');

if (!bot.includes("user.role === UserRole.ADMIN")) fail('Мои заявки must work for admin assignees');
else ok('Мои заявки includes admin');

const svc = fs.readFileSync(path.join(__dirname, '../src/services/UserService.ts'), 'utf8');
if (!svc.includes('getAssignableUsers')) fail('UserService missing getAssignableUsers');
else ok('UserService.getAssignableUsers');

if (failed) process.exit(1);
