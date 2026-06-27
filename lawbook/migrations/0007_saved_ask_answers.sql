CREATE TABLE IF NOT EXISTS saved_ask_answers (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,            -- final answer markdown
  cite TEXT,                       -- optional grounding citation (e.g. 2026_SGHC_88)
  kind TEXT,                       -- judgment | statute | ...
  sourceHref TEXT,                 -- deep link to the grounded source, when available
  tools TEXT,                      -- JSON array of tool-step summaries
  createdAt INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_saved_ask_answers_user_created
  ON saved_ask_answers (userId, createdAt DESC, id DESC);
