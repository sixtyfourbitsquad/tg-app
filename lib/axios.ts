import axios from "axios";

const STORAGE_KEY = "vaultx_tg_id";

export function setClientTelegramId(telegramId: string | null) {
  if (typeof window === "undefined") return;
  if (telegramId) localStorage.setItem(STORAGE_KEY, telegramId);
  else localStorage.removeItem(STORAGE_KEY);
}

if (typeof window !== "undefined") {
  axios.interceptors.request.use((config) => {
    const id = localStorage.getItem(STORAGE_KEY);
    if (id) {
      config.headers = config.headers ?? {};
      (config.headers as Record<string, string>)["x-telegram-id"] = id;
    }
    return config;
  });
}
