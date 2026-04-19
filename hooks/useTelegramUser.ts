"use client";

// Re-export from UserContext for backwards compatibility
export { useUser as useTelegramUser } from "@/context/UserContext";

export function getTelegramHeaders(telegramId?: number): Record<string, string> {
  if (!telegramId) return {};
  return { "x-telegram-id": String(telegramId) };
}
