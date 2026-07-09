ALTER TABLE saved_ask_answers ADD COLUMN threadId TEXT;
ALTER TABLE saved_ask_answers ADD COLUMN messageId INTEGER;

CREATE INDEX IF NOT EXISTS idx_saved_ask_answers_thread
  ON saved_ask_answers (userId, threadId, messageId);
