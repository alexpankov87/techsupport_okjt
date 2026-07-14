import { Markup } from 'telegraf';
import { TicketStatus } from '../../models';

export const journalMenuKeyboard = Markup.keyboard([
  ['🆕 Не назначенные', '📌 Назначенные'],
  ['⏳ Не взятые в работу', '📋 Все активные'],
  ['🔙 Главное меню'],
]).resize();

export const JOURNAL_FILTERS: Record<string, {
  title: string;
  status: TicketStatus[];
  beforeToday?: boolean;
}> = {
  '🆕 Не назначенные': {
    title: '🆕 Не назначенные',
    status: [TicketStatus.NEW],
  },
  '📌 Назначенные': {
    title: '📌 Назначенные',
    status: [TicketStatus.ASSIGNED],
  },
  '⏳ Не взятые в работу': {
    title: '⏳ Не взятые в работу (прошлые дни)',
    status: [TicketStatus.NEW, TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS, TicketStatus.UNRESOLVED],
    beforeToday: true,
  },
  '📋 Все активные': {
    title: '📋 Все активные заявки',
    status: [TicketStatus.NEW, TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS, TicketStatus.UNRESOLVED],
  },
};
