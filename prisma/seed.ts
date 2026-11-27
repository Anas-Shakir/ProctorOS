import bcrypt from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";

try {
  process.loadEnvFile();
} catch {
  // Environment variables may already be injected by Prisma CLI or hosting platform.
}

const prisma = new PrismaClient();

const SEED_PASSWORDS = {
  ADMIN: "Admin123!",
  EXAMINER: "Examiner123!",
  CANDIDATE: "Candidate123!",
} as const;

async function main() {
  const [adminHash, examinerHash, candidateHash] = await Promise.all([
    bcrypt.hash(SEED_PASSWORDS.ADMIN, 10),
    bcrypt.hash(SEED_PASSWORDS.EXAMINER, 10),
    bcrypt.hash(SEED_PASSWORDS.CANDIDATE, 10),
  ]);

  const users: Array<{
    name: string;
    email: string;
    role: Role;
    passwordHash: string;
  }> = [
    {
      name: "System Administrator",
      email: "admin@proctoros.local",
      role: Role.ADMIN,
      passwordHash: adminHash,
    },
    {
      name: "Dr. Nadia Hassan",
      email: "examiner1@proctoros.local",
      role: Role.EXAMINER,
      passwordHash: examinerHash,
    },
    {
      name: "Prof. Tariq Javed",
      email: "examiner2@proctoros.local",
      role: Role.EXAMINER,
      passwordHash: examinerHash,
    },
    ...Array.from({ length: 10 }, (_, idx) => {
      const n = idx + 1;
      return {
        name: `Candidate ${String(n).padStart(2, "0")}`,
        email: `candidate${n}@proctoros.local`,
        role: Role.CANDIDATE,
        passwordHash: candidateHash,
      };
    }),
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        role: user.role,
        passwordHash: user.passwordHash,
        isActive: true,
      },
      create: {
        name: user.name,
        email: user.email,
        role: user.role,
        passwordHash: user.passwordHash,
        isActive: true,
      },
    });
  }

  console.log(
    `Seeded ${users.length} users (1 ADMIN, 2 EXAMINER, 10 CANDIDATE).`,
  );
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
