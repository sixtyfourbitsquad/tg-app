"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import axios from "axios";
import { getTelegramWebAppUser, getTelegramInitData, type TelegramUser } from "@/lib/telegram";
import { setClientTelegramId } from "@/lib/axios";

interface UserContextValue {
  user: TelegramUser | null;
  isLoading: boolean;
  isPremium: boolean;
}

const UserContext = createContext<UserContextValue>({ user: null, isLoading: true, isPremium: false });

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    const tgUser = getTelegramWebAppUser();
    if (!tgUser) { setIsLoading(false); return; }

    setUser(tgUser);

    const initData = getTelegramInitData();
    axios
      .post<{ telegram_id?: string; is_premium?: boolean }>("/api/auth/telegram", {
        initData,
        user: tgUser,
      })
      .then((r) => {
        const d = r.data;
        if (d.telegram_id) setClientTelegramId(String(d.telegram_id));
        if (d.is_premium) setIsPremium(true);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  return <UserContext.Provider value={{ user, isLoading, isPremium }}>{children}</UserContext.Provider>;
}

export const useUser = () => useContext(UserContext);
