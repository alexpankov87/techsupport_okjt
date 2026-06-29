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
    [Markup.button.callback(`👤 ${w.name}`, `worker_${w.id}`)],
  );
  return Markup.inlineKeyboard(buttons);
};

export const ticketStatusKeyboard = (ticketId: string, currentStatus: TicketStatus) => {
  const statusMap: Record<TicketStatus, { emoji: string; label: string }> = {
    [TicketStatus.NEW]: { emoji: '🆕', label: 'Новая' },
    [TicketStatus.ASSIGNED]: { emoji: '📌', label: 'Назначена' },
    [TicketStatus.IN_PROGRESS]: { emoji: '🔧', label: 'В работе' },
    [TicketStatus.RESOLVED]: { emoji: '✅', label: 'Решена' },
    [TicketStatus.UNRESOLVED]: { emoji: '❌', label: 'Не решена' },
    [TicketStatus.COMPLETED]: { emoji: '🏁', label: 'Завершена' },
    [TicketStatus.CANCELLED]: { emoji: '🚫', label: 'Отменена' },
  };

  const buttons: Array<Array<ReturnType<typeof Markup.button.callback>>> = [];

  if (currentStatus === TicketStatus.ASSIGNED) {
    buttons.push([
      Markup.button.callback('🔧 Взять в работу', `status_${ticketId}_${TicketStatus.IN_PROGRESS}`),
    ]);
  }

  if (currentStatus === TicketStatus.IN_PROGRESS) {
    buttons.push([
      Markup.button.callback('✅ Решено', `status_${ticketId}_${TicketStatus.RESOLVED}`),
      Markup.button.callback('❌ Не решено', `status_${ticketId}_${TicketStatus.UNRESOLVED}`),
    ]);
  }

  if (currentStatus === TicketStatus.RESOLVED) {
    buttons.push([
      Markup.button.callback('🏁 Завершить', `status_${ticketId}_${TicketStatus.COMPLETED}`),
    ]);
  }

  buttons.push([
    Markup.button.callback('🚫 Отменить', `status_${ticketId}_${TicketStatus.CANCELLED}`),
  ]);

  return Markup.inlineKeyboard(buttons);
};

export const ticketDetailsKeyboard = (ticketId: string) => {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🔄 Обновить статус', `manage_${ticketId}`)],
    [Markup.button.callback('👤 Переназначить', `reassign_${ticketId}`)],
  ]);
};