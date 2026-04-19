import { Telegraf, Markup } from "telegraf";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://35.200.162.160:3000";
const APP_URL_INTERNAL = "http://localhost:3000";

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
  const payload = ctx.startPayload; // e.g. "connect_ABC123", "video_<id>", "premium"

  if (payload === "premium") {
    await registerUser(id, username);
    return ctx.reply(
      "⭐ *Premium / Telegram Stars*\n\nPayments are not enabled yet. You will be able to upgrade here soon.",
      { parse_mode: "Markdown", ...Markup.inlineKeyboard([[Markup.button.url("🎬 Open VaultX", APP_URL)]]) }
    );
  }

  if (payload?.startsWith("video_")) {
    await registerUser(id, username);
    const videoId = payload.slice("video_".length).trim();
    if (!videoId) {
      return ctx.reply("❌ Invalid video link.", {
        ...Markup.inlineKeyboard([[Markup.button.url("🎬 Open VaultX", APP_URL)]]),
      });
    }
    const openUrl = `${APP_URL.replace(/\/$/, "")}/?v=${encodeURIComponent(videoId)}`;
    return ctx.reply(
      "🎬 *Open this video in VaultX*",
      { parse_mode: "Markdown", ...Markup.inlineKeyboard([[Markup.button.url("▶️ Watch", openUrl)]]) }
    );
  }

  if (payload?.startsWith("connect_")) {
    const code = payload.replace("connect_", "").toUpperCase();
    try {
      const res = await fetch(`${APP_URL_INTERNAL}/api/auth/connect?code=${code}`);
      const body = await res.json();
      console.log("Connect API response:", res.status, body);

      if (!res.ok) {
        return ctx.reply(`❌ Link expired or invalid (${res.status}). Go back to the app and try again.`);
      }

      const { user_id } = body;

      // If this telegram_id already owns a user record, just update username
      // Otherwise link it to the app session user
      const existing = await prisma.user.findUnique({ where: { telegram_id: BigInt(id) } });
      if (existing) {
        await prisma.user.update({
          where: { id: existing.id },
          data: { username: username ?? null },
        });
      } else {
        await prisma.user.update({
          where: { id: user_id },
          data: { telegram_id: BigInt(id), username: username ?? null },
        });
      }

      return ctx.reply(
        `✅ *Account connected!*\n\nYour Telegram is now linked to your VaultX account. Your likes and saves are synced.`,
        { parse_mode: "Markdown", ...Markup.inlineKeyboard([[Markup.button.url("🎬 Open VaultX", APP_URL)]]) }
      );
    } catch (err) {
      console.error("Connect error:", err);
      return ctx.reply(`❌ Something went wrong: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  await registerUser(id, username);
  const name = first_name ?? username ?? "there";
  await ctx.reply(
    `👋 Hey ${name}! Welcome to *VaultX* — your private video feed.\n\nTap below to open the app and start watching.`,
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([[Markup.button.url("🎬 Open VaultX", APP_URL)]]),
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
    const res = await fetch(`${APP_URL_INTERNAL}/api/auth/connect?code=${code}`);
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
