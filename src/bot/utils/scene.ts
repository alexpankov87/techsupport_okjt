import { Scenes } from 'telegraf';
import { BotContext } from '../middlewares/auth.middleware';

/** Leave wizard and restore role keyboard (replaces stuck Пропустить/Отмена). */
export async function finishScene(ctx: BotContext): Promise<void> {
  await ctx.scene.leave();
  if (ctx.backToMainMenu) await ctx.backToMainMenu(ctx);
}

const ESCAPE_COMMANDS = [
  'help', 'apply', 'my', 'new', 'journal', 'archive',
  'users', 'staff', 'stats', 'today', 'done', 'reports',
] as const;

/** WizardScene swallows text before bot.command — intercept slash-menu so /start is not a ticket body. */
export function attachSceneEscape(scene: Scenes.WizardScene<BotContext>): void {
  scene.start(async (ctx) => finishScene(ctx));
  scene.command([...ESCAPE_COMMANDS], async (ctx) => finishScene(ctx));
  scene.hears(/главное меню/i, async (ctx) => finishScene(ctx));
}
