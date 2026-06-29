import { Telegraf, Scenes, session } from 'telegraf';
import { BotContext, authMiddleware } from './middlewares/auth.middleware';
import { loggerMiddleware } from './middlewares/logger.middleware';
import { UserService, TicketService } from '../services';
import { UserRepository, TicketRepository } from '../repositories';
import { UserRole, TicketStatus } from '../models';
import { logger } from '../utils/logger';
import { workerMainKeyboard } from './keyboards';
import { userMainKeyboard } from './keyboards/user.keyboard';
import { superAdminMainKeyboard } from './keyboards/superAdmin.keyboard';
import { createTicketScene, manageTicketScene, createUserTicketScene } from './scenes';
import { setupCallbackHandlers } from './handlers';
import { setupReportHandlers } from './handlers/report.handler';
import { setupAdminActions } from './handlers/admin.handler';
import { setupUserManagementHandlers } from './handlers/userManagement.handler';

export const createBot = (token: string): Telegraf<BotContext> => {
  const bot = new Telegraf<BotContext>(token);

  // Зависимости
  const userRepository = new UserRepository();
  const ticketRepository = new TicketRepository();
  const userService = new UserService(userRepository);
  const ticketService = new TicketService(ticketRepository);

  bot.context.userService = userService;
  bot.context.ticketService = ticketService;

  // Сцены
  const stage = new Scenes.Stage<BotContext>([
    createTicketScene,
    manageTicketScene,
    createUserTicketScene,
  ]);

  // Middleware
  bot.use(session());
  bot.use(stage.middleware());
  bot.use(loggerMiddleware);
  bot.use(authMiddleware(userService));

  // Handlers
  setupCallbackHandlers(bot);
  setupReportHandlers(bot);
  setupAdminActions(bot);
  setupUserManagementHandlers(bot);

  // Вспомогательная функция для возврата в главное меню
  const backToMainMenu = async (ctx: BotContext) => {
    const user = ctx.user!;
    if (user.role === UserRole.SUPER_ADMIN) {
      await ctx.reply('Главное меню', superAdminMainKeyboard);
    } else if (user.role === UserRole.ADMIN) {
      await ctx.reply('Главное меню', {
        reply_markup: {
          keyboard: [
            ['📋 Новая заявка', '📊 Журнал заявок'],
            ['👥 Сотрудники', '📈 Статистика'],
            ['📊 Отчеты', '⚙️ Настройки'],
            ['🔙 Главное меню'],
          ],
          resize_keyboard: true,
        },
      });
    } else if (user.role === UserRole.WORKER) {
      await ctx.reply('Главное меню', workerMainKeyboard);
    } else {
      await ctx.reply('Главное меню', userMainKeyboard);
    }
  };

  // /start
  bot.command('start', async (ctx) => {
    const user = ctx.user!;

    if (user.role === UserRole.SUPER_ADMIN) {
      await ctx.reply(
        `Добро пожаловать, ${user.firstName}!\n` +
          `ТОО "Окжетпес-Т"\n` +
          `Роль: Супер-админ 👑\n\n` +
          `📋 Новая заявка — создать заявку\n` +
          `📊 Журнал заявок — просмотр всех заявок\n` +
          `👥 Пользователи — управление ролями\n` +
          `👑 Админы — список админов\n` +
          `📊 Отчеты — отчеты по сотрудникам\n` +
          `⚙️ Настройки — перезагрузка, система`,
        superAdminMainKeyboard,
      );
    } else if (user.role === UserRole.ADMIN) {
      await ctx.reply(
        `Добро пожаловать, ${user.firstName}!\n` +
          `ТОО "Окжетпес-Т"\n` +
          `Роль: Администратор\n\n` +
          `📋 Новая заявка — создать заявку\n` +
          `📊 Журнал заявок — просмотр всех заявок\n` +
          `👥 Сотрудники — список сотрудников\n` +
          `📈 Статистика — общая статистика\n` +
          `📊 Отчеты — отчеты по сотрудникам\n` +
          `⚙️ Настройки — перезагрузка, система`,
        {
          reply_markup: {
            keyboard: [
              ['📋 Новая заявка', '📊 Журнал заявок'],
              ['👥 Сотрудники', '📈 Статистика'],
              ['📊 Отчеты', '⚙️ Настройки'],
            ],
            resize_keyboard: true,
          },
        },
      );
    } else if (user.role === UserRole.WORKER) {
      await ctx.reply(
        `Добро пожаловать, ${user.firstName}!\n` +
          `ТОО "Окжетпес-Т"\n` +
          `Роль: Сотрудник тех.службы\n\n` +
          `📋 Мои заявки — активные заявки\n` +
          `✅ Завершенные — выполненные заявки\n` +
          `📊 Моя статистика — личная статистика`,
        workerMainKeyboard,
      );
    } else {
      await ctx.reply(
        `Добро пожаловать, ${user.firstName}!\n` +
          `ТОО "Окжетпес-Т"\n\n` +
          `📝 Подать заявку — сообщить о проблеме\n` +
          `📋 Мои заявки — статус моих заявок`,
        userMainKeyboard,
      );
    }
  });

  // 🔙 Главное меню — возврат в свою панель
  bot.hears('🔙 Главное меню', async (ctx) => {
    await ctx.scene.leave();
    await backToMainMenu(ctx);
  });

  // Админ/Супер-админ: Новая заявка
  bot.hears('📋 Новая заявка', async (ctx) => {
    await ctx.scene.enter('create_ticket');
  });

  // User: Подать заявку
  bot.hears('📝 Подать заявку', async (ctx) => {
    await ctx.scene.enter('create_user_ticket');
  });

  // Мои заявки (для Worker и User)
  bot.hears('📋 Мои заявки', async (ctx) => {
    const user = ctx.user!;

    if (user.role === UserRole.WORKER) {
      try {
        const tickets = await ctx.ticketService.getActiveTicketsForWorker(user._id.toString());

        if (tickets.length === 0) {
          await ctx.reply('✅ У вас нет активных заявок');
          return;
        }

        await ctx.reply(`📋 Активных заявок: ${tickets.length}`);

        for (const ticket of tickets) {
          await ctx.reply(
            `📋 Заявка #${ticket.number}\n` +
              `📝 ${ticket.title}\n` +
              `📄 ${ticket.description}\n` +
              `📊 Статус: ${ticket.status}\n` +
              `📂 Категория: ${ticket.category}`,
            {
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: '🔧 В работу', callback_data: `status_${ticket._id}_in_progress` },
                    { text: '✅ Решено', callback_data: `status_${ticket._id}_resolved` },
                  ],
                  [
                    { text: '❌ Не решено', callback_data: `status_${ticket._id}_unresolved` },
                  ],
                ],
              },
            },
          );
        }
      } catch (error) {
        logger.error('Error loading worker tickets:', error);
        await ctx.reply('❌ Ошибка при загрузке заявок');
      }
      return;
    }

    // Обычный пользователь
    try {
      const { TicketRepository } = await import('../repositories');
      const repo = new TicketRepository();
      const tickets = await repo.findAll({ createdBy: user._id.toString() });

      if (tickets.length === 0) {
        await ctx.reply('У вас пока нет заявок');
        return;
      }

      const statusEmoji: Record<string, string> = {
        new: '🆕',
        assigned: '📌',
        in_progress: '🔧',
        resolved: '✅',
        unresolved: '❌',
        completed: '🏁',
        cancelled: '🚫',
      };

      let message = '📋 Ваши заявки:\n\n';
      for (const ticket of tickets.slice(0, 10)) {
        const assignedTo = (ticket.assignedTo as any)?.firstName || 'Не назначен';
        message +=
          `${statusEmoji[ticket.status]} #${ticket.number} - ${ticket.title}\n` +
          `👤 Исполнитель: ${assignedTo}\n` +
          `📊 ${ticket.status} | ${ticket.createdAt.toLocaleDateString()}\n\n`;
      }

      await ctx.reply(message);
    } catch (error) {
      logger.error('Error loading user tickets:', error);
      await ctx.reply('❌ Ошибка при загрузке заявок');
    }
  });

  // Журнал заявок
  bot.hears('📊 Журнал заявок', async (ctx) => {
    try {
      const { TicketRepository } = await import('../repositories');
      const repo = new TicketRepository();
      const tickets = await repo.findAll({
        status: [
          TicketStatus.NEW,
          TicketStatus.ASSIGNED,
          TicketStatus.IN_PROGRESS,
          TicketStatus.RESOLVED,
          TicketStatus.UNRESOLVED,
        ],
      });

      if (tickets.length === 0) {
        await ctx.reply('📊 Нет активных заявок');
        return;
      }

      const statusEmoji: Record<string, string> = {
        new: '🆕',
        assigned: '📌',
        in_progress: '🔧',
        resolved: '✅',
        unresolved: '❌',
        completed: '🏁',
        cancelled: '🚫',
      };

      let message = '📊 Журнал заявок:\n\n';
      for (const ticket of tickets.slice(0, 10)) {
        const assignedTo = (ticket.assignedTo as any)?.firstName || 'Не назначен';
        message +=
          `${statusEmoji[ticket.status]} #${ticket.number} - ${ticket.title}\n` +
          `👤 ${assignedTo} | ${ticket.createdAt.toLocaleDateString()}\n\n`;
      }

      await ctx.reply(message);
    } catch (error) {
      logger.error('Error loading journal:', error);
      await ctx.reply('❌ Ошибка при загрузке журнала');
    }
  });

  // Сотрудники
  bot.hears('👥 Сотрудники', async (ctx) => {
    try {
      const workers = await ctx.userService.getActiveWorkers();
      if (workers.length === 0) {
        await ctx.reply('Нет активных сотрудников');
        return;
      }
      let message = '👥 Список сотрудников:\n\n';
      workers.forEach((w, i) => {
        message += `${i + 1}. ${w.firstName} ${w.lastName || ''}\n`;
        message += `   Отдел: ${w.department || 'Не указан'}\n\n`;
      });
      await ctx.reply(message);
    } catch (error) {
      logger.error('Error loading workers:', error);
      await ctx.reply('❌ Ошибка при загрузке сотрудников');
    }
  });

  // Статистика
  bot.hears('📈 Статистика', async (ctx) => {
    try {
      const stats = await ctx.ticketService.getStats();
      const message =
        '📈 Статистика заявок:\n\n' +
        `🆕 Новые: ${stats.new}\n` +
        `📌 Назначенные: ${stats.assigned}\n` +
        `🔧 В работе: ${stats.inProgress}\n` +
        `✅ Решенные: ${stats.resolved}\n` +
        `🏁 Завершенные: ${stats.completed}\n` +
        `🚫 Отмененные: ${stats.cancelled}\n` +
        `📊 Всего: ${stats.total}`;
      await ctx.reply(message);
    } catch (error) {
      logger.error('Error loading stats:', error);
      await ctx.reply('❌ Ошибка при загрузке статистики');
    }
  });

  // Worker: Завершенные
  bot.hears('✅ Завершенные', async (ctx) => {
    try {
      const user = ctx.user!;
      const { TicketRepository } = await import('../repositories');
      const repo = new TicketRepository();
      const tickets = await repo.findByAssignee(user._id.toString(), [
        TicketStatus.RESOLVED,
        TicketStatus.COMPLETED,
      ]);
      if (tickets.length === 0) {
        await ctx.reply('Нет завершенных заявок');
        return;
      }
      let message = '✅ Завершенные заявки:\n\n';
      for (const ticket of tickets.slice(0, 10)) {
        message += `#${ticket.number} - ${ticket.title}\n${ticket.updatedAt.toLocaleDateString()}\n\n`;
      }
      await ctx.reply(message);
    } catch (error) {
      logger.error('Error loading completed tickets:', error);
      await ctx.reply('❌ Ошибка при загрузке');
    }
  });

  // Worker: Моя статистика
  bot.hears('📊 Моя статистика', async (ctx) => {
    try {
      const user = ctx.user!;
      const allTickets = await ctx.ticketService.getJournal({ assignedTo: user._id.toString() });
      let active = 0;
      let completed = 0;
      allTickets.forEach((t) => {
        if (t.status === TicketStatus.RESOLVED || t.status === TicketStatus.COMPLETED) {
          completed++;
        } else if (t.status !== TicketStatus.CANCELLED) {
          active++;
        }
      });
      await ctx.reply(
        `📊 Ваша статистика:\n\n` +
          `📋 Всего заявок: ${allTickets.length}\n` +
          `🔧 Активных: ${active}\n` +
          `✅ Завершенных: ${completed}`,
      );
    } catch (error) {
      logger.error('Error loading worker stats:', error);
      await ctx.reply('❌ Ошибка при загрузке статистики');
    }
  });

  // Отмена
  bot.hears('❌ Отмена', async (ctx) => {
    await ctx.scene.leave();
    await backToMainMenu(ctx);
  });

  logger.info('Bot handlers initialized');
  return bot;
};