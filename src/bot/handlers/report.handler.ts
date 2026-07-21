import { BotContext } from '../middlewares/auth.middleware';
import { ReportService } from '../../services/ReportService';
import { ReportRepository, ReportFilter } from '../../repositories/ReportRepository';
import { UserService } from '../../services/UserService';
import { UserRepository } from '../../repositories/UserRepository';
import { UserRole } from '../../models';
import {
  workersListKeyboard,
  reportPeriodKeyboard,
  reportFormatKeyboard,
} from '../keyboards/report.keyboard';
import { logger } from '../../utils/logger';

const VALID_PERIODS: ReportFilter['period'][] = [
  'day',
  'week',
  '1month',
  '2months',
  '3months',
  '6months',
];

const isValidPeriod = (value: string): value is ReportFilter['period'] => {
  return VALID_PERIODS.includes(value as ReportFilter['period']);
};

const getMatchData = (ctx: BotContext, pattern: RegExp): string[] | null => {
  if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) {
    return null;
  }
  const match = ctx.callbackQuery.data.match(pattern);
  return match ? match.slice(1) : null;
};

export const setupReportHandlers = (bot: any): void => {
  // Админ: команда "📊 Отчеты"
  const showReportsWorkerPicker = async (ctx: BotContext) => {
    if (ctx.user && ctx.user.role !== UserRole.SUPER_ADMIN && ctx.user.role !== UserRole.ADMIN) {
      await ctx.reply('Недостаточно прав');
      return;
    }

    try {
      const userRepo = new UserRepository();
      const userService = new UserService(userRepo);
      const workers = await userService.getActiveWorkers();

      if (workers.length === 0) {
        await ctx.reply('Нет активных сотрудников');
        return;
      }

      const workerList = workers.map((w) => ({
        id: w._id.toString(),
        name: `${w.firstName} ${w.lastName || ''}`.trim(),
      }));

      await ctx.reply('👤 Выберите сотрудника для отчета:', workersListKeyboard(workerList));
    } catch (error) {
      logger.error('Error loading workers for report:', error);
      await ctx.reply('❌ Ошибка при загрузке сотрудников');
    }
  };

  bot.hears('📊 Отчеты', async (ctx: BotContext) => {
    await showReportsWorkerPicker(ctx);
  });

  bot.command('reports', async (ctx: BotContext) => {
    await showReportsWorkerPicker(ctx);
  });

  // Выбор сотрудника
  bot.action(/^report_worker_(.+)$/, async (ctx: BotContext) => {
    const match = getMatchData(ctx, /^report_worker_(.+)$/);
    if (!match) {
      await ctx.answerCbQuery('Ошибка');
      return;
    }

    const workerId = match[0];
    (ctx as any).session = { reportWorkerId: workerId };

    await ctx.answerCbQuery();
    await ctx.reply('📅 Выберите период отчета:', reportPeriodKeyboard);
  });

  // Выбор периода
  bot.action(/^report_period_(.+)$/, async (ctx: BotContext) => {
    const match = getMatchData(ctx, /^report_period_(.+)$/);
    if (!match) {
      await ctx.answerCbQuery('Ошибка');
      return;
    }

    const period = match[0];
    const workerId = (ctx as any).session?.reportWorkerId;

    if (!workerId) {
      await ctx.answerCbQuery('Ошибка: сотрудник не выбран');
      return;
    }

    (ctx as any).session = { ...(ctx as any).session, reportPeriod: period };

    await ctx.answerCbQuery();
    await ctx.reply('📄 Выберите формат отчета:', reportFormatKeyboard(workerId, period));
  });

  // Генерация текстового отчета
  bot.action(/^report_txt_(.+)_(.+)$/, async (ctx: BotContext) => {
    const match = getMatchData(ctx, /^report_txt_(.+)_(.+)$/);
    if (!match) {
      await ctx.answerCbQuery('Ошибка');
      return;
    }

    const workerId = match[0];
    const period = match[1];

    if (!isValidPeriod(period)) {
      await ctx.answerCbQuery('Неверный период');
      return;
    }

    await ctx.answerCbQuery('Генерирую отчет...');

    try {
      const userRepo = new UserRepository();
      const userService = new UserService(userRepo);
      const reportRepo = new ReportRepository();
      const reportService = new ReportService(reportRepo, userService);

      const report = await reportService.generateReport(workerId, period);

      if (report.length > 4000) {
        const parts = report.match(/.{1,4000}/g) || [];
        for (const part of parts) {
          await ctx.reply(part);
        }
      } else {
        await ctx.reply(report);
      }
    } catch (error: any) {
      await ctx.reply(`❌ Ошибка при генерации отчета: ${error.message}`);
      logger.error('Error generating report:', error);
    }
  });

  // Генерация CSV отчета
  bot.action(/^report_csv_(.+)_(.+)$/, async (ctx: BotContext) => {
    const match = getMatchData(ctx, /^report_csv_(.+)_(.+)$/);
    if (!match) {
      await ctx.answerCbQuery('Ошибка');
      return;
    }

    const workerId = match[0];
    const period = match[1];

    if (!isValidPeriod(period)) {
      await ctx.answerCbQuery('Неверный период');
      return;
    }

    await ctx.answerCbQuery('Генерирую CSV...');

    try {
      const userRepo = new UserRepository();
      const userService = new UserService(userRepo);
      const reportRepo = new ReportRepository();
      const reportService = new ReportService(reportRepo, userService);

      const csv = await reportService.generateCSVReport(workerId, period);
      const worker = await userService.getUserById(workerId);

      const periodLabel: Record<ReportFilter['period'], string> = {
        day: '1day',
        week: '1week',
        '1month': '1month',
        '2months': '2months',
        '3months': '3months',
        '6months': '6months',
      };

      const filename = `report_${worker.lastName || worker.firstName}_${periodLabel[period]}.csv`;

      await ctx.replyWithDocument(
        {
          source: Buffer.from(csv, 'utf-8'),
          filename,
        },
        {
          caption: `📊 CSV отчет по сотруднику ${worker.firstName} ${worker.lastName || ''}`,
        },
      );
    } catch (error: any) {
      await ctx.reply(`❌ Ошибка при генерации CSV: ${error.message}`);
      logger.error('Error generating CSV:', error);
    }
  });

  // Отмена
  bot.action('report_cancel', async (ctx: BotContext) => {
    await ctx.answerCbQuery('Отменено');
    await ctx.reply('Операция отменена');
  });
};