-- Chat History tables for NoteAI
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New query)

-- chat_sessions: one per (user, note) pair
CREATE TABLE IF NOT EXISTS chat_sessions (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  note_id    TEXT NOT NULL,
  title      TEXT DEFAULT 'Untitled',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, note_id)
);

-- chat_messages: ordered messages within a session
CREATE TABLE IF NOT EXISTS chat_messages (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, created_at);

-- ── Row Level Security ──
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Sessions: users can only access their own
CREATE POLICY "Users can view own chat sessions"
  ON chat_sessions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own chat sessions"
  ON chat_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chat sessions"
  ON chat_sessions FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own chat sessions"
  ON chat_sessions FOR DELETE USING (auth.uid() = user_id);

-- Messages: users can only access messages in their own sessions
CREATE POLICY "Users can view own chat messages"
  ON chat_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM chat_sessions WHERE id = session_id AND user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own chat messages"
  ON chat_messages FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM chat_sessions WHERE id = session_id AND user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own chat messages"
  ON chat_messages FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM chat_sessions WHERE id = session_id AND user_id = auth.uid()
  ));
