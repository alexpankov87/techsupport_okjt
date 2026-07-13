/**
 * ponytail: fails if auth runs after stage — scenes then miss ctx.user
 * (symptom: "Ошибка: пользователь не найден" on category pick).
 */
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '../src/bot/bot.ts'), 'utf8');
const auth = src.indexOf('authMiddleware(userService)');
const stage = src.indexOf('stage.middleware()');

if (auth < 0 || stage < 0) {
  console.error('FAIL: auth or stage middleware not found');
  process.exit(1);
}
if (auth > stage) {
  console.error('FAIL: authMiddleware must run before stage.middleware()');
  process.exit(1);
}
console.log('OK: auth before stage');
