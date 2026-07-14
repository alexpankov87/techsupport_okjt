import { Telegraf, Scenes, session } from 'telegraf';
import { BotContext, authMiddleware } from './middlewares/auth.middleware';
import { loggerMiddleware } from './middlewares/logger.middleware';
import { UserService, TicketService } from '../services';
import { UserRepository, TicketRepository } from '../repositories';
import { UserRole, TicketStatus, UserModel } from '../models';
import { logger } from '../utils/logger';
import { workerMainKeyboard } from './keyboards';
import { userMainKeyboard } from './keyboards/user.keyboard';
import { superAdminMainKeyboard } from './keyboards/superAdmin.keyboard';
import { adminMainKeyboard } from './keyboards/admin.keyboard';
import { ticketStatusKeyboard } from './keyboards/ticket.keyboard';
import { createTicketScene, manageTicketScene, createUserTicketScene, usersScene } from './scenes';
import { setupCallbackHandlers } from './handlers';
import { setupReportHandlers } from './handlers/report.handler';
import { setupAdminActions } from './handlers/admin.handler';
import { setupUserManagementHandlers } from './handlers/userManagement.handler';
import { formatUserPhone } from './utils/phone';
import { assigneePickerRows } from './utils/assignees';
import { sendJournalTickets } from './utils/journal';
import { journalMenuKeyboard, JOURNAL_FILTERS } from './keyboards/journal.keyboard';

