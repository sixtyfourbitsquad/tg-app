export interface TelegramUser {
  telegram_id: number;
  username?: string;
  first_name?: string;
  photo_url?: string;
}

const MOCK_USER: TelegramUser = {
  telegram_id: 12345,
  username: "testuser",
  first_name: "Test",
};

export function getTelegramWebAppUser(): TelegramUser | null {
  if (typeof window === "undefined") return null;

  const tg = (window as Window & { Telegram?: { WebApp?: { initDataUnsafe?: { user?: { id: number; username?: string; first_name?: string; photo_url?: string } }; initData?: string } } }).Telegram?.WebApp;

  const user = tg?.initDataUnsafe?.user;
  if (user) {
    return {
      telegram_id: user.id,
      username: user.username,
      first_name: user.first_name,
      photo_url: user.photo_url,
    };
  }

  // Mock user for browser testing outside Telegram
  if (process.env.NODE_ENV === "development") return MOCK_USER;
  return null;
}

export function getTelegramInitData(): string {
  if (typeof window === "undefined") return "";
  const tg = (window as Window & { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp;
  return tg?.initData ?? "";
}
