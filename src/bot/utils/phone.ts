import { Markup } from 'telegraf';
import { BotContext } from '../middlewares/auth.middleware';

/** Profile phone, or last ticket phone cached on user. */
export async function resolveUserPhone(ctx: BotContext): Promise<string | undefined> {
  const user = ctx.user;
  if (!user) return undefined;
  if (user.phone) return user.phone;

  const last = await ctx.ticketService.getLastPhoneForUser(user._id.toString());
  if (!last) return undefined;

  await ctx.userService.savePhone(user._id.toString(), last);
  user.phone = last;
  return last;
}

export async function promptMediaStep(ctx: BotContext, phone?: string): Promise<void> {
  const header = phone ? `📞 Телефон: ${phone}\n\n` : '';
  await ctx.reply(
    `${header}📎 Прикрепите фото, видео, голосовое, аудио или документ (или нажмите "Пропустить"):`,
    Markup.keyboard([['⏭ Пропустить', '❌ Отмена']]).resize(),
  );
}

export function formatUserPhone(phone?: string): string {
  return phone?.trim() || 'Не указан';
}
