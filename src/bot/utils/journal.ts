import { BotContext } from '../middlewares/auth.middleware';
import { ITicket, TicketStatus, UserRole } from '../../models';
import { TicketRepository } from '../../repositories';

const EMOJI: Record<string, string> = {
  new: '🆕', assigned: '📌', in_progress: '🔧', resolved: '✅',
  unresolved: '❌', completed: '🏁', cancelled: '🚫',
};

export function canManageJournal(ctx: BotContext): boolean {
  const role = ctx.user?.role;
  return role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN;
}

export async function sendJournalTickets(
  ctx: BotContext,
  opts: { title: string; status: TicketStatus[]; beforeToday?: boolean },
): Promise<void> {
  const repo = new TicketRepository();
  const filters: { status: TicketStatus[]; dateTo?: Date } = { status: opts.status };
  if (opts.beforeToday) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    filters.dateTo = today;
  }

  const tickets = await repo.findAll(filters);
  if (tickets.length === 0) {
    await ctx.reply(`${opts.title}\n\nПусто`);
    return;
  }

  const manage = canManageJournal(ctx);
  await ctx.reply(`${opts.title}\nНайдено: ${tickets.length}`);
  for (const ticket of tickets.slice(0, 15)) {
    await ctx.reply(formatJournalCard(ctx, ticket), {
      reply_markup: { inline_keyboard: journalActions(ticket, manage) },
    });
  }
  if (tickets.length > 15) {
    await ctx.reply(`Показаны первые 15 из ${tickets.length}`);
  }
}

function formatJournalCard(ctx: BotContext, ticket: ITicket): string {
  const a = (ticket.assignedTo as any)?.firstName || 'Не назначен';
  const al = (ticket.assignedTo as any)?.lastName || '';
  const an = a !== 'Не назначен' ? `${a} ${al}`.trim() : a;
  return (
    `${EMOJI[ticket.status] || '📋'} #${ticket.number} - ${ticket.title}\n` +
    `👤 ${an}\n` +
    `📅 ${ticket.createdAt.toLocaleDateString()}\n` +
    `📞 ${ctx.ticketService.displayPhone(ticket)}\n` +
    `📊 ${ticket.status}`
  );
}

function journalActions(ticket: ITicket, canManage: boolean) {
  const id = ticket._id.toString();
  const btns: Array<Array<{ text: string; callback_data: string }>> = [];

  if (canManage) {
    const unassigned = ticket.status === TicketStatus.NEW || !(ticket as any).assignedTo;
    const claimLabel = unassigned ? '🙋 Взять себе' : '🙋 На себя';
    btns.push([
      { text: claimLabel, callback_data: `claim_ticket_${id}` },
      { text: '👤 Назначить/Переназначить', callback_data: `assign_ticket_${id}` },
    ]);
  }

  if ((ticket as any).media?.length) {
    btns.push([{ text: '📎 Вложения', callback_data: `view_media_${id}` }]);
  }
  if (canManage) {
    btns.push([{ text: '📦 В архив', callback_data: `archive_ticket_${id}` }]);
  }
  return btns;
}
