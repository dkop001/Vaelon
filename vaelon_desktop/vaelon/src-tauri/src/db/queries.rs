// ── DB Query Helpers ──────────────────────────────────────────────────────
// All CRUD operations. Takes a &Mutex<Connection> lock for each call.

use crate::db::{models::*, DbPool};
use anyhow::Result;
use rusqlite::params;

// ── Workspaces ────────────────────────────────────────────────────────────

pub fn workspace_list(pool: &DbPool) -> Result<Vec<Workspace>> {
    let conn = pool.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT id, name, path, description, created_at, updated_at FROM workspaces ORDER BY created_at"
    )?;
    let rows = stmt.query_map([], |r| {
        Ok(Workspace {
            id: r.get(0)?,
            name: r.get(1)?,
            path: r.get(2)?,
            description: r.get(3)?,
            created_at: r.get(4)?,
            updated_at: r.get(5)?,
        })
    })?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

pub fn workspace_create(pool: &DbPool, ws: &Workspace) -> Result<()> {
    let conn = pool.lock().unwrap();
    conn.execute(
        "INSERT INTO workspaces (id, name, path, description, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6)",
        params![ws.id, ws.name, ws.path, ws.description, ws.created_at, ws.updated_at],
    )?;
    Ok(())
}

pub fn workspace_delete(pool: &DbPool, id: &str) -> Result<()> {
    let conn = pool.lock().unwrap();
    conn.execute("DELETE FROM workspaces WHERE id = ?1", params![id])?;
    Ok(())
}

// ── Projects ──────────────────────────────────────────────────────────────

pub fn project_list(pool: &DbPool, workspace_id: &str) -> Result<Vec<Project>> {
    let conn = pool.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT id, workspace_id, name, description, color, archived, created_at, updated_at
         FROM projects WHERE workspace_id = ?1 ORDER BY created_at"
    )?;
    let rows = stmt.query_map(params![workspace_id], |r| {
        Ok(Project {
            id: r.get(0)?,
            workspace_id: r.get(1)?,
            name: r.get(2)?,
            description: r.get(3)?,
            color: r.get(4)?,
            archived: r.get::<_, i64>(5)? != 0,
            created_at: r.get(6)?,
            updated_at: r.get(7)?,
        })
    })?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

pub fn project_create(pool: &DbPool, p: &Project) -> Result<()> {
    let conn = pool.lock().unwrap();
    conn.execute(
        "INSERT INTO projects (id, workspace_id, name, description, color, archived, created_at, updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
        params![p.id, p.workspace_id, p.name, p.description, p.color, p.archived as i64, p.created_at, p.updated_at],
    )?;
    Ok(())
}

pub fn project_delete(pool: &DbPool, id: &str) -> Result<()> {
    let conn = pool.lock().unwrap();
    conn.execute("DELETE FROM projects WHERE id = ?1", params![id])?;
    Ok(())
}

// ── Notes ─────────────────────────────────────────────────────────────────

pub fn note_list(pool: &DbPool, workspace_id: &str, project_id: Option<&str>) -> Result<Vec<Note>> {
    let conn = pool.lock().unwrap();
    let sql = match project_id {
        Some(_) => "SELECT id, workspace_id, project_id, title, content, tags, summary, pinned, created_at, updated_at
                    FROM notes WHERE workspace_id = ?1 AND project_id = ?2 ORDER BY pinned DESC, updated_at DESC",
        None => "SELECT id, workspace_id, project_id, title, content, tags, summary, pinned, created_at, updated_at
                 FROM notes WHERE workspace_id = ?1 ORDER BY pinned DESC, updated_at DESC",
    };

    let rows = if let Some(pid) = project_id {
        let mut stmt = conn.prepare(sql)?;
        let r = stmt.query_map(params![workspace_id, pid], parse_note)?;
        r.filter_map(|r| r.ok()).collect()
    } else {
        let mut stmt = conn.prepare(sql)?;
        let r = stmt.query_map(params![workspace_id], parse_note)?;
        r.filter_map(|r| r.ok()).collect()
    };
    Ok(rows)
}

fn parse_note(r: &rusqlite::Row) -> rusqlite::Result<Note> {
    let tags_str: String = r.get(5)?;
    let tags: Vec<String> = serde_json::from_str(&tags_str).unwrap_or_default();
    Ok(Note {
        id: r.get(0)?,
        workspace_id: r.get(1)?,
        project_id: r.get(2)?,
        title: r.get(3)?,
        content: r.get(4)?,
        tags,
        summary: r.get(6)?,
        pinned: r.get::<_, i64>(7)? != 0,
        created_at: r.get(8)?,
        updated_at: r.get(9)?,
    })
}

pub fn note_get(pool: &DbPool, id: &str) -> Result<Option<Note>> {
    let conn = pool.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT id, workspace_id, project_id, title, content, tags, summary, pinned, created_at, updated_at
         FROM notes WHERE id = ?1"
    )?;
    let mut rows = stmt.query_map(params![id], parse_note)?;
    Ok(rows.next().and_then(|r| r.ok()))
}

