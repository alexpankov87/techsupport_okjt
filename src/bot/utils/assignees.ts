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
