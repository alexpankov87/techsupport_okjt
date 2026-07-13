import { Markup } from 'telegraf';
import { BotContext } from '../middlewares/auth.middleware';
import { ITicket } from '../../models';
import { isValidPhone, pickPhone } from '../../utils/phone';

/** Profile phone, or last valid ticket phone cached on user. */
export async function resolveUserPhone(ctx: BotContext): Promise<string | undefined> {
  const user = ctx.user;
  if (!user) return undefined;
  if (isValidPhone(user.phone)) return user.phone!.trim();

  const last = await ctx.ticketService.getLastPhoneForUser(user._id.toString());
  if (!last) return undefined;

  await ctx.userService.savePhone(user._id.toString(), last);
  user.phone = last;
  return last;
}

export async function acceptPhoneInput(ctx: BotContext, raw: string): Promise<string | undefined> {
  const text = raw.trim();
  if (isValidPhone(text)) {
    const userId = (ctx.user as any)?._id?.toString();
    if (userId) await ctx.userService.savePhone(userId, text);
    return text;
  }
  const fallback = await resolveUserPhone(ctx);
  if (fallback) {
    await ctx.reply(`📞 Используем сохранённый номер: ${fallback}`);
    return fallback;
  }
  await ctx.reply('❌ Укажите номер телефона (минимум 10 цифр), не текст описания:');
  return undefined;
}

export function ticketPhone(ticket: ITicket): string {
  const creator = ticket.createdBy as any;
  const userPhone = typeof creator === 'object' ? creator?.phone : undefined;
  return pickPhone(ticket.phone, userPhone);
}

export async function promptMediaStep(ctx: BotContext, phone?: string): Promise<void> {
  const header = isValidPhone(phone) ? `📞 Телефон: ${phone}\n\n` : '';
  await ctx.reply(
    `${header}📎 Прикрепите фото, видео, голосовое, аудио или документ (или нажмите "Пропустить"):`,
    Markup.keyboard([['⏭ Пропустить', '❌ Отмена']]).resize(),
  );
}

export function formatUserPhone(phone?: string): string {
  return isValidPhone(phone) ? phone!.trim() : 'Не указан';
}
