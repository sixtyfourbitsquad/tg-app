import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CATEGORIES = [
  { name: "Amateur", slug: "amateur" },
  { name: "MILF", slug: "milf" },
  { name: "Teen (18+)", slug: "teen-18plus" },
  { name: "Asian", slug: "asian" },
  { name: "Latina", slug: "latina" },
  { name: "BBW", slug: "bbw" },
  { name: "Blonde", slug: "blonde" },
  { name: "Brunette", slug: "brunette" },
  { name: "Redhead", slug: "redhead" },
  { name: "Verified", slug: "verified" },
];

// Public domain / royalty-free MP4 URLs for testing without pipeline
const TEST_VIDEOS = [
  {
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    thumbnail: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg",
    title: "Test Video 1 — Amateur",
    category_slug: "amateur",
    duration: 596,
    views: 1240,
    reddit_id: "test_001",
  },
  {
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    thumbnail: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ElephantsDream.jpg",
    title: "Test Video 2 — MILF",
    category_slug: "milf",
    duration: 653,
    views: 8820,
    reddit_id: "test_002",
  },
  {
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    thumbnail: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerBlazes.jpg",
    title: "Test Video 3 — Asian",
    category_slug: "asian",
    duration: 15,
    views: 3310,
    reddit_id: "test_003",
  },
  {
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    thumbnail: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerEscapes.jpg",
    title: "Test Video 4 — Latina",
    category_slug: "latina",
    duration: 15,
    views: 5570,
    reddit_id: "test_004",
  },
  {
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
    thumbnail: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerFun.jpg",
    title: "Test Video 5 — Blonde",
    category_slug: "blonde",
    duration: 60,
    views: 9210,
    reddit_id: "test_005",
  },
  {
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
    thumbnail: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerJoyrides.jpg",
    title: "Test Video 6 — Brunette",
    category_slug: "brunette",
    duration: 15,
    views: 4490,
    reddit_id: "test_006",
  },
  {
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
    thumbnail: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerMeltdowns.jpg",
    title: "Test Video 7 — BBW",
    category_slug: "bbw",
    duration: 15,
    views: 2130,
    reddit_id: "test_007",
  },
  {
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
    thumbnail: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/Sintel.jpg",
    title: "Test Video 8 — Verified",
    category_slug: "verified",
    duration: 888,
    views: 17500,
    reddit_id: "test_008",
  },
  {
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4",
    thumbnail: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/SubaruOutbackOnStreetAndDirt.jpg",
    title: "Test Video 9 — Redhead",
    category_slug: "redhead",
    duration: 60,
    views: 6780,
    reddit_id: "test_009",
  },
  {
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
    thumbnail: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/TearsOfSteel.jpg",
    title: "Test Video 10 — Teen (18+)",
    category_slug: "teen-18plus",
    duration: 734,
    views: 11200,
    reddit_id: "test_010",
  },
];

async function main() {
  console.log("Seeding categories...");
  const categoryMap: Record<string, string> = {};

  for (const cat of CATEGORIES) {
    const created = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
    categoryMap[cat.slug] = created.id;
  }

  console.log("Seeding test videos...");
  for (const v of TEST_VIDEOS) {
    await prisma.video.upsert({
      where: { reddit_id: v.reddit_id },
      update: {},
      create: {
        url: v.url,
        thumbnail: v.thumbnail,
        title: v.title,
        category_id: categoryMap[v.category_slug],
        duration: v.duration,
        views: v.views,
        reddit_id: v.reddit_id,
      },
    });
  }

  console.log("Seeding test user...");
  await prisma.user.upsert({
    where: { ip_fingerprint: "test-fingerprint-local" },
    update: {},
    create: {
      ip_fingerprint: "test-fingerprint-local",
      is_premium: true,
    },
  });

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
