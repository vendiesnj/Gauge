import { defineConfig } from "prisma/config";

// Prisma v7 config
// - Database URL is passed to PrismaClient via `datasourceUrl` in lib/db.ts
// - For migrations: DATABASE_URL must be set, then run:
//   pnpm exec prisma migrate dev --name init
export default defineConfig({
  schema: "prisma/schema.prisma",
});