export const createBot = (token: string): Telegraf<BotContext> => {
  const bot = new Telegraf<BotContext>(token);

  const userRepository = new UserRepository();
  const ticketRepository = new TicketRepository();
  const userService = new UserService(userRepository);
  const ticketService = new TicketService(ticketRepository);

  bot.context.userService = userService;
  bot.context.ticketService = ticketService;

  const stage = new Scenes.Stage<BotContext>([createTicketScene, manageTicketScene, createUserTicketScene, usersScene]);

  const backToMainMenu = async (ctx: BotContext) => {
    let user = ctx.user;
    if (!user && ctx.from) user = await UserModel.findOne({ telegramId: ctx.from.id });
    if (!user) { await ctx.reply('Главное меню', userMainKeyboard); return; }
    if (user.role === UserRole.SUPER_ADMIN) await ctx.reply('Главное меню', superAdminMainKeyboard);
    else if (user.role === UserRole.ADMIN) await ctx.reply('Главное меню', adminMainKeyboard);
    else if (user.role === UserRole.WORKER) await ctx.reply('Главное меню', workerMainKeyboard);
    else await ctx.reply('Главное меню', userMainKeyboard);
  };

  bot.context.backToMainMenu = backToMainMenu;

  // auth before stage: scene handlers need ctx.user (Telegraf runs use() in order)
  bot.use(session());
  bot.use(authMiddleware(userService));
  bot.use(loggerMiddleware);
  bot.use(stage.middleware());

  setupCallbackHandlers(bot);
  setupReportHandlers(bot);
  setupAdminActions(bot);
  setupUserManagementHandlers(bot);

  bot.command('start', async (ctx) => {
    const user = ctx.user!;
    if (user.role === UserRole.SUPER_ADMIN) await ctx.reply(`Добро пожаловать, ${user.firstName}!\nТОО "Окжетпес-Т"\nРоль: Супер-админ 👑`, superAdminMainKeyboard);
    else if (user.role === UserRole.ADMIN) await ctx.reply(`Добро пожаловать, ${user.firstName}!\nТОО "Окжетпес-Т"\nРоль: Администратор`, adminMainKeyboard);
    else if (user.role === UserRole.WORKER) await ctx.reply(`Добро пожаловать, ${user.firstName}!\nТОО "Окжетпес-Т"\nРоль: Сотрудник тех.службы`, workerMainKeyboard);
    else await ctx.reply(`Добро пожаловать, ${user.firstName}!\nТОО "Окжетпес-Т"\n\n📝 Подать заявку\n📋 Мои заявки`, userMainKeyboard);
  });

  bot.hears('🔙 Главное меню', async (ctx) => { await ctx.scene.leave(); await backToMainMenu(ctx); });
  bot.hears('📋 Новая заявка', async (ctx) => { await ctx.scene.enter('create_ticket'); });
  bot.hears('📝 Подать заявку', async (ctx) => { await ctx.scene.enter('create_user_ticket'); });

  bot.hears('📊 Журнал заявок', async (ctx) => {
    await ctx.reply(
      '📊 Журнал заявок\n\nВыберите раздел:\n• Не назначенные\n• Назначенные\n• Не взятые в работу (прошлые дни)\n• Все активные',
      journalMenuKeyboard,
    );
  });

  for (const [label, filter] of Object.entries(JOURNAL_FILTERS)) {
    bot.hears(label, async (ctx) => {
      try {
        await sendJournalTickets(ctx, filter);
      } catch (e) {
        await ctx.reply('❌ Ошибка');
      }
    });
  }

  bot.hears('✅ Выполнено сегодня', async (ctx) => {
    const user = ctx.user!;
    if (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.ADMIN && user.role !== UserRole.WORKER) {
      await ctx.reply('Недостаточно прав');
      return;
    }
    try {
      const repo = new TicketRepository();
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
      const tickets = await repo.findAll({
        status: [TicketStatus.RESOLVED],
        resolvedFrom: today,
        resolvedTo: tomorrow,
      });
      if (tickets.length === 0) { await ctx.reply('✅ Нет решённых заявок за сегодня'); return; }
      let msg = '✅ Выполнено сегодня:\n\n';
      for (const t of tickets.slice(0, 15)) {
        const w = (t.assignedTo as any)?.firstName || 'Не назначен';
        const wl = (t.assignedTo as any)?.lastName || '';
        msg += `#${t.number} - ${t.title}\n👤 ${w} ${wl}\n📞 ${ctx.ticketService.displayPhone(t)}\n🕐 ${t.resolvedAt?.toLocaleTimeString() || '—'}\n\n`;
      }
      await ctx.reply(msg);
    } catch (e) { await ctx.reply('❌ Ошибка'); }
  });

  bot.action(/^archive_ticket_(.+)$/, async (ctx) => {
    const ticketId = (ctx as any).match[1];
    try {
      const ticket = await ctx.ticketService.archiveTicket(ticketId);
      await ctx.reply(`✅ Заявка #${ticket.number} перемещена в архив`);
    } catch (e: any) { await ctx.reply(`❌ ${e.message}`); }
    await ctx.answerCbQuery();
  });

  bot.hears('📦 Архив заявок', async (ctx) => {
    try {
      // Move finished tickets older than yesterday into archive first
      await ctx.ticketService.archiveOldTickets(1);
      const repo = new TicketRepository();
      const tickets = await repo.getArchived({});
      if (tickets.length === 0) { await ctx.reply('📦 Архив пуст'); return; }
      let msg = '📦 Архив заявок:\n\n';
      for (const t of tickets.slice(0, 15)) {
        const w = (t.assignedTo as any)?.firstName || '—';
        msg += `#${t.number} - ${t.title}\n📊 ${t.status} | 📅 ${t.createdAt.toLocaleDateString()} | 👤 ${w}\n\n`;
      }
      await ctx.reply(msg);
    } catch (e) { await ctx.reply('❌ Ошибка'); }
  });

  bot.hears('🧹 Очистить завершенные', async (ctx) => {
    const user = ctx.user!;
    if (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.ADMIN) { await ctx.reply('Недостаточно прав'); return; }
    try {
      const count = await ctx.ticketService.archiveOldTickets(30);
      await ctx.reply(`✅ Архивировано завершенных: ${count}`);
    } catch (e) { await ctx.reply('❌ Ошибка'); }
  });

  bot.action(/^assign_ticket_(.+)$/, async (ctx) => {
    const ticketId = (ctx as any).match[1];
    const actors = await ctx.userService.getAssignableUsers(ctx.user);
    if (actors.length === 0) { await ctx.reply('Нет сотрудников'); await ctx.answerCbQuery(); return; }
    const repo = new TicketRepository();
    const ticket = await repo.findById(ticketId);
    const cur = (ticket as any)?.assignedTo?.firstName ? `Текущий: ${(ticket as any).assignedTo.firstName}` : 'Текущий: не назначен';
    const actorId = (ctx.user as any)?._id?.toString();
    const btns = assigneePickerRows(ticketId, actors, actorId);
    await ctx.reply(`${cur}\n\nВыберите:`, { reply_markup: { inline_keyboard: btns } });
    await ctx.answerCbQuery();
  });

  bot.action(/^do_assign_(.+)_(.+)$/, async (ctx) => {
    const [, ticketId, workerId] = (ctx as any).match;
    try {
      const ticket = await ctx.ticketService.assignTicket(ticketId, workerId);
      const worker = await ctx.userService.getUserById(workerId);
      await ctx.reply(`✅ #${ticket.number} → ${worker.firstName}`);
      await ctx.telegram.sendMessage(worker.telegramId, `🔔 Заявка #${ticket.number}\n📋 ${ticket.title}\n\nПримите в работу!`);
    } catch (e: any) { await ctx.reply(`❌ ${e.message}`); }
    await ctx.answerCbQuery();
  });

  bot.action(/^view_media_(.+)$/, async (ctx) => {
    const ticketId = (ctx as any).match[1];
    const repo = new TicketRepository();
    const ticket = await repo.findById(ticketId);
    if (ticket && (ticket as any).media?.length) {
      await ctx.reply(`📎 Вложения #${ticket.number}:`);
      for (const fid of (ticket as any).media) {
        try { await ctx.telegram.sendPhoto(ctx.chat!.id, fid).catch(() => ctx.telegram.sendVideo(ctx.chat!.id, fid).catch(() => ctx.telegram.sendVoice(ctx.chat!.id, fid).catch(() => ctx.telegram.sendAudio(ctx.chat!.id, fid).catch(() => ctx.telegram.sendDocument(ctx.chat!.id, fid))))); } catch {}
      }
    } else { await ctx.reply('Нет вложений'); }
    await ctx.answerCbQuery();
  });

  bot.hears('📋 Мои заявки', async (ctx) => {
    const user = ctx.user!;
    const isAssignee =
      user.role === UserRole.WORKER ||
      user.role === UserRole.ADMIN ||
      user.role === UserRole.SUPER_ADMIN;

    if (isAssignee) {
      const tickets = await ctx.ticketService.getActiveTicketsForWorker((user as any)._id.toString());
      if (!tickets.length) { await ctx.reply('✅ Нет активных заявок'); return; }
      for (const t of tickets) {
        const keyboard = ticketStatusKeyboard(t._id.toString(), t.status as TicketStatus);
        if (keyboard) {
          await ctx.reply(
            `📋 #${t.number} - ${t.title}\n📄 ${t.description}\n📞 ${ctx.ticketService.displayPhone(t)}\n📊 ${t.status}`,
            { reply_markup: keyboard.reply_markup },
          );
        } else {
          await ctx.reply(
            `📋 #${t.number} - ${t.title}\n📄 ${t.description}\n📞 ${ctx.ticketService.displayPhone(t)}\n📊 ${t.status}\n\nИзменение статуса недоступно.`,
          );
        }
      }
      return;
    }
    const repo = new TicketRepository();
    const tickets = await repo.findAll({ createdBy: (user as any)._id.toString() });
    if (!tickets.length) { await ctx.reply('Нет заявок'); return; }
    const emoji: Record<string, string> = { new: '🆕', assigned: '📌', in_progress: '🔧', resolved: '✅', unresolved: '❌', completed: '🏁', cancelled: '🚫' };
    let msg = '📋 Ваши заявки:\n\n';
    for (const t of tickets.slice(0, 10)) msg += `${emoji[t.status]} #${t.number} - ${t.title}\n👤 ${(t.assignedTo as any)?.firstName || 'Не назначен'}\n\n`;
    await ctx.reply(msg);
  });

  bot.hears('👥 Сотрудники', async (ctx) => {
    const w = await ctx.userService.getActiveWorkers();
    if (!w.length) { await ctx.reply('Нет сотрудников'); return; }
    let m = '👥 Сотрудники:\n\n';
    for (let i = 0; i < w.length; i++) {
      const x = w[i];
      let phone = x.phone;
      if (!phone) phone = await ctx.ticketService.getLastPhoneForUser((x as any)._id.toString());
      m += `${i + 1}. ${x.firstName} ${(x as any).lastName || ''}\n   🆔 ${x.telegramId} | 📞 ${formatUserPhone(phone)}\n   ${(x as any).department || ''}\n\n`;
    }
    await ctx.reply(m);
  });

  bot.hears('📈 Статистика', async (ctx) => {
    const s = await ctx.ticketService.getStats();
    await ctx.reply(`📈 Статистика:\n\n🆕 ${s.new}\n📌 ${s.assigned}\n🔧 ${s.inProgress}\n✅ ${s.resolved}\n🏁 ${s.completed}\n🚫 ${s.cancelled}\n📊 Всего: ${s.total}`);
  });

  bot.hears('✅ Завершенные', async (ctx) => {
    const u = ctx.user!;
    const repo = new TicketRepository();
    const t = await repo.findByAssignee((u as any)._id.toString(), [TicketStatus.RESOLVED, TicketStatus.COMPLETED]);
    if (!t.length) { await ctx.reply('Нет завершенных'); return; }
    let m = '✅ Завершенные:\n\n';
    t.slice(0, 10).forEach(x => m += `#${x.number} - ${x.title}\n${x.updatedAt.toLocaleDateString()}\n\n`);
    await ctx.reply(m);
  });

  bot.hears('📊 Моя статистика', async (ctx) => {
    const u = ctx.user!;
    const all = await ctx.ticketService.getJournal({ assignedTo: (u as any)._id.toString() });
    let a = 0, c = 0;
    all.forEach(x => { if (x.status === TicketStatus.RESOLVED || x.status === TicketStatus.COMPLETED) c++; else if (x.status !== TicketStatus.CANCELLED) a++; });
    await ctx.reply(`📊 Статистика:\n\n📋 Всего: ${all.length}\n🔧 Активных: ${a}\n✅ Завершенных: ${c}`);
  });

  logger.info('Bot handlers initialized');
  return bot;
};