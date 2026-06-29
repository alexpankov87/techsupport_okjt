import mongoose from 'mongoose';
import { TicketModel, ITicket, TicketStatus } from '../models';
import { NotFoundError } from '../utils/errors';
import { logger } from '../utils/logger';

export interface TicketFilters {
  status?: TicketStatus[];
  assignedTo?: string;
  createdBy?: string;
  category?: string;
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
    try {
      return await TicketModel.findById(id)
        .populate('createdBy', 'firstName lastName')
        .populate('assignedTo', 'firstName lastName');
    } catch (error) {
      logger.error('TicketRepository.findById error:', error);
      throw error;
    }
  }

  async findByNumber(number: string): Promise<ITicket | null> {
    try {
      return await TicketModel.findOne({ number })
        .populate('createdBy', 'firstName lastName')
        .populate('assignedTo', 'firstName lastName');
    } catch (error) {
      logger.error('TicketRepository.findByNumber error:', error);
      throw error;
    }
  }

  async findByAssignee(userId: string, status?: TicketStatus[]): Promise<ITicket[]> {
    try {
      const query: any = { assignedTo: new mongoose.Types.ObjectId(userId) };

      if (status && status.length > 0) {
        query.status = { $in: status };
      }

      return await TicketModel.find(query)
        .populate('createdBy', 'firstName lastName')
        .sort({ createdAt: -1 });
    } catch (error) {
      logger.error('TicketRepository.findByAssignee error:', error);
      throw error;
    }
  }

  async findAll(filters?: TicketFilters): Promise<ITicket[]> {
    try {
      const query: any = {};

      if (filters?.status && filters.status.length > 0) {
        query.status = { $in: filters.status };
      }
      if (filters?.assignedTo) {
        query.assignedTo = new mongoose.Types.ObjectId(filters.assignedTo);
      }
      if (filters?.category) {
        query.category = filters.category;
      }
      if (filters?.createdBy) {
        query.createdBy = new mongoose.Types.ObjectId(filters.createdBy);
      }

      return await TicketModel.find(query)
        .populate('assignedTo', 'firstName lastName')
        .populate('createdBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .limit(50);
    } catch (error) {
      logger.error('TicketRepository.findAll error:', error);
      throw error;
    }
  }

  async create(data: Partial<ITicket>): Promise<ITicket> {
    try {
      const ticket = new TicketModel({
        title: data.title,
        description: data.description,
        category: data.category,
        priority: data.priority || 'medium',
        createdBy: data.createdBy,
        assignedTo: data.assignedTo,
        status: data.assignedTo ? TicketStatus.ASSIGNED : TicketStatus.NEW,
      });

      return await ticket.save();
    } catch (error) {
      logger.error('TicketRepository.create error:', error);
      throw error;
    }
  }

  async updateStatus(id: string, status: TicketStatus): Promise<ITicket> {
    try {
      const updateData: any = { status };

      if (status === TicketStatus.RESOLVED || status === TicketStatus.COMPLETED) {
        updateData.resolvedAt = new Date();
      }

      const ticket = await TicketModel.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true },
      );

      if (!ticket) {
        throw new NotFoundError('Заявка не найдена');
      }

      return ticket;
    } catch (error) {
      logger.error('TicketRepository.updateStatus error:', error);
      throw error;
    }
  }

  async assignTicket(id: string, workerId: string): Promise<ITicket> {
    try {
      const ticket = await TicketModel.findByIdAndUpdate(
        id,
        {
          $set: {
            assignedTo: new mongoose.Types.ObjectId(workerId),
            status: TicketStatus.ASSIGNED,
          },
        },
        { new: true },
      );

      if (!ticket) {
        throw new NotFoundError('Заявка не найдена');
      }

      return ticket;
    } catch (error) {
      logger.error('TicketRepository.assignTicket error:', error);
      throw error;
    }
  }

  async getStats(): Promise<TicketStats> {
    try {
      const tickets = await TicketModel.find({});
      const stats: TicketStats = {
        total: tickets.length,
        new: 0,
        assigned: 0,
        inProgress: 0,
        resolved: 0,
        completed: 0,
        cancelled: 0,
      };

      tickets.forEach((ticket) => {
        switch (ticket.status) {
          case TicketStatus.NEW:
            stats.new++;
            break;
          case TicketStatus.ASSIGNED:
            stats.assigned++;
            break;
          case TicketStatus.IN_PROGRESS:
            stats.inProgress++;
            break;
          case TicketStatus.RESOLVED:
            stats.resolved++;
            break;
          case TicketStatus.COMPLETED:
            stats.completed++;
            break;
          case TicketStatus.CANCELLED:
            stats.cancelled++;
            break;
        }
      });

      return stats;
    } catch (error) {
      logger.error('TicketRepository.getStats error:', error);
      throw error;
    }
  }
}