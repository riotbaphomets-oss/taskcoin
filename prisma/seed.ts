import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password || password.length < 10) {
    throw new Error("ADMIN_EMAIL und ADMIN_PASSWORD (mind. 10 Zeichen) in .env setzen.");
  }
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: { emailVerifiedAt: new Date() },
    create: {
      email: email.toLowerCase(),
      name: "Admin",
      emailVerifiedAt: new Date(),
      passwordHash,
      role: "ADMIN",
      wallet: { create: {} },
    },
  });
  // Systemkonto für Plattformgebühren: gesperrt, kann sich nicht anmelden.
  await prisma.user.upsert({
    where: { email: "platform@taskcoin.local" },
    update: {},
    create: {
      email: "platform@taskcoin.local",
      name: "Plattform",
      passwordHash: "!",
      role: "ADMIN",
      disabled: true,
      wallet: { create: {} },
    },
  });
  console.log(`Admin bereit: ${email}`);
}

main().finally(() => prisma.$disconnect());
