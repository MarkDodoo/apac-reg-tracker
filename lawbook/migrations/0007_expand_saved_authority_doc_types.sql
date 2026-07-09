CREATE TABLE IF NOT EXISTS saved_authorities_new (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  docType TEXT NOT NULL CHECK (docType IN ('judgment', 'statute', 'hansard', 'bills', 'subsidiary', 'practice')),
  docId TEXT NOT NULL,
  title TEXT NOT NULL,
  path TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

INSERT OR IGNORE INTO saved_authorities_new (
  id,
  userId,
  docType,
  docId,
  title,
  path,
  createdAt,
  updatedAt
)
SELECT
  id,
  userId,
  docType,
  docId,
  title,
  path,
  createdAt,
  updatedAt
FROM saved_authorities
WHERE docType IN ('judgment', 'statute', 'hansard', 'bills', 'subsidiary', 'practice');

DROP TABLE saved_authorities;
ALTER TABLE saved_authorities_new RENAME TO saved_authorities;

CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_authorities_user_doc
  ON saved_authorities (userId, docType, docId);

CREATE INDEX IF NOT EXISTS idx_saved_authorities_user_created
  ON saved_authorities (userId, createdAt DESC, id DESC);
