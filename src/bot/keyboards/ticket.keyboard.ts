import { Markup } from 'telegraf';
import { TicketStatus } from '../../models';

export const categoryKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback('🖨 Принтер/МФУ', 'category_printer')],
  [Markup.button.callback('💻 ПО/ОС', 'category_software')],
  [Markup.button.callback('🌐 Сеть', 'category_network')],
  [Markup.button.callback('🔧 Оборудование', 'category_hardware')],
  [Markup.button.callback('📎 Другое', 'category_other')],
]);

export const workersKeyboard = (workers: Array<{ id: string; name: string }>) => {
  const buttons = workers.map((w) =>
    [Markup.button.callback(w.name, `worker_${w.id}`)],
  );
  return Markup.inlineKeyboard(buttons);
};

const STATUS_TRANSITIONS: Record<TicketStatus, { label: string; status: TicketStatus }[]> = {
  [TicketStatus.NEW]:         [],
  [TicketStatus.ASSIGNED]:    [
    { label: '🔧 Взять в работу', status: TicketStatus.IN_PROGRESS },
    { label: '🚫 Отменить',       status: TicketStatus.CANCELLED },
  ],
  [TicketStatus.IN_PROGRESS]: [
    { label: '✅ Решено',    status: TicketStatus.RESOLVED },
    { label: '❌ Не решено', status: TicketStatus.UNRESOLVED },
  ],
  [TicketStatus.RESOLVED]:    [
    { label: '🏁 Завершить', status: TicketStatus.COMPLETED },
  ],
  [TicketStatus.UNRESOLVED]:  [
    { label: '🔧 Снова в работу', status: TicketStatus.IN_PROGRESS },
    { label: '🚫 Отменить',       status: TicketStatus.CANCELLED },
  ],
  [TicketStatus.COMPLETED]:   [],
  [TicketStatus.CANCELLED]:   [],
};

export const ticketStatusKeyboard = (ticketId: string, currentStatus: TicketStatus) => {
  const transitions = STATUS_TRANSITIONS[currentStatus] ?? [];

  if (transitions.length === 0) return null;

  const buttons = transitions.map(({ label, status }) =>
    [Markup.button.callback(label, `status_${ticketId}_${status}`)],
  );

  return Markup.inlineKeyboard(buttons);
};

export const ticketDetailsKeyboard = (ticketId: string) => {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🔄 Обновить статус', `manage_${ticketId}`)],
    [Markup.button.callback('👤 Переназначить',   `reassign_${ticketId}`)],
  ]);
};