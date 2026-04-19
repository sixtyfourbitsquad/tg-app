import { NextRequest } from "next/server";
import { db } from "./db";
import { getFingerprint, getTelegramId } from "./fingerprint";

export async function resolveUser(req: NextRequest) {
  const telegramId = getTelegramId(req);

  if (telegramId) {
    return db.user.upsert({
      where: { telegram_id: telegramId },
      update: {},
      create: { telegram_id: telegramId },
    });
  }

  const fp = getFingerprint(req);
  return db.user.upsert({
    where: { ip_fingerprint: fp },
    update: {},
    create: { ip_fingerprint: fp },
  });
}
