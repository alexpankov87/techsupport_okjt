import { BotContext } from '../middlewares/auth.middleware';

/** Leave wizard and restore role keyboard (replaces stuck Пропустить/Отмена). */
export async function finishScene(ctx: BotContext): Promise<void> {
  await ctx.scene.leave();
  if (ctx.backToMainMenu) await ctx.backToMainMenu(ctx);
}
