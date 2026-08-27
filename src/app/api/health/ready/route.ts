import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type DatabaseCheck = () => Promise<void>;

async function checkDatabase() {
  await db.$queryRaw`SELECT 1`;
}

export async function getReadinessResponse(databaseCheck: DatabaseCheck = checkDatabase) {
  try {
    await databaseCheck();
    return Response.json({ status: "ready", database: "ok" });
  } catch (error) {
    console.error("Database readiness check failed", error);
    return Response.json({ status: "not_ready", database: "error" }, { status: 503 });
  }
}

export async function GET() {
  return getReadinessResponse();
}
