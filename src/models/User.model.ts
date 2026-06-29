import mongoose, { Schema, Document } from 'mongoose';

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  WORKER = 'worker',
  USER = 'user',
}

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  telegramId: number;
  username?: string;
  firstName: string;
  lastName?: string;
  role: UserRole;
  department?: string;
  isActive: boolean;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    telegramId: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    username: {
      type: String,
      sparse: true,
    },
    firstName: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.USER,
    },
    department: {
      type: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  },
);

UserSchema.index({ role: 1, isActive: 1 });

export const UserModel = mongoose.model<IUser>('User', UserSchema);