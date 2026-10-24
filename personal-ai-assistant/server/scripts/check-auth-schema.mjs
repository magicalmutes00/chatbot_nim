import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
for (const t of ["session", "user"]) {
  const cols = await p.$queryRawUnsafe(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'neon_auth' AND table_name = '${t}' ORDER BY ordinal_position`
  );
  console.log(`neon_auth.${t}: ` + cols.map((c) => c.column_name + ":" + c.data_type).join(", "));
}
const count = await p.$queryRawUnsafe('SELECT COUNT(*)::int AS n FROM neon_auth."user"');
console.log("existing auth users: " + count[0].n);
await p.$disconnect();