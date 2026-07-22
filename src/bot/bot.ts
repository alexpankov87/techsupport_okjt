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
import { sendJournalTickets, canManageJournal } from './utils/journal';
import { journalMenuKeyboard, JOURNAL_FILTERS } from './keyboards/journal.keyboard';
import { TICKET_HELP_BUTTON, TICKET_HELP_TEXT } from './utils/ticketHelp';

export const createBot = (token: string): Telegraf<BotContext> => {
  const bot = new Telegraf<BotContext>(token);

  // Don't let Telegram blips (ETIMEDOUT etc.) kill the process — Docker would restart, but users lose mid-flow.
  bot.catch((err, ctx) => {
    logger.error(`Bot error (update ${ctx?.updateType ?? '?'}):`, err);
  });

  // Telegram "Commands" menu (shown in the UI by Telegram).
  // Note: Telegram command list is global for the bot, so role-specific filtering happens in /help.
  void bot.telegram
    .setMyCommands([
      { command: 'start', description: 'Главное меню' },
      { command: 'help', description: 'Помощь по боту' },
      { command: 'apply', description: 'Подать заявку' },
      { command: 'my', description: 'Мои заявки' },
      { command: 'new', description: 'Новая заявка (для админов)' },
      { command: 'journal', description: 'Журнал заявок' },
      { command: 'archive', description: 'Архив заявок' },
      { command: 'users', description: 'Пользователи' },
      { command: 'staff', description: 'Сотрудники' },
      { command: 'stats', description: 'Статистика' },
      { command: 'today', description: 'Выполнено сегодня' },
      { command: 'done', description: 'Завершенные' },
      { command: 'reports', description: 'Отчеты (админ)' },
    ])
    .catch(() => undefined);

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
    else if (user.role === UserRole.WORKER) await ctx.reply(`Добро пожаловать, ${user.firstName}!\nТОО "Окжетпес-Т"\nРоль: Сотрудник тех.службы\n\n📝 Подать заявку\n📋 Мои заявки`, workerMainKeyboard);
    else await ctx.reply(`Добро пожаловать, ${user.firstName}!\nТОО "Окжетпес-Т"\n\n📝 Подать заявку\n📋 Мои заявки\n❓ Как подать заявку`, userMainKeyboard);
  });

  bot.hears(TICKET_HELP_BUTTON, async (ctx) => { await ctx.reply(TICKET_HELP_TEXT); });
  bot.command('help', async (ctx) => {
    const user = ctx.user;
    if (!user) {
      await ctx.reply('Нажмите /start, чтобы увидеть меню.');
      return;
    }

    if (user.role === UserRole.WORKER || user.role === UserRole.USER) {
      await ctx.reply(
        `❓ Помощь\n\n` +
        `Команды:\n` +
        `• /apply — подать заявку\n` +
        `• /my — мои заявки\n` +
        `• /done — завершенные\n` +
        `• /today — выполнено сегодня\n` +
        `• /stats — моя статистика\n\n` +
        `${TICKET_HELP_TEXT}`,
      );
      return;
    }

    if (user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN) {
      await ctx.reply(
        `❓ Помощь (админ)\n\n` +
        `Команды:\n` +
        `• /new — новая заявка\n` +
        `• /journal — журнал заявок\n` +
        `• /archive — архив заявок\n` +
        `• /users — пользователи\n` +
        `• /staff — сотрудники\n` +
        `• /reports — отчеты\n` +
        `• /stats — статистика\n\n` +
        'Также можно пользоваться кнопками внизу экрана.',
      );
      return;
    }

    await ctx.reply('Нажмите /start для главного меню.');
  });

  bot.command('apply', async (ctx) => {
    await ctx.scene.enter('create_user_ticket');
  });
  bot.command('new', async (ctx) => {
    if (!canManageJournal(ctx)) { await ctx.reply('Недостаточно прав'); return; }
    await ctx.scene.enter('create_ticket');
  });

  // /my is role-specific (для работника/админа — активные, для пользователя — заявки по createdBy)
  const showMyTickets = async (ctx: BotContext) => {
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
    const statusRu: Record<string, string> = {
      new: 'Новая',
      assigned: 'Назначена',
      in_progress: 'В работе',
      resolved: 'Решена',
      unresolved: 'Не решена',
      completed: 'Завершена',
      cancelled: 'Отменена',
    };
    let msg = '📋 Ваши заявки:\n\n';
    for (const t of tickets.slice(0, 10)) {
      const statusText = statusRu[t.status as any] || String(t.status);
      msg += `${emoji[t.status]} #${t.number} - ${t.title}\n📊 Статус: ${statusText}\n👤 ${(t.assignedTo as any)?.firstName || 'Не назначен'}\n\n`;
    }
    await ctx.reply(msg);
  };

  bot.command('my', async (ctx) => {
    await showMyTickets(ctx);
  });

  bot.command('journal', async (ctx) => {
    if (!canManageJournal(ctx)) { await ctx.reply('Недостаточно прав'); return; }
    await ctx.reply(
      '📊 Журнал заявок\n\n' +
        '• Не назначенные — взять себе или назначить работнику\n' +
        '• Назначенные — переназначить\n' +
        '• В работе — переназначить уже взятые\n' +
        '• Не взятые в работу — хвосты прошлых дней\n' +
        '• Все активные',
      journalMenuKeyboard,
    );
  });

  bot.command('archive', async (ctx) => {
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
    } catch {
      await ctx.reply('❌ Ошибка');
    }
  });

  bot.command('users', async (ctx) => {
    if (!ctx.user) { await ctx.reply('Нажмите /start'); return; }
    if (ctx.user.role !== UserRole.SUPER_ADMIN && ctx.user.role !== UserRole.ADMIN) { await ctx.reply('Недостаточно прав'); return; }
    await ctx.scene.enter('users');
  });

  bot.command('staff', async (ctx) => {
    if (!canManageJournal(ctx)) { await ctx.reply('Недостаточно прав'); return; }
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

  bot.command('stats', async (ctx) => {
    const u = ctx.user;
    if (!u) { await ctx.reply('Нажмите /start'); return; }
    if (u.role !== UserRole.SUPER_ADMIN && u.role !== UserRole.ADMIN && u.role !== UserRole.WORKER) {
      await ctx.reply('Недостаточно прав');
      return;
    }
    const s = await ctx.ticketService.getStats();
    await ctx.reply(`📈 Статистика:\n\n🆕 ${s.new}\n📌 ${s.assigned}\n🔧 ${s.inProgress}\n✅ ${s.resolved}\n🏁 ${s.completed}\n🚫 ${s.cancelled}\n📊 Всего: ${s.total}`);
  });

  bot.command('today', async (ctx) => {
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
    } catch {
      await ctx.reply('❌ Ошибка');
    }
  });

  bot.command('done', async (ctx) => {
    const u = ctx.user!;
    const repo = new TicketRepository();
    const t = await repo.findByAssignee((u as any)._id.toString(), [TicketStatus.RESOLVED, TicketStatus.COMPLETED]);
    if (!t.length) { await ctx.reply('Нет завершенных'); return; }
    let m = '✅ Завершенные:\n\n';
    t.slice(0, 10).forEach(x => m += `#${x.number} - ${x.title}\n${x.updatedAt.toLocaleDateString()}\n\n`);
    await ctx.reply(m);
  });

  bot.hears('🔙 Главное меню', async (ctx) => { await ctx.scene.leave(); await backToMainMenu(ctx); });
  bot.hears('📋 Новая заявка', async (ctx) => { await ctx.scene.enter('create_ticket'); });
  bot.hears('📝 Подать заявку', async (ctx) => { await ctx.scene.enter('create_user_ticket'); });

  bot.hears('📊 Журнал заявок', async (ctx) => {
    if (!canManageJournal(ctx)) { await ctx.reply('Недостаточно прав'); return; }
    await ctx.reply(
      '📊 Журнал заявок\n\n' +
        '• Не назначенные — взять себе или назначить работнику\n' +
        '• Назначенные — переназначить\n' +
        '• В работе — переназначить уже взятые\n' +
        '• Не взятые в работу — хвосты прошлых дней\n' +
        '• Все активные',
      journalMenuKeyboard,
    );
  });

  for (const [label, filter] of Object.entries(JOURNAL_FILTERS)) {
    bot.hears(label, async (ctx) => {
      if (!canManageJournal(ctx)) { await ctx.reply('Недостаточно прав'); return; }
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
    if (!canManageJournal(ctx)) { await ctx.answerCbQuery('Недостаточно прав'); return; }
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

  bot.action(/^claim_ticket_(.+)$/, async (ctx) => {
    if (!canManageJournal(ctx)) { await ctx.answerCbQuery('Недостаточно прав'); return; }
    const ticketId = (ctx as any).match[1];
    const adminId = (ctx.user as any)?._id?.toString();
    if (!adminId) { await ctx.answerCbQuery('Ошибка'); return; }
    try {
      const ticket = await ctx.ticketService.claimTicket(ticketId, adminId);
      await ctx.reply(`✅ #${ticket.number} → вы (${ctx.user!.firstName}), статус: в работе\nОткройте 📋 Мои заявки`);

      // Notify ticket creator that it is now "in progress" (assigned->claimed)
      const full = await ctx.ticketService.getTicketById(ticketId);
      const creator = full.createdBy as any;
      const creatorId =
        creator?._id?.toString?.() ??
        creator?._id ??
        creator?.toString?.() ??
        undefined;
      if (creatorId) {
        const { UserModel } = await import('../models');
        const creatorUser = await UserModel.findById(creatorId).select('telegramId');
        if (creatorUser?.telegramId) {
          await ctx.telegram
            .sendMessage(
              creatorUser.telegramId,
              `📣 Вашу заявку взяли в работу\n📋 #${ticket.number} - ${ticket.title}\n📊 В работе\n👤 Исполнитель: ${ctx.user!.firstName}`,
            )
            .catch(() => undefined);
        }
      }
    } catch (e: any) { await ctx.reply(`❌ ${e.message}`); }
    await ctx.answerCbQuery();
  });

  bot.action(/^assign_ticket_(.+)$/, async (ctx) => {
    if (!canManageJournal(ctx)) { await ctx.answerCbQuery('Недостаточно прав'); return; }
    const ticketId = (ctx as any).match[1];
    const actors = await ctx.userService.getAssignableUsers(ctx.user);
    if (actors.length === 0) { await ctx.reply('Нет сотрудников'); await ctx.answerCbQuery(); return; }
    const repo = new TicketRepository();
    const ticket = await repo.findById(ticketId);
    const cur = (ticket as any)?.assignedTo?.firstName ? `Текущий: ${(ticket as any).assignedTo.firstName}` : 'Текущий: не назначен';
    const actorId = (ctx.user as any)?._id?.toString();
    const btns = assigneePickerRows(ticketId, actors, actorId);
    await ctx.reply(`${cur}\n\nНазначить на себя или работника:`, { reply_markup: { inline_keyboard: btns } });
    await ctx.answerCbQuery();
  });

  bot.action(/^do_assign_(.+)_(.+)$/, async (ctx) => {
    if (!canManageJournal(ctx)) { await ctx.answerCbQuery('Недостаточно прав'); return; }
    const [, ticketId, workerId] = (ctx as any).match;
    try {
      const selfId = (ctx.user as any)?._id?.toString();
      const takeSelf = selfId === workerId;
      const ticket = await ctx.ticketService.assignTicket(ticketId, workerId, takeSelf);
      const worker = await ctx.userService.getUserById(workerId);
      const note = takeSelf ? ', статус: в работе' : ', статус: назначена';
      await ctx.reply(`✅ #${ticket.number} → ${worker.firstName}${note}`);

      // Notify ticket creator about "assigned" or "in progress"
      const full = await ctx.ticketService.getTicketById(ticketId);
      const creator = full.createdBy as any;
      const creatorId =
        creator?._id?.toString?.() ??
        creator?._id ??
        creator?.toString?.() ??
        undefined;
      if (creatorId) {
        const { UserModel } = await import('../models');
        const creatorUser = await UserModel.findById(creatorId).select('telegramId');
        if (creatorUser?.telegramId) {
          const statusText = takeSelf ? 'В работе' : 'Назначена';
          const extra = takeSelf ? `\n👤 Исполнитель: ${worker.firstName}` : `\n👤 Исполнитель: ${worker.firstName}`;
          await ctx.telegram
            .sendMessage(
              creatorUser.telegramId,
              `📣 Вашу заявку изменили статус\n📋 #${ticket.number} - ${ticket.title}\n📊 ${statusText}${extra}`,
            )
            .catch(() => undefined);
        }
      }
      if (!takeSelf) {
        await ctx.telegram.sendMessage(worker.telegramId, `🔔 Заявка #${ticket.number}\n📋 ${ticket.title}\n\nПримите в работу!`);
      }
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

  bot.hears('📋 Мои заявки', async (ctx) => { await showMyTickets(ctx); });

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

  // Unmatched free text (outside scenes): nudge to menu / apply — last so hears/commands win first
  bot.on('text', async (ctx) => {
    if (ctx.scene?.current) return;
    await ctx.reply('Не понял сообщение.\n\nНажмите /start для меню или «📝 Подать заявку».');
  });

  logger.info('Bot handlers initialized');
  return bot;
};