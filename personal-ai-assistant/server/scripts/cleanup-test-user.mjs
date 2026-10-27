import "dotenv/config";
import { PrismaClient } from "@prisma/client";

/**
 * Removes a test account's Aurora data.
 *
 * Firebase owns the credential: delete the Firebase user separately (REST
 * `accounts:delete` with the user's own ID token, or the Firebase console),
 * then run this to drop the mirrored row and everything it owns.
 *
 * usage: node cleanup-test-user.mjs <email>
 */

const prisma = new PrismaClient();
const email = process.argv[2];

if (!email) {
  console.error("usage: node cleanup-test-user.mjs <email>");
  process.exit(1);
}

try {
  const local = await prisma.user.findUnique({ where: { email } });
  if (local) {
    await prisma.attachment.deleteMany({ where: { userId: local.id } });
    await prisma.message.deleteMany({ where: { userId: local.id } });
    await prisma.conversation.deleteMany({ where: { userId: local.id } });
    await prisma.memory.deleteMany({ where: { userId: local.id } });
    await prisma.task.deleteMany({ where: { userId: local.id } });
    await prisma.user.delete({ where: { id: local.id } });
  }
  console.log(local ? "cleanup done" : "no app row for", email);
} finally {
  await prisma.$disconnect();
}
