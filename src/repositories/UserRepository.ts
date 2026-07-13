import { UserModel, IUser, UserRole } from '../models';
import { NotFoundError } from '../utils/errors';
import { logger } from '../utils/logger';

export class UserRepository {
  async findByTelegramId(telegramId: number): Promise<IUser | null> {
    return await UserModel.findOne({ telegramId, isActive: true });
  }

  async findById(id: string): Promise<IUser | null> {
    return await UserModel.findOne({ _id: id, isActive: true });
  }

  async findActiveWorkers(): Promise<IUser[]> {
    return await UserModel.find({ role: UserRole.WORKER, isActive: true });
  }

  async findByRole(role: UserRole): Promise<IUser[]> {
    return await UserModel.find({ role, isActive: true });
  }

  async findAllActive(): Promise<IUser[]> {
    return await UserModel.find({ isActive: true });
  }

  async searchActive(query: string, limit = 20): Promise<IUser[]> {
    const q = query.trim();
    if (!q) return [];
    const or: Record<string, unknown>[] = [
      { firstName: { $regex: q, $options: 'i' } },
      { lastName: { $regex: q, $options: 'i' } },
      { username: { $regex: q, $options: 'i' } },
      { phone: { $regex: q, $options: 'i' } },
    ];
    if (/^\d+$/.test(q)) {
      const n = Number(q);
      if (Number.isSafeInteger(n)) or.push({ telegramId: n });
    }
    return UserModel.find({ isActive: true, $or: or }).limit(limit);
  }

  async create(data: Partial<IUser>): Promise<IUser> {
    try {
      const user = new UserModel(data);
      return await user.save();
    } catch (error: any) {
      if (error.code === 11000) throw new Error('Пользователь с таким Telegram ID уже существует');
      throw error;
    }
  }

  async update(id: string, data: Partial<IUser>): Promise<IUser> {
    const user = await UserModel.findByIdAndUpdate(id, { $set: data }, { returnDocument: 'after' });
    if (!user) throw new NotFoundError('Пользователь не найден');
    return user;
  }

  async updateRole(id: string, role: UserRole, updatedBy: string): Promise<IUser> {
    const user = await UserModel.findByIdAndUpdate(
      id,
      { $set: { role, createdBy: updatedBy } },
      { returnDocument: 'after' },
    );
    if (!user) throw new NotFoundError('Пользователь не найден');
    return user;
  }

  async deactivate(id: string): Promise<void> {
    const result = await UserModel.findByIdAndUpdate(id, { isActive: false }, { returnDocument: 'after' });
    if (!result) throw new NotFoundError('Пользователь не найден');
  }
}