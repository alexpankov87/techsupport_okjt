import { TicketRepository, TicketFilters } from '../repositories';
import { ITicket, TicketStatus, TicketCategory } from '../models';
import { ValidationError, TicketStatusError, NotFoundError } from '../utils/errors';
import { logger } from '../utils/logger';
import { isValidPhone, pickPhone } from '../utils/phone';
import mongoose from 'mongoose';

function requireObjectId(raw: string, label: string): mongoose.Types.ObjectId {
  if (!/^[a-fA-F0-9]{24}$/.test((raw || '').trim())) {
    throw new ValidationError(`Некорректный ${label}`);
  }
  return new mongoose.Types.ObjectId(raw.trim());
}

export class TicketService {
  constructor(private readonly ticketRepository: TicketRepository) {}

  async createTicket(
    title: string, description: string, category: string,
    createdBy: string, assignedTo?: string, phone?: string, media?: string[],
  ): Promise<ITicket> {
    if (!title || !description || !category) throw new ValidationError('Заполните все обязательные поля');
    if (!Object.values(TicketCategory).includes(category as TicketCategory)) throw new ValidationError('Неверная категория');
    const normalizedPhone = isValidPhone(phone) ? phone!.trim() : undefined;
    return await this.ticketRepository.create({
      title, description, category: category as TicketCategory,
      createdBy: requireObjectId(createdBy, 'создатель'),
      assignedTo: assignedTo ? requireObjectId(assignedTo, 'исполнитель') : undefined,
      phone: normalizedPhone, media,
    });
  }

  displayPhone(ticket: ITicket): string {
    const creator = ticket.createdBy as any;
    const userPhone = typeof creator === 'object' ? creator?.phone : undefined;
    return pickPhone(ticket.phone, userPhone);
  }

  async fixInvalidTicketPhones(): Promise<number> {
    const { UserModel } = await import('../models');
    const tickets = await this.ticketRepository.findAll({});
    let fixed = 0;
    for (const ticket of tickets) {
      if (isValidPhone(ticket.phone)) continue;
      const creator = ticket.createdBy as any;
      const userId = (creator?._id ?? creator)?.toString();
      if (!userId) continue;
      const user = await UserModel.findById(userId);
      let replacement: string | undefined;
      if (isValidPhone(user?.phone)) replacement = user!.phone!.trim();
      if (!replacement) replacement = await this.ticketRepository.findLastPhoneByCreator(userId);
      if (!replacement) {
        await this.ticketRepository.updatePhone(ticket._id.toString());
        fixed++;
        continue;
      }
      await this.ticketRepository.updatePhone(ticket._id.toString(), replacement);
      fixed++;
    }
    return fixed;
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

  async getLastPhoneForUser(userId: string): Promise<string | undefined> {
    return this.ticketRepository.findLastPhoneByCreator(userId);
  }

  async getArchived(filters?: TicketFilters): Promise<ITicket[]> {
    return await this.ticketRepository.getArchived(filters);
  }

  async updateStatus(ticketId: string, newStatus: TicketStatus, workerId: string): Promise<ITicket> {
    const ticket = await this.getTicketById(ticketId);

    if (!ticket.assignedTo) {
      if (newStatus === TicketStatus.CANCELLED) {
        return await this.ticketRepository.updateStatus(ticketId, newStatus);
      }
      throw new ValidationError('Заявка не назначена исполнителю.');
    }

    if (!workerId) {
      throw new ValidationError('Не удалось определить ID работника.');
    }

    // Работает независимо от того, populated поле или нет
    const assignedToId = ticket.assignedTo instanceof mongoose.Types.ObjectId
      ? ticket.assignedTo
      : (ticket.assignedTo as any)._id;

    if (!assignedToId || !new mongoose.Types.ObjectId(workerId).equals(assignedToId)) {
      throw new ValidationError('Вы не можете менять статус этой заявки.');
    }

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

  async assignTicket(ticketId: string, workerId: string, takeInProgress = false): Promise<ITicket> {
    return await this.ticketRepository.assignTicket(ticketId, workerId, takeInProgress);
  }

  /** Admin claims ticket for self and takes it into work. */
  async claimTicket(ticketId: string, adminId: string): Promise<ITicket> {
    return this.assignTicket(ticketId, adminId, true);
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

  async archiveOldOpen(daysOld: number = 7): Promise<number> {
    return await this.ticketRepository.archiveOldOpen(daysOld);
  }

  async deleteOldArchived(daysOld: number = 30): Promise<number> {
    return await this.ticketRepository.deleteOldArchived(daysOld);
  }
}