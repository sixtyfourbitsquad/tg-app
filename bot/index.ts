import { Telegraf, Markup } from "telegraf";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://35.200.162.160:3000";

if (!BOT_TOKEN) {
  console.error("TELEGRAM_BOT_TOKEN is not set");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

async function registerUser(telegramId: number, username?: string) {
  return prisma.user.upsert({
    where: { telegram_id: BigInt(telegramId) },
    update: { username: username ?? null },
    create: { telegram_id: BigInt(telegramId), username: username ?? null },
  });
}

bot.start(async (ctx) => {
  const { id, username, first_name } = ctx.from;

  await registerUser(id, username);

  const name = first_name ?? username ?? "there";

  await ctx.reply(
    `👋 Hey ${name}! Welcome to *VaultX* — your private video feed.\n\nTap below to open the app and start watching.`,
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [Markup.button.url("🎬 Open VaultX", APP_URL)],
      ]),
    }
  );
});

bot.command("connect", async (ctx) => {
  const { id, username } = ctx.from;
  const code = ctx.message.text.split(" ")[1]?.trim().toUpperCase();

  if (!code) {
    return ctx.reply("Usage: /connect <CODE>\n\nGet your code from the app → Profile → Connect Telegram.");
  }

  try {
    // Resolve the code to a user_id
    const res = await fetch(`${APP_URL}/api/auth/connect?code=${code}`);
    if (!res.ok) {
      return ctx.reply("❌ Invalid or expired code. Get a new one from the app.");
    }
    const { user_id } = await res.json();

    // Link telegram_id to that user
    await prisma.user.update({
      where: { id: user_id },
      data: { telegram_id: BigInt(id), username: username ?? null },
    });

    await ctx.reply(
      `✅ *Account linked!*\n\nYour Telegram is now connected to your VaultX account. Your likes and saves are synced.`,
      { parse_mode: "Markdown", ...Markup.inlineKeyboard([[Markup.button.url("🎬 Open VaultX", APP_URL)]]) }
    );
  } catch {
    await ctx.reply("❌ Something went wrong. Please try again.");
  }
});

bot.command("profile", async (ctx) => {
  const { id, username } = ctx.from;
  const user = await registerUser(id, username);

  const [likeCount, saveCount] = await Promise.all([
    prisma.like.count({ where: { user_id: user.id } }),
    prisma.save.count({ where: { user_id: user.id } }),
  ]);

  await ctx.reply(
    `👤 *Your Profile*\n\n` +
      `Username: @${username ?? "unknown"}\n` +
      `Liked videos: ${likeCount}\n` +
      `Saved videos: ${saveCount}\n` +
      `Plan: ${user.is_premium ? "⭐ Premium" : "Free"}`,
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [Markup.button.url("🎬 Open VaultX", APP_URL)],
      ]),
    }
  );
});

bot.launch(() => {
  console.log("Bot is running...");
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
