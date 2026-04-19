export function getTelegramBotUsername(): string {
  return (
    process.env.TELEGRAM_BOT_USERNAME ??
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ??
    "XXreels_bot"
  );
}

export function appShareUrl(videoId: string): string {
  const fromEnv = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  const base =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : fromEnv || "";
  return `${base}/?v=${encodeURIComponent(videoId)}`;
}

export function telegramStartVideoUrl(videoId: string): string {
  const bot = getTelegramBotUsername();
  return `https://t.me/${bot}?start=${encodeURIComponent(`video_${videoId}`)}`;
}

export function telegramPremiumUrl(): string {
  return `https://t.me/${getTelegramBotUsername()}?start=premium`;
}
