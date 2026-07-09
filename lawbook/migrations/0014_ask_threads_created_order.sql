CREATE INDEX IF NOT EXISTS idx_ask_threads_user_created
  ON ask_threads (userId, createdAt DESC, id DESC);
