import { TicketRepository, TicketFilters } from '../repositories';
import { ITicket, TicketStatus, TicketCategory } from '../models';
import { ValidationError, TicketStatusError, NotFoundError } from '../utils/errors';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';

export class TicketService {
  constructor(private readonly ticketRepository: TicketRepository) {}

  async createTicket(
    title: string, description: string, category: string,
    createdBy: string, assignedTo?: string, phone?: string, media?: string[],
  ): Promise<ITicket> {
    if (!title || !description || !category) throw new ValidationError('Заполните все обязательные поля');
    if (!Object.values(TicketCategory).includes(category as TicketCategory)) throw new ValidationError('Неверная категория');
    return await this.ticketRepository.create({
      title, description, category: category as TicketCategory,
      createdBy: new mongoose.Types.ObjectId(createdBy),
      assignedTo: assignedTo ? new mongoose.Types.ObjectId(assignedTo) : undefined,
      phone, media,
    });
  }

  async getTicketById(id: string): Promise<ITicket> {
    const ticket = await this.ticketRepository.findById(id);
    if (!ticket) throw new NotFoundError('Заявка не найдена');
    return ticket;
  }

  async getActiveTicketsForWorker(workerId: string): Promise<ITicket[]> {
    return await this.ticketRepository.findByAssignee(workerId, [TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS]);
  }

  async getJournal(filters?: TicketFilters): Promise<ITicket[]> {
    return await this.ticketRepository.findAll(filters);
  }

  async getArchived(filters?: TicketFilters): Promise<ITicket[]> {
    return await this.ticketRepository.getArchived(filters);
  }

  async updateStatus(ticketId: string, newStatus: TicketStatus, workerId: string): Promise<ITicket> {
    const ticket = await this.getTicketById(ticketId);
    if (!ticket.assignedTo) {
      if (newStatus === TicketStatus.CANCELLED) return await this.ticketRepository.updateStatus(ticketId, newStatus);
      throw new ValidationError('Заявка не назначена исполнителю.');
    }
    if (ticket.assignedTo.toString() !== workerId) throw new ValidationError('Вы не можете менять статус этой заявки.');
    const transitions: Record<TicketStatus, TicketStatus[]> = {
      [TicketStatus.NEW]: [TicketStatus.ASSIGNED, TicketStatus.CANCELLED],
      [TicketStatus.ASSIGNED]: [TicketStatus.IN_PROGRESS, TicketStatus.CANCELLED],
      [TicketStatus.IN_PROGRESS]: [TicketStatus.RESOLVED, TicketStatus.UNRESOLVED],
      [TicketStatus.RESOLVED]: [TicketStatus.COMPLETED],
      [TicketStatus.UNRESOLVED]: [TicketStatus.IN_PROGRESS, TicketStatus.CANCELLED],
      [TicketStatus.COMPLETED]: [],
      [TicketStatus.CANCELLED]: [],
    };
    if (!transitions[ticket.status as TicketStatus]?.includes(newStatus)) {
      throw new TicketStatusError(`Нельзя перевести из "${ticket.status}" в "${newStatus}"`);
    }
    return await this.ticketRepository.updateStatus(ticketId, newStatus);
  }

  async assignTicket(ticketId: string, workerId: string): Promise<ITicket> {
    return await this.ticketRepository.assignTicket(ticketId, workerId);
  }

  async getStats() {
    return await this.ticketRepository.getStats();
  }

  async archiveOldTickets(daysOld: number = 30): Promise<number> {
    return await this.ticketRepository.archiveCompleted(daysOld);
  }

  async archiveTicket(id: string): Promise<ITicket> {
    return await this.ticketRepository.archiveOne(id);
  }

  async archiveOldOpen(daysOld: number = 2): Promise<number> {
    return await this.ticketRepository.archiveOldOpen(daysOld);
  }

  async deleteOldArchived(daysOld: number = 30): Promise<number> {
    return await this.ticketRepository.deleteOldArchived(daysOld);
  }
}