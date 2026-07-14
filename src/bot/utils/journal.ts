import { BotContext } from '../middlewares/auth.middleware';
import { ITicket, TicketStatus } from '../../models';
import { TicketRepository } from '../../repositories';

const EMOJI: Record<string, string> = {
  new: '🆕', assigned: '📌', in_progress: '🔧', resolved: '✅',
  unresolved: '❌', completed: '🏁', cancelled: '🚫',
};

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

  await ctx.reply(`${opts.title}\nНайдено: ${tickets.length}`);
  for (const ticket of tickets.slice(0, 15)) {
    await ctx.reply(formatJournalCard(ctx, ticket), {
      reply_markup: { inline_keyboard: journalActions(ticket) },
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

function journalActions(ticket: ITicket) {
  const btns: Array<Array<{ text: string; callback_data: string }>> = [
    [{ text: '👤 Назначить/Переназначить', callback_data: `assign_ticket_${ticket._id}` }],
  ];
  if ((ticket as any).media?.length) {
    btns.push([{ text: '📎 Вложения', callback_data: `view_media_${ticket._id}` }]);
  }
  btns.push([{ text: '📦 В архив', callback_data: `archive_ticket_${ticket._id}` }]);
  return btns;
}
