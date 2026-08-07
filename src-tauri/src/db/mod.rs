// ── Database Layer ─────────────────────────────────────────────────────────
// SQLite via rusqlite. Shared via Arc<Mutex<Connection>>.
// Migrations run at startup.

pub mod migrations;
pub mod models;
pub mod queries;

use anyhow::Result;
use rusqlite::Connection;
use std::sync::{Arc, Mutex};

pub type DbPool = Arc<Mutex<Connection>>;

/// Open (or create) the SQLite database file at the given path,
/// run all pending migrations, and return a pool handle.
pub fn open(path: &str) -> Result<DbPool> {
    let conn = Connection::open(path)?;

    // WAL mode for better concurrent read performance
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;

    migrations::run(&conn)?;

    Ok(Arc::new(Mutex::new(conn)))
}
