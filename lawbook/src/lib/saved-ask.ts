import { getCloudflareContext } from "@opennextjs/cloudflare";

interface SavedAskEnv extends CloudflareEnv {
  AUTH_DB?: D1Database;
}

export interface SavedAskAnswer {
  id: string;
  question: string;
  answer: string;
  cite: string | null;
  kind: string | null;
  sourceHref: string | null;
  threadId: string | null;
  messageId: number | null;
  tools: string[];
  createdAt: number;
}

const LIST_LIMIT = 200;

let schemaReady: Promise<void> | null = null;

async function addColumnIfMissing(
  db: D1Database,
  columns: Set<string>,
  name: string,
  definition: string,
): Promise<void> {
  if (columns.has(name)) return;
  try {
    await db
      .prepare(`ALTER TABLE saved_ask_answers ADD COLUMN ${definition}`)
      .run();
  } catch (error) {
    if (!String(error).toLowerCase().includes("duplicate column")) throw error;
  }
}

async function ensureSavedAskSchema(db: D1Database): Promise<void> {
  schemaReady ??= (async () => {
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS saved_ask_answers (
          id TEXT PRIMARY KEY,
          userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
          question TEXT NOT NULL,
          answer TEXT NOT NULL,
          cite TEXT,
          kind TEXT,
          sourceHref TEXT,
          tools TEXT,
          createdAt INTEGER NOT NULL
        )`,
      )
      .run();

    const { results } = await db
      .prepare("PRAGMA table_info(saved_ask_answers)")
      .all<{ name: string }>();
    const columns = new Set((results ?? []).map((row) => row.name));

    await addColumnIfMissing(db, columns, "threadId", "threadId TEXT");
    await addColumnIfMissing(db, columns, "messageId", "messageId INTEGER");

    await db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_saved_ask_answers_user_created
          ON saved_ask_answers (userId, createdAt DESC, id DESC)`,
      )
      .run();
    await db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_saved_ask_answers_thread
          ON saved_ask_answers (userId, threadId, messageId)`,
      )
      .run();
  })().catch((error) => {
    schemaReady = null;
    throw error;
  });

  return schemaReady;
}

async function getDb(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true });
  const db = (env as SavedAskEnv).AUTH_DB;
  if (!db) {
    throw new Error(
      "Missing Cloudflare D1 binding AUTH_DB. Apply migrations before using saved Ask answers.",
    );
  }
  await ensureSavedAskSchema(db);
  return db;
}

export function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

interface Row {
  id: string;
  question: string;
  answer: string;
  cite: string | null;
  kind: string | null;
  sourceHref: string | null;
  threadId: string | null;
  messageId: number | null;
  tools: string | null;
  createdAt: number;
}

function toAnswer(row: Row): SavedAskAnswer {
  let tools: string[] = [];
  try {
    const parsed = row.tools ? JSON.parse(row.tools) : [];
    if (Array.isArray(parsed))
      tools = parsed.filter((t) => typeof t === "string");
  } catch {
    // ignore malformed tool summaries
  }
  return {
    id: row.id,
    question: row.question,
    answer: row.answer,
    cite: row.cite,
    kind: row.kind,
    sourceHref: row.sourceHref,
    threadId: row.threadId,
    messageId: row.messageId === null ? null : Number(row.messageId),
    tools,
    createdAt: Number(row.createdAt),
  };
}

export async function saveAskAnswer({
  userId,
  question,
  answer,
  cite,
  kind,
  sourceHref,
  threadId,
  messageId,
  tools,
}: {
  userId: string;
  question: string;
  answer: string;
  cite?: string;
  kind?: string;
  sourceHref?: string;
  threadId?: string;
  messageId?: number;
  tools?: string[];
}): Promise<SavedAskAnswer> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const createdAt = Date.now();
  const toolsJson = JSON.stringify(
    (tools ?? []).slice(0, 40).map((t) => String(t).slice(0, 200)),
  );
  await db
    .prepare(
      `INSERT INTO saved_ask_answers
        (id, userId, question, answer, cite, kind, sourceHref, threadId, messageId, tools, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      userId,
      question.slice(0, 8000),
      answer.slice(0, 100000),
      cite || null,
      kind || null,
      sourceHref || null,
      threadId || null,
      typeof messageId === "number" && Number.isFinite(messageId)
        ? Math.max(0, Math.trunc(messageId))
        : null,
      toolsJson,
      createdAt,
    )
    .run();
  return {
    id,
    question,
    answer,
    cite: cite || null,
    kind: kind || null,
    sourceHref: sourceHref || null,
    threadId: threadId || null,
    messageId:
      typeof messageId === "number" && Number.isFinite(messageId)
        ? Math.max(0, Math.trunc(messageId))
        : null,
    tools: tools ?? [],
    createdAt,
  };
}

export async function listAskAnswers(
  userId: string,
): Promise<SavedAskAnswer[]> {
  const db = await getDb();
  const { results } = await db
    .prepare(
      `SELECT id, question, answer, cite, kind, sourceHref, threadId, messageId, tools, createdAt
       FROM saved_ask_answers
       WHERE userId = ?
       ORDER BY createdAt DESC, id DESC
       LIMIT ?`,
    )
    .bind(userId, LIST_LIMIT)
    .all<Row>();
  return (results ?? []).map(toAnswer);
}

export async function deleteAskAnswer({
  userId,
  id,
}: {
  userId: string;
  id: string;
}): Promise<void> {
  const db = await getDb();
  await db
    .prepare(`DELETE FROM saved_ask_answers WHERE userId = ? AND id = ?`)
    .bind(userId, id)
    .run();
}
