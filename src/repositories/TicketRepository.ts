import mongoose from 'mongoose';
import { TicketModel, ITicket, TicketStatus } from '../models';
import { NotFoundError } from '../utils/errors';
import { logger } from '../utils/logger';
import { isValidPhone } from '../utils/phone';

export interface TicketFilters {
  status?: TicketStatus[];
  assignedTo?: string;
  createdBy?: string;
  category?: string;
  dateFrom?: Date;
  dateTo?: Date;
  resolvedFrom?: Date;
  resolvedTo?: Date;
  archived?: boolean;
}

export interface TicketStats {
  total: number;
  new: number;
  assigned: number;
  inProgress: number;
  resolved: number;
  completed: number;
  cancelled: number;
}

export class TicketRepository {
  async findById(id: string): Promise<ITicket | null> {
    return await TicketModel.findById(id)
      .populate('createdBy', 'firstName lastName phone')
      .populate('assignedTo', 'firstName lastName');
  }

  async findByNumber(number: string): Promise<ITicket | null> {
    return await TicketModel.findOne({ number })
      .populate('createdBy', 'firstName lastName phone')
      .populate('assignedTo', 'firstName lastName');
  }

  async findLastPhoneByCreator(userId: string): Promise<string | undefined> {
    const tickets = await TicketModel.find({
      createdBy: new mongoose.Types.ObjectId(userId),
      phone: { $exists: true, $nin: [null, ''] },
    })
      .sort({ createdAt: -1 })
      .select('phone')
      .limit(15);
    for (const ticket of tickets) {
      const phone = ticket.phone?.trim();
      if (isValidPhone(phone)) return phone;
    }
    return undefined;
  }

  async updatePhone(id: string, phone?: string): Promise<ITicket> {
    const update = phone ? { $set: { phone } } : { $unset: { phone: 1 } };
    const ticket = await TicketModel.findByIdAndUpdate(id, update, { returnDocument: 'after' });
    if (!ticket) throw new NotFoundError('Заявка не найдена');
    return ticket;
  }

  async findByAssignee(userId: string, status?: TicketStatus[]): Promise<ITicket[]> {
    const query: any = { assignedTo: new mongoose.Types.ObjectId(userId), archived: { $ne: true } };
    if (status && status.length > 0) query.status = { $in: status };
    return await TicketModel.find(query).populate('createdBy', 'firstName lastName').sort({ createdAt: -1 });
  }

  async findAll(filters?: TicketFilters): Promise<ITicket[]> {
    const query: any = {};
    query.archived = filters?.archived === true ? true : { $ne: true };

    if (filters?.status && filters.status.length > 0) query.status = { $in: filters.status };
    if (filters?.assignedTo) query.assignedTo = new mongoose.Types.ObjectId(filters.assignedTo);
    if (filters?.category) query.category = filters.category;
    if (filters?.createdBy) query.createdBy = new mongoose.Types.ObjectId(filters.createdBy);
    if (filters?.dateFrom) query.createdAt = { ...query.createdAt, $gte: filters.dateFrom };
    if (filters?.dateTo) query.createdAt = { ...query.createdAt, $lte: filters.dateTo };
    if (filters?.resolvedFrom) query.resolvedAt = { ...query.resolvedAt, $gte: filters.resolvedFrom };
    if (filters?.resolvedTo) query.resolvedAt = { ...query.resolvedAt, $lte: filters.resolvedTo };

    return await TicketModel.find(query)
      .populate('assignedTo', 'firstName lastName')
      .populate('createdBy', 'firstName lastName phone')
      .sort({ createdAt: -1 })
      .limit(50);
  }

  async create(data: Partial<ITicket>): Promise<ITicket> {
    const ticket = new TicketModel({
      title: data.title,
      description: data.description,
      category: data.category,
      priority: data.priority || 'medium',
      createdBy: data.createdBy,
      assignedTo: data.assignedTo,
      phone: data.phone,
      media: data.media,
      status: data.assignedTo ? TicketStatus.ASSIGNED : TicketStatus.NEW,
    });
    return await ticket.save();
  }

  async updateStatus(id: string, status: TicketStatus): Promise<ITicket> {
    const updateData: any = { status };
    if (status === TicketStatus.RESOLVED || status === TicketStatus.COMPLETED) updateData.resolvedAt = new Date();
    const ticket = await TicketModel.findByIdAndUpdate(id, { $set: updateData }, { returnDocument: 'after' });
    if (!ticket) throw new NotFoundError('Заявка не найдена');
    return ticket;
  }

  async assignTicket(id: string, workerId: string): Promise<ITicket> {
    const ticket = await TicketModel.findByIdAndUpdate(
      id,
      { $set: { assignedTo: new mongoose.Types.ObjectId(workerId), status: TicketStatus.ASSIGNED } },
      { returnDocument: 'after' },
    );
    if (!ticket) throw new NotFoundError('Заявка не найдена');
    return ticket;
  }

  async getStats(): Promise<TicketStats> {
    const tickets = await TicketModel.find({ archived: { $ne: true } });
    const stats: TicketStats = { total: tickets.length, new: 0, assigned: 0, inProgress: 0, resolved: 0, completed: 0, cancelled: 0 };
    tickets.forEach((ticket) => {
      switch (ticket.status) {
        case TicketStatus.NEW: stats.new++; break;
        case TicketStatus.ASSIGNED: stats.assigned++; break;
        case TicketStatus.IN_PROGRESS: stats.inProgress++; break;
        case TicketStatus.RESOLVED: stats.resolved++; break;
        case TicketStatus.COMPLETED: stats.completed++; break;
        case TicketStatus.CANCELLED: stats.cancelled++; break;
      }
    });
    return stats;
  }

  async archiveCompleted(daysOld: number): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysOld);
    const result = await TicketModel.updateMany(
      {
        status: { $in: [TicketStatus.COMPLETED, TicketStatus.CANCELLED] },
        updatedAt: { $lt: cutoff },
        archived: { $ne: true },
      },
      { $set: { archived: true } },
    );
    return result.modifiedCount;
  }

  async archiveOne(id: string): Promise<ITicket> {
    const ticket = await TicketModel.findByIdAndUpdate(
      id,
      { $set: { archived: true } },
      { returnDocument: 'after' },
    );
    if (!ticket) throw new NotFoundError('Заявка не найдена');
    return ticket;
  }

  async archiveOldOpen(daysOld: number): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysOld);
    const result = await TicketModel.updateMany(
      {
        status: { $nin: [TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED, TicketStatus.COMPLETED] },
        createdAt: { $lt: cutoff },
        archived: { $ne: true },
      },
      { $set: { archived: true } },
    );
    return result.modifiedCount;
  }

  async deleteOldArchived(daysOld: number): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysOld);
    const result = await TicketModel.deleteMany({
      archived: true,
      updatedAt: { $lt: cutoff },
    });
    return result.deletedCount;
  }

  async getArchived(filters?: TicketFilters): Promise<ITicket[]> {
    const query: any = { archived: true };
    if (filters?.status && filters.status.length > 0) query.status = { $in: filters.status };
    if (filters?.assignedTo) query.assignedTo = new mongoose.Types.ObjectId(filters.assignedTo);
    if (filters?.dateFrom) query.createdAt = { $gte: filters.dateFrom };
    if (filters?.dateTo) query.createdAt = { ...query.createdAt, $lte: filters.dateTo };
    return await TicketModel.find(query)
      .populate('assignedTo', 'firstName lastName')
      .populate('createdBy', 'firstName lastName phone')
      .sort({ createdAt: -1 })
      .limit(100);
  }
}