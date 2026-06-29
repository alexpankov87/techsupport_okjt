import { TicketRepository, TicketFilters } from '../repositories';
import { ITicket, TicketStatus, TicketCategory } from '../models';
import { ValidationError, TicketStatusError, NotFoundError } from '../utils/errors';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';

export class TicketService {
  constructor(private readonly ticketRepository: TicketRepository) {}

  async createTicket(
    title: string,
    description: string,
    category: string,
    createdBy: string,
    assignedTo?: string,
  ): Promise<ITicket> {
    if (!title || !description || !category) {
      throw new ValidationError('Заполните все обязательные поля');
    }

    if (!Object.values(TicketCategory).includes(category as TicketCategory)) {
      throw new ValidationError('Неверная категория заявки');
    }

    const ticket = await this.ticketRepository.create({
      title,
      description,
      category: category as TicketCategory,
      createdBy: new mongoose.Types.ObjectId(createdBy),
      assignedTo: assignedTo ? new mongoose.Types.ObjectId(assignedTo) : undefined,
    });

    logger.info(`Ticket created: ${ticket.number}`);
    return ticket;
  }

  async getTicketById(id: string): Promise<ITicket> {
    const ticket = await this.ticketRepository.findById(id);

    if (!ticket) {
      throw new NotFoundError('Заявка не найдена');
    }

    return ticket;
  }

  async getActiveTicketsForWorker(workerId: string): Promise<ITicket[]> {
    return await this.ticketRepository.findByAssignee(workerId, [
      TicketStatus.ASSIGNED,
      TicketStatus.IN_PROGRESS,
    ]);
  }

  async getJournal(filters?: TicketFilters): Promise<ITicket[]> {
    return await this.ticketRepository.findAll(filters);
  }

  async updateStatus(
    ticketId: string,
    newStatus: TicketStatus,
    workerId: string,
  ): Promise<ITicket> {
    const ticket = await this.getTicketById(ticketId);

    if (ticket.assignedTo?.toString() !== workerId) {
      throw new ValidationError('Вы не можете менять статус этой заявки');
    }

    const allowedTransitions: Record<TicketStatus, TicketStatus[]> = {
      [TicketStatus.NEW]: [TicketStatus.ASSIGNED, TicketStatus.CANCELLED],
      [TicketStatus.ASSIGNED]: [TicketStatus.IN_PROGRESS, TicketStatus.CANCELLED],
      [TicketStatus.IN_PROGRESS]: [TicketStatus.RESOLVED, TicketStatus.UNRESOLVED],
      [TicketStatus.RESOLVED]: [TicketStatus.COMPLETED],
      [TicketStatus.UNRESOLVED]: [TicketStatus.IN_PROGRESS, TicketStatus.CANCELLED],
      [TicketStatus.COMPLETED]: [],
      [TicketStatus.CANCELLED]: [],
    };

    const currentStatus = ticket.status as TicketStatus;

    if (!allowedTransitions[currentStatus]?.includes(newStatus)) {
      throw new TicketStatusError(
        `Нельзя перевести заявку из статуса "${currentStatus}" в "${newStatus}"`,
      );
    }

    const updated = await this.ticketRepository.updateStatus(ticketId, newStatus);
    logger.info(`Ticket ${ticket.number} status changed: ${currentStatus} -> ${newStatus}`);
    return updated;
  }

  async assignTicket(ticketId: string, workerId: string): Promise<ITicket> {
    const ticket = await this.ticketRepository.assignTicket(ticketId, workerId);
    logger.info(`Ticket ${ticket.number} assigned to worker ${workerId}`);
    return ticket;
  }

  async getStats() {
    return await this.ticketRepository.getStats();
  }
}