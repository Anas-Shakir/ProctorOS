import { PrismaClient } from "@prisma/client";
import { seedDemoData } from "../src/lib/demo-seed";

try {
  process.loadEnvFile();
} catch {
  // Environment variables may already be injected by Prisma CLI or hosting platform.
}

const prisma = new PrismaClient();

async function main() {
  const result = await seedDemoData(prisma, { reset: false });
  if (result.skippedContent) {
    console.log(
      `Verified ${result.usersCount} users; demo exams already seeded (run \`npm run db:reset-demo\` for a full reset).`,
    );
  } else {
    console.log(
      `Seeded ${result.usersCount} users, ${result.questionsCount} questions across 4 topics, and ${result.examsCount} demo exams.`,
    );
  }
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
