import { attachSceneEscape } from '../utils/scene';
import { createTicketScene } from './createTicket.scene';
import { manageTicketScene } from './manageTicket.scene';
import { createUserTicketScene } from './createUserTicket.scene';
import { usersScene } from './users.scene';

[createTicketScene, createUserTicketScene, manageTicketScene, usersScene].forEach(attachSceneEscape);

export { createTicketScene, manageTicketScene, createUserTicketScene, usersScene };
