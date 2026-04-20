import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding test user...");

  await prisma.user.upsert({
    where: { ip_fingerprint: "test-fingerprint-local" },
    update: {},
    create: { ip_fingerprint: "test-fingerprint-local", is_premium: true },
  });

  console.log("Seed complete.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
