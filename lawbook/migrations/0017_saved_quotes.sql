CREATE TABLE IF NOT EXISTS saved_quotes (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  docType TEXT NOT NULL CHECK (docType IN ('judgment', 'statute')),
  docId TEXT NOT NULL,
  exactText TEXT NOT NULL,
  sourceTitle TEXT NOT NULL,
  citation TEXT NOT NULL,
  path TEXT NOT NULL,
  anchor TEXT NOT NULL,
  startOffset INTEGER NOT NULL,
  endOffset INTEGER NOT NULL,
  contextBefore TEXT NOT NULL,
  contextAfter TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  deletedAt INTEGER
);

CREATE INDEX IF NOT EXISTS idx_saved_quotes_user_created
  ON saved_quotes (userId, createdAt DESC, id DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_quotes_active_location
  ON saved_quotes (
    userId, docType, docId, anchor, startOffset, endOffset, exactText
  ) WHERE deletedAt IS NULL;
