#!/usr/bin/env node
/**
 * Self-check: album (media_group) must flush once with all file_ids, without blocking.
 * Run after build: node scripts/check-media-album.js
 */
const assert = require('assert');
const path = require('path');

const {
  extractMediaFileId,
  takeMediaStep,
  resetAlbumBuffers,
  albumKey,
} = require(path.join(__dirname, '..', 'dist', 'bot', 'utils', 'mediaStep.js'));

function ok(msg) { console.log('OK:', msg); }
function fail(msg) { console.error('FAIL:', msg); process.exit(1); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  resetAlbumBuffers();

  assert.strictEqual(
    extractMediaFileId({ photo: [{ file_id: 'a' }, { file_id: 'b' }] }),
    'b',
  );
  assert.strictEqual(extractMediaFileId({ video: { file_id: 'v1' } }), 'v1');
  assert.strictEqual(extractMediaFileId({ text: 'x' }), undefined);
  ok('extractMediaFileId');

  // Single photo → advance immediately (sync)
  {
    let flushed = 0;
    const o = takeMediaStep(1, { photo: [{ file_id: 'p1' }] }, () => { flushed++; }, 50);
    assert.deepStrictEqual(o, { kind: 'advance', media: ['p1'] });
    assert.strictEqual(flushed, 0);
    ok('single photo advances sync');
  }

  // Skip text
  {
    const o = takeMediaStep(1, { text: '⏭ Пропустить' }, () => {}, 50);
    assert.deepStrictEqual(o, { kind: 'advance', media: [] });
    ok('skip text advances with empty media');
  }

  // Album of 3: all return scheduled immediately (non-blocking), one flush
  {
    resetAlbumBuffers();
    const waitMs = 60;
    let flushCount = 0;
    let flushedIds = null;
    const onFlush = (ids) => { flushCount++; flushedIds = ids; };

    const o1 = takeMediaStep(42, { photo: [{ file_id: 'f1' }], media_group_id: 'alb' }, onFlush, waitMs);
    const o2 = takeMediaStep(42, { photo: [{ file_id: 'f2' }], media_group_id: 'alb' }, onFlush, waitMs);
    const o3 = takeMediaStep(42, { photo: [{ file_id: 'f3' }], media_group_id: 'alb' }, onFlush, waitMs);

    assert.strictEqual(o1.kind, 'scheduled');
    assert.strictEqual(o2.kind, 'scheduled');
    assert.strictEqual(o3.kind, 'scheduled');
    assert.strictEqual(flushCount, 0, 'must not flush before quiet period');

    await sleep(waitMs + 40);
    assert.strictEqual(flushCount, 1, `expected 1 flush, got ${flushCount}`);
    assert.deepStrictEqual([...flushedIds].sort(), ['f1', 'f2', 'f3']);
    ok('album of 3 → one non-blocking flush with all ids');
  }

  // Sequential processing simulation: each step returns before next ingest
  {
    resetAlbumBuffers();
    const waitMs = 50;
    let flushCount = 0;
    let flushedIds = null;
    const onFlush = (ids) => { flushCount++; flushedIds = ids; };

    // Mimic Telegraf: finish handler before next update
    takeMediaStep(7, { photo: [{ file_id: 'a' }], media_group_id: 's' }, onFlush, waitMs);
    takeMediaStep(7, { photo: [{ file_id: 'b' }], media_group_id: 's' }, onFlush, waitMs);
    takeMediaStep(7, { photo: [{ file_id: 'c' }], media_group_id: 's' }, onFlush, waitMs);
    await sleep(waitMs + 40);
    assert.strictEqual(flushCount, 1);
    assert.deepStrictEqual([...flushedIds].sort(), ['a', 'b', 'c']);
    ok('sequential album ingest still one flush');
  }

  assert.notStrictEqual(albumKey(1, 'g'), albumKey(2, 'g'));
  ok('album keys isolated per chat');

  // Two chats same group id — two flushes
  {
    resetAlbumBuffers();
    let n = 0;
    takeMediaStep(1, { photo: [{ file_id: 'x' }], media_group_id: 'g' }, () => { n++; }, 40);
    takeMediaStep(2, { photo: [{ file_id: 'y' }], media_group_id: 'g' }, () => { n++; }, 40);
    await sleep(80);
    assert.strictEqual(n, 2);
    ok('separate chats flush independently');
  }

  // Album of 10 → all kept, one flush
  {
    resetAlbumBuffers();
    const { MAX_ALBUM_MEDIA } = require(path.join(__dirname, '..', 'dist', 'bot', 'utils', 'mediaStep.js'));
    let flushCount = 0;
    let flushedIds = null;
    const onFlush = (ids) => { flushCount++; flushedIds = ids; };
    for (let i = 1; i <= MAX_ALBUM_MEDIA; i++) {
      const o = takeMediaStep(9, { photo: [{ file_id: `p${i}` }], media_group_id: 'ten' }, onFlush, 40);
      assert.strictEqual(o.kind, 'scheduled');
    }
    // 11th is ignored beyond cap but still scheduled (same group)
    takeMediaStep(9, { photo: [{ file_id: 'p11' }], media_group_id: 'ten' }, onFlush, 40);
    await sleep(80);
    assert.strictEqual(flushCount, 1);
    assert.strictEqual(flushedIds.length, MAX_ALBUM_MEDIA);
    assert.ok(!flushedIds.includes('p11'));
    ok(`album capped at ${MAX_ALBUM_MEDIA}`);
  }

  console.log('All media album checks passed');
}

main().catch((e) => fail(e.stack || String(e)));
