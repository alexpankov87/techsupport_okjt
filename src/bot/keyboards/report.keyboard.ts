import { Markup } from 'telegraf';

export const reportPeriodKeyboard = Markup.inlineKeyboard([
  [
    Markup.button.callback('📅 1 день', 'report_period_day'),
    Markup.button.callback('📅 Неделя', 'report_period_week'),
  ],
  [
    Markup.button.callback('📅 1 месяц', 'report_period_1month'),
    Markup.button.callback('📅 2 месяца', 'report_period_2months'),
  ],
  [
    Markup.button.callback('📅 3 месяца', 'report_period_3months'),
    Markup.button.callback('📅 6 месяцев', 'report_period_6months'),
  ],
  [Markup.button.callback('❌ Отмена', 'report_cancel')],
]);

export const reportFormatKeyboard = (workerId: string, period: string) =>
  Markup.inlineKeyboard([
    [
      Markup.button.callback('📄 Текстовый отчет', `report_txt_${workerId}_${period}`),
      Markup.button.callback('📊 CSV файл', `report_csv_${workerId}_${period}`),
    ],
    [Markup.button.callback('❌ Отмена', 'report_cancel')],
  ]);

export const workersListKeyboard = (workers: Array<{ id: string; name: string }>) => {
  const buttons = workers.map((w) => [
    Markup.button.callback(`👤 ${w.name}`, `report_worker_${w.id}`),
  ]);
  buttons.push([Markup.button.callback('❌ Отмена', 'report_cancel')]);
  return Markup.inlineKeyboard(buttons);
};

export const adminSettingsKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback('🔄 Перезагрузить бота', 'admin_reboot')],
  [Markup.button.callback('📊 Статистика системы', 'admin_sysinfo')],
]);