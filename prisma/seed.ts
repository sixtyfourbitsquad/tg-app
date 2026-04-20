import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CATEGORIES = [
  { name: "Just Boobs",       slug: "just-boobs" },
  { name: "Blowjobs",         slug: "blowjobs" },
  { name: "Thick Booty",      slug: "thick-booty" },
  { name: "Lips That Grip",   slug: "lips-that-grip" },
  { name: "Legal Teens",      slug: "legal-teens" },
  { name: "Real Orgasms",     slug: "real-orgasms" },
  { name: "Amateur Girls",    slug: "amateur-girls" },
  { name: "Tik Tok",          slug: "tik-tok" },
  { name: "Real Couples",     slug: "real-couples" },
  { name: "Rough Sex",        slug: "rough-sex" },
  { name: "Creampies",        slug: "creampies" },
  { name: "Girls Finishing",  slug: "girls-finishing" },
  { name: "Animated",         slug: "animated" },
  { name: "Body Art",         slug: "body-art" },
  { name: "Clothing",         slug: "clothing" },
  { name: "Communities",      slug: "communities" },
  { name: "Cum Play",         slug: "cum-play" },
  { name: "Ethnicity",        slug: "ethnicity" },
  { name: "Exhibitionism",    slug: "exhibitionism" },
  { name: "LGBT",             slug: "lgbt" },
  { name: "Locations",        slug: "locations" },
  { name: "Masturbation",     slug: "masturbation" },
  { name: "Physique",         slug: "physique" },
  { name: "Positions",        slug: "positions" },
  { name: "Sex",              slug: "sex" },
  { name: "Subcultures",      slug: "subcultures" },
  { name: "Fetish",           slug: "fetish" },
  { name: "Indian",           slug: "indian" },
  { name: "Desi",             slug: "desi" },
  { name: "Asian",            slug: "asian" },
  { name: "Latina",           slug: "latina" },
  { name: "Blonde",           slug: "blonde" },
  { name: "Brunette",         slug: "brunette" },
  { name: "Milf",             slug: "milf" },
  { name: "Mature",           slug: "mature" },
  { name: "BBW",              slug: "bbw" },
  { name: "Petite",           slug: "petite" },
  { name: "Busty",            slug: "busty" },
  { name: "Homemade",         slug: "homemade" },
  { name: "Amateur",          slug: "amateur" },
  { name: "College",          slug: "college" },
  { name: "Teen",             slug: "teen" },
  { name: "Solo",             slug: "solo" },
  { name: "Couple",           slug: "couple" },
  { name: "Massage",          slug: "massage" },
  { name: "Office",           slug: "office" },
  { name: "Gym",              slug: "gym" },
  { name: "Yoga",             slug: "yoga" },
  { name: "Beach",            slug: "beach" },
  { name: "Shower",           slug: "shower" },
];

async function main() {
  console.log("Seeding categories...");

  for (const cat of CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name },
      create: cat,
    });
  }

  console.log(`Seeded ${CATEGORIES.length} categories.`);

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