pub fn note_create(pool: &DbPool, n: &Note) -> Result<()> {
    let conn = pool.lock().unwrap();
    let tags_json = serde_json::to_string(&n.tags)?;
    conn.execute(
        "INSERT INTO notes (id, workspace_id, project_id, title, content, tags, summary, pinned, created_at, updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
        params![n.id, n.workspace_id, n.project_id, n.title, n.content, tags_json, n.summary, n.pinned as i64, n.created_at, n.updated_at],
    )?;
    Ok(())
}

pub fn note_update(pool: &DbPool, n: &Note) -> Result<()> {
    let conn = pool.lock().unwrap();
    let tags_json = serde_json::to_string(&n.tags)?;
    let updated_at = chrono::Utc::now().naive_utc().format("%Y-%m-%dT%H:%M:%S").to_string();
    conn.execute(
        "UPDATE notes SET title=?1, content=?2, tags=?3, summary=?4, pinned=?5, updated_at=?6 WHERE id=?7",
        params![n.title, n.content, tags_json, n.summary, n.pinned as i64, updated_at, n.id],
    )?;
    Ok(())
}

pub fn note_delete(pool: &DbPool, id: &str) -> Result<()> {
    let conn = pool.lock().unwrap();
    conn.execute("DELETE FROM notes WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn note_search_fts(pool: &DbPool, workspace_id: &str, query: &str) -> Result<Vec<SearchResult>> {
    let conn = pool.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT n.id, n.title, snippet(notes_fts, 1, '<mark>', '</mark>', '...', 32), n.updated_at
         FROM notes_fts
         JOIN notes n ON n.rowid = notes_fts.rowid
         WHERE notes_fts MATCH ?1 AND n.workspace_id = ?2
         ORDER BY rank
         LIMIT 50"
    )?;
    let rows = stmt.query_map(params![query, workspace_id], |r| {
        Ok(SearchResult {
            note_id: r.get(0)?,
            title: r.get(1)?,
            snippet: r.get(2)?,
            score: 1.0,
            updated_at: r.get(3)?,
        })
    })?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

// ── Chat ──────────────────────────────────────────────────────────────────

pub fn chat_session_create(pool: &DbPool, s: &ChatSession) -> Result<()> {
    let conn = pool.lock().unwrap();
    conn.execute(
        "INSERT INTO chat_sessions (id, workspace_id, project_id, title, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6)",
        params![s.id, s.workspace_id, s.project_id, s.title, s.created_at, s.updated_at],
    )?;
    Ok(())
}

pub fn chat_session_list(pool: &DbPool, workspace_id: &str) -> Result<Vec<ChatSession>> {
    let conn = pool.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT id, workspace_id, project_id, title, created_at, updated_at
         FROM chat_sessions WHERE workspace_id = ?1 ORDER BY updated_at DESC"
    )?;
    let rows = stmt.query_map(params![workspace_id], |r| {
        Ok(ChatSession {
            id: r.get(0)?,
            workspace_id: r.get(1)?,
            project_id: r.get(2)?,
            title: r.get(3)?,
            created_at: r.get(4)?,
            updated_at: r.get(5)?,
        })
    })?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

pub fn chat_message_insert(pool: &DbPool, m: &ChatMessage) -> Result<()> {
    let conn = pool.lock().unwrap();
    let meta_str = serde_json::to_string(&m.metadata)?;
    conn.execute(
        "INSERT INTO chat_messages (id, session_id, role, content, metadata, created_at) VALUES (?1,?2,?3,?4,?5,?6)",
        params![m.id, m.session_id, m.role, m.content, meta_str, m.created_at],
    )?;
    // Update session timestamp
    conn.execute(
        "UPDATE chat_sessions SET updated_at = ?1 WHERE id = ?2",
        params![m.created_at, m.session_id],
    )?;
    Ok(())
}

pub fn chat_messages_list(pool: &DbPool, session_id: &str) -> Result<Vec<ChatMessage>> {
    let conn = pool.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT id, session_id, role, content, metadata, created_at FROM chat_messages WHERE session_id = ?1 ORDER BY created_at"
    )?;
    let rows = stmt.query_map(params![session_id], |r| {
        let meta_str: String = r.get(4)?;
        let metadata: serde_json::Value = serde_json::from_str(&meta_str).unwrap_or_default();
        Ok(ChatMessage {
            id: r.get(0)?,
            session_id: r.get(1)?,
            role: r.get(2)?,
            content: r.get(3)?,
            metadata,
            created_at: r.get(5)?,
        })
    })?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

// ── App Config ────────────────────────────────────────────────────────────

pub fn config_get(pool: &DbPool, key: &str) -> Result<Option<String>> {
    let conn = pool.lock().unwrap();
    let mut stmt = conn.prepare("SELECT value FROM app_config WHERE key = ?1")?;
    let mut rows = stmt.query_map(params![key], |r| r.get::<_, String>(0))?;
    Ok(rows.next().and_then(|r| r.ok()))
}

pub fn config_set(pool: &DbPool, key: &str, value: &str) -> Result<()> {
    let conn = pool.lock().unwrap();
    let ts = chrono::Utc::now().naive_utc().format("%Y-%m-%dT%H:%M:%S").to_string();
    conn.execute(
        "INSERT INTO app_config (key, value, updated_at) VALUES (?1,?2,?3)
         ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at",
        params![key, value, ts],
    )?;
    Ok(())
}
