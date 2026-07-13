import { UserRepository } from '../repositories';
import { IUser, UserRole } from '../models';
import { UnauthorizedError, NotFoundError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';
import { isValidPhone } from '../utils/phone';

export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async authenticate(telegramId: number, ctx?: any): Promise<IUser> {
    const user = await this.userRepository.findByTelegramId(telegramId);

    if (!user) {
      const firstName = ctx?.from?.first_name || 'User';
      const username = ctx?.from?.username || undefined;

      const newUser = await this.userRepository.create({
        telegramId,
        firstName,
        username,
        role: UserRole.USER,
        isActive: true,
      });
      logger.info(`New user auto-registered: ${firstName} (${telegramId})`);
      return newUser;
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Ваша учетная запись деактивирована.');
    }

    return user;
  }

  async promoteToAdmin(userId: string, promotedBy: IUser): Promise<IUser> {
    if (promotedBy.role !== UserRole.SUPER_ADMIN) {
      throw new ValidationError('Только супер-админ может назначать админов');
    }
    const user = await this.userRepository.updateRole(userId, UserRole.ADMIN, promotedBy._id.toString());
    logger.info(`User ${user.firstName} promoted to ADMIN`);
    return user;
  }

  async assignWorker(userId: string, assignedBy: IUser): Promise<IUser> {
    if (assignedBy.role !== UserRole.ADMIN && assignedBy.role !== UserRole.SUPER_ADMIN) {
      throw new ValidationError('Только админ может назначать работников');
    }
    const user = await this.userRepository.update(userId, {
      role: UserRole.WORKER,
      isActive: true,
      createdBy: assignedBy._id,
    });
    logger.info(`User ${user.firstName} assigned as WORKER`);
    return user;
  }

  async getActiveWorkers(): Promise<IUser[]> {
    return await this.userRepository.findActiveWorkers();
  }

  async getAdmins(): Promise<IUser[]> {
    return await this.userRepository.findByRole(UserRole.ADMIN);
  }

  async getAllUsers(): Promise<IUser[]> {
    return await this.userRepository.findAllActive();
  }

  async searchUsers(query: string): Promise<IUser[]> {
    return this.userRepository.searchActive(query);
  }

  async getUserById(id: string): Promise<IUser> {
    const user = await this.userRepository.findById(id);
    if (!user) throw new NotFoundError('Пользователь не найден');
    return user;
  }

  async savePhone(userId: string, phone: string): Promise<IUser> {
    const normalized = phone.trim();
    if (!isValidPhone(normalized)) throw new ValidationError('Некорректный номер телефона');
    return this.userRepository.update(userId, { phone: normalized });
  }

  async deactivateUser(id: string, deactivatedBy: IUser): Promise<void> {
    if (deactivatedBy.role !== UserRole.ADMIN && deactivatedBy.role !== UserRole.SUPER_ADMIN) {
      throw new ValidationError('Недостаточно прав');
    }
    await this.userRepository.deactivate(id);
  }
}