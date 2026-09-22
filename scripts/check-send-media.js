/**
 * ponytail: file_id type is unknown, so the first matching Telegram method wins.
 * Run after build: node scripts/check-send-media.js
 */
const assert = require('assert');
const path = require('path');
const { sendStoredMedia } = require(path.join(__dirname, '..', 'dist', 'bot', 'utils', 'sendStoredMedia.js'));

function api(accept) {
  const calls = [];
  const method = (name) => async (_chatId, fileId) => {
    calls.push(name);
    if (name !== accept) throw new Error('wrong type');
    return { fileId };
  };
  return {
    calls,
    sendPhoto: method('sendPhoto'),
    sendVideo: method('sendVideo'),
    sendVoice: method('sendVoice'),
    sendAudio: method('sendAudio'),
    sendDocument: method('sendDocument'),
  };
}

(async () => {
  const photo = api('sendPhoto');
  assert.strictEqual(await sendStoredMedia(photo, 1, ['p']), 1);
  assert.deepStrictEqual(photo.calls, ['sendPhoto']);

  const voice = api('sendVoice');
  assert.strictEqual(await sendStoredMedia(voice, 1, ['v']), 1);
  assert.deepStrictEqual(voice.calls, ['sendPhoto', 'sendVideo', 'sendVoice']);

  const video = api('sendVideo');
  assert.strictEqual(await sendStoredMedia(video, 2, ['a', 'b']), 2);

  assert.strictEqual(await sendStoredMedia(api('sendDocument'), 1, []), 0);
  assert.strictEqual(await sendStoredMedia(api('sendDocument'), 1, undefined), 0);

  console.log('OK: stored media probe');
})().catch((err) => {
  console.error('FAIL:', err);
  process.exit(1);
});
