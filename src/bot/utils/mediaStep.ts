/**
 * Telegram sends each album item as its own update (same media_group_id).
 * Debounce so the wizard advances once with all file_ids.
 *
 * Important: album handling must NOT await the quiet period inside the middleware —
 * Telegraf processes chat updates sequentially, so awaiting would starve later album parts.
 */

export type MediaMessage = {
  photo?: { file_id: string }[];
  video?: { file_id: string };
  voice?: { file_id: string };
  audio?: { file_id: string };
  document?: { file_id: string };
  media_group_id?: string;
  text?: string;
};

export function extractMediaFileId(msg: MediaMessage): string | undefined {
  if (msg.photo?.length) return msg.photo[msg.photo.length - 1].file_id;
  if (msg.video) return msg.video.file_id;
  if (msg.voice) return msg.voice.file_id;
  if (msg.audio) return msg.audio.file_id;
  if (msg.document) return msg.document.file_id;
  return undefined;
}

export function albumKey(chatId: number | string, groupId: string): string {
  return `${chatId}:${groupId}`;
}

type Bucket = {
  fileIds: string[];
  timer: ReturnType<typeof setTimeout>;
  onFlush: (fileIds: string[]) => void | Promise<void>;
};

const DEFAULT_WAIT_MS = 700;
/** Telegram media_group max is 10 items. */
export const MAX_ALBUM_MEDIA = 10;
const buckets = new Map<string, Bucket>();

/** Test seam: clear all pending albums. */
export function resetAlbumBuffers(): void {
  for (const b of buckets.values()) clearTimeout(b.timer);
  buckets.clear();
}

export type MediaStepOutcome =
  | { kind: 'advance'; media: string[] }
  | { kind: 'scheduled' } // album collecting; onFlush will run later
  | { kind: 'ignore' };

/**
 * @param onAlbumFlush called once after album quiet period (do reply + wizard.next there)
 */
export function takeMediaStep(
  chatId: number | string,
  message: MediaMessage,
  onAlbumFlush: (fileIds: string[]) => void | Promise<void>,
  waitMs = DEFAULT_WAIT_MS,
): MediaStepOutcome {
  if (message.text !== undefined) {
    return { kind: 'advance', media: [] };
  }

  const fileId = extractMediaFileId(message);
  if (!fileId) return { kind: 'ignore' };

  const groupId = message.media_group_id;
  if (!groupId) {
    return { kind: 'advance', media: [fileId] };
  }

  const key = albumKey(chatId, groupId);
  let b = buckets.get(key);
  if (!b) {
    b = {
      fileIds: [],
      timer: setTimeout(() => {}, 0),
      onFlush: onAlbumFlush,
    };
    buckets.set(key, b);
  }
  b.onFlush = onAlbumFlush; // keep latest ctx-bound callback
  if (!b.fileIds.includes(fileId) && b.fileIds.length < MAX_ALBUM_MEDIA) {
    b.fileIds.push(fileId);
  }

  clearTimeout(b.timer);
  b.timer = setTimeout(() => {
    const bucket = buckets.get(key);
    if (!bucket) return;
    buckets.delete(key);
    const ids = bucket.fileIds.slice();
    Promise.resolve(bucket.onFlush(ids)).catch(() => {});
  }, waitMs);

  return { kind: 'scheduled' };
}
