"use client";

import { useEffect, useState } from "react";

interface TelegramUser {
  id: number;
  username?: string;
  first_name?: string;
}

let cachedUser: TelegramUser | null = null;

export function useTelegramUser(): TelegramUser | null {
  const [user, setUser] = useState<TelegramUser | null>(cachedUser);

  useEffect(() => {
    if (cachedUser) return;
    const tg = (window as Window & { Telegram?: { WebApp?: { initDataUnsafe?: { user?: TelegramUser } } } }).Telegram?.WebApp;
    const tgUser = tg?.initDataUnsafe?.user;
    if (tgUser) {
      cachedUser = tgUser;
      setUser(tgUser);
    }
  }, []);

  return user;
}

export function getTelegramHeaders(): Record<string, string> {
  if (!cachedUser) return {};
  return { "x-telegram-id": String(cachedUser.id) };
}
