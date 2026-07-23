import { IUser, UserRole } from '../../models';

/** Pure merge for tests and UI — same rules as UserService.getAssignableUsers. */
export function mergeAssignable(workers: IUser[], actor?: IUser): IUser[] {
  if (!actor) return workers;
  if (actor.role !== UserRole.ADMIN && actor.role !== UserRole.SUPER_ADMIN) return workers;
  const id = actor._id.toString();
  if (workers.some((w) => w._id.toString() === id)) return workers;
  return [actor, ...workers];
}

export function assigneeLabel(user: IUser, actorId?: string): string {
  const name = `${user.firstName} ${user.lastName || ''}`.trim();
  if (actorId && user._id.toString() === actorId) return `🙋 На себя (${name})`;
  return `👤 ${name}`;
}

export function assigneePickerRows(
  ticketId: string,
  users: IUser[],
  actorId?: string,
): Array<Array<{ text: string; callback_data: string }>> {
  return users.map((u) => [{
    text: assigneeLabel(u, actorId),
    callback_data: `do_assign_${ticketId}_${u._id.toString()}`,
  }]);
}

/** Who gets which Telegram text after assign — one ping when author === assignee. */
export function buildAssignNotices(opts: {
  creatorTg?: number | null;
  workerTg?: number | null;
  takeSelf: boolean;
  number: string | number;
  title: string;
  workerName: string;
}): Array<{ chatId: number; text: string }> {
  const { creatorTg, workerTg, takeSelf, number, title, workerName } = opts;
  const statusText = takeSelf ? 'В работе' : 'Назначена';

  if (creatorTg && workerTg && creatorTg === workerTg) {
    const text = takeSelf
      ? `📣 Заявка #${number} у вас в работе\n📋 ${title}\n📊 В работе`
      : `🔔 Вам назначена заявка #${number}\n📋 ${title}\n📊 Назначена\n\nПримите в работу!`;
    return [{ chatId: creatorTg, text }];
  }

  const out: Array<{ chatId: number; text: string }> = [];
  if (creatorTg) {
    out.push({
      chatId: creatorTg,
      text:
        `📣 Вашу заявку изменили статус\n📋 #${number} - ${title}\n📊 ${statusText}\n👤 Исполнитель: ${workerName}`,
    });
  }
  if (!takeSelf && workerTg) {
    out.push({
      chatId: workerTg,
      text: `🔔 Заявка #${number}\n📋 ${title}\n\nПримите в работу!`,
    });
  }
  return out;
}
