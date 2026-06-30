import mongoose, { Schema, Document } from 'mongoose';

export enum TicketStatus {
  NEW = 'new',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  UNRESOLVED = 'unresolved',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum TicketCategory {
  PRINTER = 'printer',
  SOFTWARE = 'software',
  NETWORK = 'network',
  HARDWARE = 'hardware',
  OTHER = 'other',
}

export enum TicketPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface ITicket extends Document {
  number: string;
  title: string;
  description: string;
  category: TicketCategory;
  status: TicketStatus;
  priority: TicketPriority;
  createdBy: mongoose.Types.ObjectId;
  assignedTo?: mongoose.Types.ObjectId;
  phone?: string;
  media?: string[];
  archived?: boolean;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TicketSchema = new Schema<ITicket>(
  {
    number: { type: String, unique: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, enum: Object.values(TicketCategory), required: true },
    status: { type: String, enum: Object.values(TicketStatus), default: TicketStatus.NEW },
    priority: { type: String, enum: Object.values(TicketPriority), default: TicketPriority.MEDIUM },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    phone: { type: String },
    media: [{ type: String }],
    archived: { type: Boolean, default: false, index: true },
    resolvedAt: { type: Date },
  },
  { timestamps: true },
);

TicketSchema.pre('save', async function (this: ITicket) {
  if (this.isNew) {
    const lastTicket = await TicketModel.findOne().sort({ createdAt: -1 }).select('number');
    const lastNumber = lastTicket ? parseInt(lastTicket.number.split('-')[1]) : 0;
    this.number = `OKZ-${String(lastNumber + 1).padStart(4, '0')}`;
  }
});

TicketSchema.index({ status: 1, assignedTo: 1 });
TicketSchema.index({ createdBy: 1, createdAt: -1 });
TicketSchema.index({ archived: 1, status: 1 });

export const TicketModel = mongoose.model<ITicket>('Ticket', TicketSchema);