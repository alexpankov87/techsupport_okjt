import { Markup } from 'telegraf';

export const superAdminMainKeyboard = Markup.keyboard([
  ['📋 Новая заявка', '📊 Журнал заявок'],
  ['✅ Выполнено сегодня', '📦 Архив заявок'],
  ['👥 Пользователи', '👑 Админы'],
  ['📋 Мои заявки', '📈 Статистика'],
  ['📊 Отчеты', '⚙️ Настройки'],
  ['🧹 Очистить завершенные'],
]).resize();

export const userManagementKeyboard = (user: any) =>
  Markup.inlineKeyboard([
    [
      Markup.button.callback('👑 Назначить админом', `promote_admin_${user._id}`),
      Markup.button.callback('🔧 Назначить работником', `assign_worker_${user._id}`),
    ],
    [Markup.button.callback('🚫 Деактивировать', `deactivate_${user._id}`)],
  ]);