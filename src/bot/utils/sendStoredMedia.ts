/**
 * Ticket stores bare Telegram file_ids (type is not saved).
 * Probe methods in order: a wrong type rejects, the matching one accepts.
 * Voice is not allowed in sendMediaGroup, so each file goes alone.
 */

type MediaApi = {
  sendPhoto: (chatId: number, fileId: string) => Promise<unknown>;
  sendVideo: (chatId: number, fileId: string) => Promise<unknown>;
  sendVoice: (chatId: number, fileId: string) => Promise<unknown>;
  sendAudio: (chatId: number, fileId: string) => Promise<unknown>;
  sendDocument: (chatId: number, fileId: string) => Promise<unknown>;
};

const METHODS = ['sendPhoto', 'sendVideo', 'sendVoice', 'sendAudio', 'sendDocument'] as const;

export async function sendStoredMedia(api: MediaApi, chatId: number, fileIds?: string[]): Promise<number> {
  if (!fileIds?.length) return 0;
  let sent = 0;
  for (const fileId of fileIds) {
    for (const method of METHODS) {
      try {
        await api[method](chatId, fileId);
        sent += 1;
        break;
      } catch {
        // next method
      }
    }
  }
  return sent;
}
