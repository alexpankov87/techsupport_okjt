import mongoose from 'mongoose';
import { TicketCategory } from '../../models';

/** Strict 24-hex ObjectId (mongoose isValid accepts some non-ObjectId strings). */
export function parseObjectId(raw: string | undefined | null): string | undefined {
  const s = (raw ?? '').trim();
  if (!/^[a-fA-F0-9]{24}$/.test(s)) return undefined;
  return s;
}

export function toObjectId(raw: string, label = 'id'): mongoose.Types.ObjectId {
  const id = parseObjectId(raw);
  if (!id) throw new Error(`Некорректный ${label}`);
  return new mongoose.Types.ObjectId(id);
}

export function parseWorkerCallback(data: string): string | undefined {
  const m = /^worker_([a-fA-F0-9]{24})$/.exec(data);
  return m?.[1];
}

export function parseCategoryCallback(data: string): TicketCategory | undefined {
  const m = /^category_([a-z_]+)$/.exec(data);
  if (!m) return undefined;
  const value = m[1] as TicketCategory;
  return Object.values(TicketCategory).includes(value) ? value : undefined;
}
