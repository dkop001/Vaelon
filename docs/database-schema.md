# SQLite Database Schema — Flow v1.0

## Overview
Single SQLite database file (`flow.db`) replaces Supabase (notes) and Neon (chat history). All data stored locally on user's machine.

## File Location
- **macOS:** `~/Library/Application Support/com.flow.app/flow.db`
- **Windows:** `%APPDATA%\Flow\flow.db`
- **Linux:** `~/.local/share/Flow/flow.db`

## Tables

### 1. projects
Collections of notes, tasks, and AI context around a single goal.

```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  color TEXT DEFAULT '#6366f1',
  archived INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

### 2. notes
Individual notes belonging to projects.

```sql
CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled Note',
  content TEXT DEFAULT '',
  tags TEXT DEFAULT '[]',  -- JSON array of strings
  pinned INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX idx_notes_project ON notes(project_id);
CREATE INDEX idx_notes_updated ON notes(updated_at DESC);
```

### 3. ai_cache
Cached AI outputs (summaries, quizzes, TTS) tied to notes.

```sql
CREATE TABLE ai_cache (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL,
  type TEXT NOT NULL,  -- 'summary' | 'quiz' | 'tts' | 'flashcards'
  content TEXT NOT NULL,
  model_used TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
);

CREATE INDEX idx_ai_cache_note ON ai_cache(note_id, type);
```

### 4. chat_sessions
Persistent chat sessions tied to projects.

```sql
CREATE TABLE chat_sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT DEFAULT 'New Chat',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX idx_chat_sessions_project ON chat_sessions(project_id);
```

### 5. chat_messages
Individual messages within chat sessions.

```sql
CREATE TABLE chat_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,  -- 'user' | 'assistant' | 'system'
  content TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_chat_messages_session ON chat_messages(session_id, created_at);
```

### 6. build_logs
Agent execution logs written back to Mode 1.

```sql
CREATE TABLE build_logs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  goal TEXT NOT NULL,
  steps_json TEXT NOT NULL,  -- JSON array of {step, command, description, status}
  outcome TEXT NOT NULL,     -- 'success' | 'partial' | 'failed'
  notes TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX idx_build_logs_project ON build_logs(project_id);
```

### 7. embeddings
Vector embeddings for RAG (Phase 3).

```sql
CREATE TABLE embeddings (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  vector_blob BLOB NOT NULL,  -- Float32Array as binary
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
);

CREATE INDEX idx_embeddings_note ON embeddings(note_id);
```

### 8. app_config
User settings (AI mode, selected model, theme, etc.)

```sql
CREATE TABLE app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Default settings
INSERT INTO app_config (key, value) VALUES
  ('ai_mode', 'auto'),
  ('ollama_model', 'llama3.2:3b'),
  ('theme', 'dark'),
  ('sidebar_collapsed', 'false');
```

### 9. study_sessions
Study session logs for spaced repetition.

```sql
CREATE TABLE study_sessions (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL,
  project_id TEXT,
  quiz_score REAL,  -- 0.0 to 1.0
  questions_total INTEGER,
  questions_correct INTEGER,
  duration_seconds INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

CREATE INDEX idx_study_sessions_note ON study_sessions(note_id);
```

### 10. spaced_repetition
Tracks which quiz questions need review.

```sql
CREATE TABLE spaced_repetition (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL,
  question_hash TEXT NOT NULL,  -- Hash of question text
  ease_factor REAL DEFAULT 2.5,
  interval_days INTEGER DEFAULT 1,
  next_review TEXT NOT NULL,
  last_review TEXT,
  repetitions INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
  UNIQUE(note_id, question_hash)
);

CREATE INDEX idx_spaced_review ON spaced_repetition(next_review);
```

## Migration Strategy

### From localStorage (Phase 0)
```javascript
// On first Tauri launch, migrate existing localStorage data
async function migrateFromLocalStorage() {
  const notes = JSON.parse(localStorage.getItem('noteai-notes') || '[]');
  const aiCache = JSON.parse(localStorage.getItem('noteai-aicache') || '{}');

  // Create default project
  const defaultProject = {
    id: 'default',
    name: 'My Notes',
    color: '#6366f1',
  };

  // Insert into SQLite via Tauri invoke
  await invoke('create_project', { project: defaultProject });

  // Migrate notes
  for (const note of notes) {
    await invoke('create_note', {
      note: {
        ...note,
        project_id: 'default',
        tags: '[]',
        pinned: 0,
      }
    });
  }

  // Migrate AI cache
  for (const [noteId, cache] of Object.entries(aiCache)) {
    for (const [type, content] of Object.entries(cache)) {
      if (content) {
        await invoke('save_ai_cache', {
          cache: { note_id: noteId, type, content, model_used: 'unknown' }
        });
      }
    }
  }
}
```

### From Supabase (Phase 1)
```javascript
// Optional: Import existing Supabase data
async function importFromSupabase(supabaseUrl, supabaseKey) {
  // Fetch notes, chat sessions, messages from Supabase
  // Insert into local SQLite
  // This is a one-time migration tool
}
```

## Tauri Commands (Rust)

```rust
// Commands to register in main.rs
#[tauri::command]
fn create_project(project: Project) -> Result<String, String>

#[tauri::command]
fn get_projects() -> Result<Vec<Project>, String>

#[tauri::command]
fn create_note(note: Note) -> Result<String, String>

#[tauri::command]
fn update_note(id: String, patch: NotePatch) -> Result<(), String>

#[tauri::command]
fn delete_note(id: String) -> Result<(), String>

#[tauri::command]
fn get_notes(project_id: String) -> Result<Vec<Note>, String>

#[tauri::command]
fn save_ai_cache(cache: AiCacheEntry) -> Result<(), String>

#[tauri::command]
fn get_ai_cache(note_id: String, cache_type: String) -> Result<Option<String>, String>

#[tauri::command]
fn create_chat_session(session: ChatSession) -> Result<String, String>

#[tauri::command]
fn save_chat_message(message: ChatMessage) -> Result<(), String>

#[tauri::command]
fn get_chat_history(session_id: String) -> Result<Vec<ChatMessage>, String>

#[tauri::command]
fn save_build_log(log: BuildLog) -> Result<(), String>

#[tauri::command]
fn get_build_logs(project_id: String) -> Result<Vec<BuildLog>, String>

#[tauri::command]
fn get_config(key: String) -> Result<Option<String>, String>

#[tauri::command]
fn set_config(key: String, value: String) -> Result<(), String>
```

## Indexes Summary

| Table | Index | Purpose |
|-------|-------|---------|
| notes | project_id | Fast project note listing |
| notes | updated_at DESC | Recent notes first |
| ai_cache | note_id, type | Fast cache lookup |
| chat_sessions | project_id | Project chat listing |
| chat_messages | session_id, created_at | Ordered message history |
| build_logs | project_id | Project build history |
| embeddings | note_id | RAG chunk retrieval |
| spaced_repetition | next_review | Due review queue |
