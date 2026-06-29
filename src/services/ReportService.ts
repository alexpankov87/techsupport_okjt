import { ReportRepository, ReportFilter } from '../repositories/ReportRepository';
import { UserService } from './UserService';
import { NotFoundError } from '../utils/errors';
import { logger } from '../utils/logger';

export class ReportService {
  constructor(
    private readonly reportRepository: ReportRepository,
    private readonly userService: UserService,
  ) {}

  async generateReport(workerId: string, period: ReportFilter['period']): Promise<string> {
    const worker = await this.userService.getUserById(workerId);

    const stats = await this.reportRepository.getWorkerStats({
      workerId,
      period,
    });

    const periodLabel: Record<string, string> = {
      day: '1 день',
      week: '7 дней',
      '1month': '1 месяц',
      '2months': '2 месяца',
      '3months': '3 месяца',
      '6months': '6 месяцев',
    };

    const avgHours = Math.floor(stats.avgTimeMinutes / 60);
    const avgMinutes = stats.avgTimeMinutes % 60;

    let report = `📊 Отчет по сотруднику\n\n`;
    report += `👤 ${worker.firstName} ${worker.lastName || ''}\n`;
    report += `📅 Период: ${periodLabel[period]}\n`;
    report += `──────────────────\n`;
    report += `📋 Всего заявок: ${stats.total}\n`;
    report += `✅ Завершено: ${stats.completed}\n`;
    report += `❌ Не решено: ${stats.unresolved}\n`;
    report += `🔧 В работе: ${stats.inProgress}\n`;
    report += `⏱ Среднее время: ${avgHours}ч ${avgMinutes}мин\n`;
    report += `──────────────────\n\n`;

    if (stats.tickets.length > 0) {
      report += `📋 Список заявок:\n\n`;
      stats.tickets.forEach((ticket, index) => {
        const statusEmoji: Record<string, string> = {
          new: '🆕',
          assigned: '📌',
          in_progress: '🔧',
          resolved: '✅',
          unresolved: '❌',
          completed: '🏁',
          cancelled: '🚫',
        };

        report += `${index + 1}. ${statusEmoji[ticket.status]} ${ticket.number} - ${ticket.title}\n`;
        report += `   📂 ${ticket.category} | 📅 ${ticket.createdAt.toLocaleDateString()}\n`;

        if (ticket.resolvedAt) {
          const time = Math.round(
            (ticket.resolvedAt.getTime() - ticket.createdAt.getTime()) / (1000 * 60),
          );
          const hours = Math.floor(time / 60);
          const minutes = time % 60;
          report += `   ⏱ Время выполнения: ${hours}ч ${minutes}мин\n`;
        }
        report += `\n`;
      });
    }

    return report;
  }

  async generateCSVReport(workerId: string, period: ReportFilter['period']): Promise<string> {
    const worker = await this.userService.getUserById(workerId);
    const stats = await this.reportRepository.getWorkerStats({ workerId, period });

    let csv = 'Номер,Название,Описание,Категория,Статус,Приоритет,Создана,Завершена\n';

    stats.tickets.forEach((ticket) => {
      csv += `"${ticket.number}",`;
      csv += `"${ticket.title}",`;
      csv += `"${(ticket.description || '').replace(/"/g, '""')}",`;
      csv += `"${ticket.category}",`;
      csv += `"${ticket.status}",`;
      csv += `"${ticket.priority}",`;
      csv += `"${ticket.createdAt.toISOString()}",`;
      csv += `"${ticket.resolvedAt ? ticket.resolvedAt.toISOString() : ''}"\n`;
    });

    return csv;
  }
}