import { TicketModel, ITicket, TicketStatus, IUser } from '../models';
import { logger } from '../utils/logger';

export interface ReportFilter {
  workerId: string;
  period: 'day' | 'week' | '1month' | '2months' | '3months' | '6months';
}

export interface TicketReport {
  number: string;
  title: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  createdAt: Date;
  resolvedAt?: Date;
  timeSpent?: string;
}

export class ReportRepository {
  async getTicketsByWorker(filter: ReportFilter): Promise<ITicket[]> {
    try {
      const now = new Date();
      let startDate: Date;

      switch (filter.period) {
        case 'day':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '1month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '2months':
          startDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
          break;
        case '3months':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case '6months':
          startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      return await TicketModel.find({
        assignedTo: filter.workerId,
        createdAt: { $gte: startDate, $lte: now },
      })
        .populate('assignedTo', 'firstName lastName')
        .sort({ createdAt: -1 });
    } catch (error) {
      logger.error('ReportRepository.getTicketsByWorker error:', error);
      throw error;
    }
  }

  async getWorkerStats(filter: ReportFilter) {
    const tickets = await this.getTicketsByWorker(filter);

    let completed = 0;
    let unresolved = 0;
    let inProgress = 0;

    tickets.forEach((t) => {
      if (t.status === TicketStatus.COMPLETED) completed++;
      else if (t.status === TicketStatus.UNRESOLVED) unresolved++;
      else if (
        t.status === TicketStatus.IN_PROGRESS ||
        t.status === TicketStatus.ASSIGNED
      ) {
        inProgress++;
      }
    });

    const avgTime = this.calculateAverageTime(tickets);

    return {
      total: tickets.length,
      completed,
      unresolved,
      inProgress,
      avgTimeMinutes: avgTime,
      tickets,
    };
  }

  private calculateAverageTime(tickets: ITicket[]): number {
    const completedTickets = tickets.filter(
      (t) => t.status === TicketStatus.COMPLETED && t.resolvedAt && t.createdAt,
    );

    if (completedTickets.length === 0) return 0;

    const totalMinutes = completedTickets.reduce((sum, t) => {
      const time = t.resolvedAt!.getTime() - t.createdAt.getTime();
      return sum + time / (1000 * 60);
    }, 0);

    return Math.round(totalMinutes / completedTickets.length);
  }
}