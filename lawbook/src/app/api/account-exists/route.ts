import { getAuthDb } from "@/lib/d1";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const username = new URL(request.url).searchParams.get("username")?.trim();

  if (!username) {
    return Response.json({ exists: false }, { status: 400 });
  }

  try {
    const authDb = await getAuthDb();
    const email = `${username.toLowerCase()}@users.lawplain.local`;
    const row = await authDb
      .prepare(
        'SELECT id FROM "user" WHERE lower(username) = lower(?) OR email = ? LIMIT 1',
      )
      .bind(username, email)
      .first<{ id: string }>();

    return Response.json(
      { exists: Boolean(row) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[account-exists] query failed", { username, error });
    return Response.json(
      { exists: false, error: "ACCOUNT_CHECK_FAILED" },
      { status: 503 },
    );
  }
}
