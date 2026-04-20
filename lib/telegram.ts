export interface TelegramUser {
  telegram_id: number;
  username?: string;
  first_name?: string;
  photo_url?: string;
}

const MOCK_USER: TelegramUser = {
  telegram_id: 99999,
  username: "testuser",
  first_name: "Test",
};

type TelegramWebApp = {
  ready: () => void;
  initData?: string;
  initDataUnsafe?: {
    user?: {
      id: number;
      username?: string;
      first_name?: string;
      photo_url?: string;
    };
  };
};

function getTg(): TelegramWebApp | undefined {
  return (window as Window & { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp;
}

export async function waitForTelegramWebApp(): Promise<TelegramUser | null> {
  if (typeof window === "undefined") return null;

  // Already loaded
  if (getTg()) {
    const tg = getTg()!;
    tg.ready();
    const user = tg.initDataUnsafe?.user;
    if (user) {
      return { telegram_id: user.id, username: user.username, first_name: user.first_name, photo_url: user.photo_url };
    }
    return MOCK_USER;
  }

  // Wait up to 3 seconds for async SDK
  await new Promise<void>((resolve) => {
    let tries = 0;
    const check = () => {
      if (getTg() || ++tries > 30) resolve();
      else setTimeout(check, 100);
    };
    check();
  });

  const tg = getTg();
  if (tg) {
    tg.ready();
    const user = tg.initDataUnsafe?.user;
    if (user) {
      return { telegram_id: user.id, username: user.username, first_name: user.first_name, photo_url: user.photo_url };
    }
  }

  return MOCK_USER;
}

export function getTelegramWebAppUser(): TelegramUser | null {
  if (typeof window === "undefined") return null;
  const tg = getTg();
  const user = tg?.initDataUnsafe?.user;
  if (user) {
    return { telegram_id: user.id, username: user.username, first_name: user.first_name, photo_url: user.photo_url };
  }
  return null;
}

export function getTelegramInitData(): string {
  if (typeof window === "undefined") return "";
  return getTg()?.initData ?? "";
}
