CREATE TABLE IF NOT EXISTS saved_answers (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_saved_answers_user_updated
  ON saved_answers (userId, updatedAt DESC, createdAt DESC, id DESC);
