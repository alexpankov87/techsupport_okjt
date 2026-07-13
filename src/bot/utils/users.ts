import { BotContext } from '../middlewares/auth.middleware';
import { IUser, UserRole } from '../../models';
import { userManagementKeyboard } from '../keyboards/superAdmin.keyboard';
import { formatUserPhone } from './phone';

const ROLE_LABEL: Record<string, string> = {
  super_admin: '👑 Супер-админ',
  admin: '👑 Админ',
  worker: '🔧 Работник',
  user: '👤 Пользователь',
};

export function canBrowseUsers(ctx: BotContext): boolean {
  const role = ctx.user?.role;
  return role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN;
}

async function resolvePhone(ctx: BotContext, user: IUser): Promise<string | undefined> {
  if (user.phone) return user.phone;
  return ctx.ticketService.getLastPhoneForUser(user._id.toString());
}

export async function formatUserCard(ctx: BotContext, user: IUser): Promise<string> {
  const phone = await resolvePhone(ctx, user);
  return (
    `👤 ${user.firstName} ${user.lastName || ''}\n` +
    `🆔 ID: ${user.telegramId}\n` +
    `📞 Телефон: ${formatUserPhone(phone)}\n` +
    `📌 Роль: ${ROLE_LABEL[user.role] || 'Не назначена'}\n` +
    `🟢 Активен: ${user.isActive ? 'Да' : 'Нет'}`
  );
}

export async function sendUserCards(ctx: BotContext, users: IUser[], header: string): Promise<void> {
  if (users.length === 0) {
    await ctx.reply('Ничего не найдено');
    return;
  }
  await ctx.reply(`${header}\nНайдено: ${users.length}`);
  const canManage = ctx.user?.role === UserRole.SUPER_ADMIN || ctx.user?.role === UserRole.ADMIN;
  for (const u of users.slice(0, 15)) {
    const keyboard = canManage ? userManagementKeyboard(u) : undefined;
    await ctx.reply(await formatUserCard(ctx, u), keyboard);
  }
  if (users.length > 15) {
    await ctx.reply(`Показаны первые 15 из ${users.length}. Уточните поиск.`);
  }
}

export async function sendAllUsers(ctx: BotContext): Promise<void> {
  const users = await ctx.userService.getAllUsers();
  await sendUserCards(ctx, users, '📋 Все пользователи');
}

export async function sendUserSearch(ctx: BotContext, query: string): Promise<void> {
  const users = await ctx.userService.searchUsers(query);
  await sendUserCards(ctx, users, `🔍 Поиск: «${query}»`);
}
