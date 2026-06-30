import { Scenes } from 'telegraf';
import { UserService } from '../../services';
import { TicketService } from '../../services/TicketService';
import { IUser } from '../../models';
import { logger } from '../../utils/logger';

export interface BotContext extends Scenes.WizardContext<Scenes.WizardSessionData> {
  user?: IUser;
  userService: UserService;
  ticketService: TicketService;
  backToMainMenu?: (ctx: BotContext) => Promise<void>;
}

export const authMiddleware = (userService: UserService) => {
  return async (ctx: BotContext, next: () => Promise<void>) => {
    if (!ctx.from) return;
    try {
      const user = await userService.authenticate(ctx.from.id, ctx);
      ctx.user = user;
      return next();
    } catch (error: any) {
      logger.warn(`Unauthorized: ${ctx.from.id}`);
      await ctx.reply(error.message);
    }
  };
};