#!/usr/bin/env node
/**
 * Ticket description must be a real problem text, not /start or menu chrome.
 * Run after build: node scripts/check-description.js
 */
const assert = require('assert');
const path = require('path');
const { parseTicketDescription } = require(path.join(__dirname, '..', 'dist', 'utils', 'description.js'));
const { isIgnorableTelegramError } = require(path.join(__dirname, '..', 'dist', 'utils', 'errors.js'));

function ok(m) { console.log('OK:', m); }

function rejected(raw) {
  const r = parseTicketDescription(raw);
  assert.strictEqual(r.ok, false, `should reject ${JSON.stringify(raw)}`);
}
function accepted(raw, expected) {
  const r = parseTicketDescription(raw);
  assert.strictEqual(r.ok, true, `should accept ${JSON.stringify(raw)}`);
  assert.strictEqual(r.text, expected);
}

rejected('');
rejected('   ');
rejected('/start');
rejected('/START');
rejected('/start@okjt_bot');
rejected('/apply');
rejected('/apply please');
rejected('/help');
rejected('/my');
rejected('.');
rejected('нет');
rejected('❌ Отмена');
rejected('⏭ Пропустить');
rejected('📝 Подать заявку');
rejected('📋 Мои заявки');
rejected('📖 Инструкция');
rejected('🔙 Главное меню');
ok('rejects commands, chrome, and stubs');

accepted('Не печатает принтер в 305', 'Не печатает принтер в 305');
accepted('  Wi-Fi нет в 2 кабинете  ', 'Wi-Fi нет в 2 кабинете');
accepted('Нет света', 'Нет света');
ok('accepts real problem text');

assert.strictEqual(
  isIgnorableTelegramError(
    new Error('400: Bad Request: query is too old and response timeout expired or query ID is invalid'),
  ),
  true,
);
assert.strictEqual(
  isIgnorableTelegramError({
    response: { description: 'Bad Request: query ID is invalid' },
  }),
  true,
);
assert.strictEqual(isIgnorableTelegramError(new Error('ETIMEDOUT')), false);
assert.strictEqual(isIgnorableTelegramError(new Error('Пользователь не найден')), false);
ok('stale callback queries are ignorable');

console.log('All description checks passed');
