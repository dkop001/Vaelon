// ── Terminal Manager ──────────────────────────────────────────────────────
// Manages PTY sessions. Each terminal is a pseudo-terminal backed by the
// system shell. Output is streamed to the frontend via Tauri events.
//
// Events emitted:
//   terminal:output  { id: String, data: String }
//   terminal:exit    { id: String, code: i32 }

use anyhow::Result;
use dashmap::DashMap;
use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use serde::{Deserialize, Serialize};
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalOutputEvent {
    pub id: String,
    pub data: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalExitEvent {
    pub id: String,
    pub code: i32,
}

struct TerminalSession {
    writer: Box<dyn Write + Send>,
    master: Box<dyn portable_pty::MasterPty + Send>,
}

pub struct TerminalManager {
    sessions: DashMap<String, Arc<Mutex<TerminalSession>>>,
}

impl TerminalManager {
    pub fn new() -> Self {
        Self { sessions: DashMap::new() }
    }

    /// Spawn a new PTY session. Returns the terminal ID.
    pub fn spawn(&self, app: AppHandle, shell: Option<&str>, cwd: Option<&str>) -> Result<String> {
        let id = Uuid::new_v4().to_string();
        let pty_system = NativePtySystem::default();

        let pair = pty_system.openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })?;

        // Build shell command
        let shell_path = shell.map(|s| s.to_string()).unwrap_or_else(default_shell);
        let mut cmd = CommandBuilder::new(&shell_path);

        if let Some(dir) = cwd {
            cmd.cwd(dir);
        }

        let mut child = pair.slave.spawn_command(cmd)?;

        // Read output in a background thread
        let mut reader = pair.master.try_clone_reader()?;
        let id_clone = id.clone();
        let app_clone = app.clone();

        thread::spawn(move || {
            let mut buf = [0u8; 4096];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        let data = String::from_utf8_lossy(&buf[..n]).to_string();
                        let _ = app_clone.emit("terminal:output", TerminalOutputEvent {
                            id: id_clone.clone(),
                            data,
                        });
                    }
                    Err(_) => break,
                }
            }

            // Process exited
            let code = child.wait().map(|s| s.exit_code() as i32).unwrap_or(-1);
            let _ = app_clone.emit("terminal:exit", TerminalExitEvent {
                id: id_clone,
                code,
            });
        });

        let writer = pair.master.take_writer()?;
        let session = Arc::new(Mutex::new(TerminalSession {
            writer,
            master: pair.master,
        }));

        self.sessions.insert(id.clone(), session);
        Ok(id)
    }

    /// Write data (keystrokes) to a terminal's stdin.
    pub fn write(&self, id: &str, data: &str) -> Result<()> {
        if let Some(session) = self.sessions.get(id) {
            let mut s = session.lock().unwrap();
            s.writer.write_all(data.as_bytes())?;
            s.writer.flush()?;
        }
        Ok(())
    }

    /// Resize the PTY.
    pub fn resize(&self, id: &str, cols: u16, rows: u16) -> Result<()> {
        if let Some(session) = self.sessions.get(id) {
            let s = session.lock().unwrap();
            s.master.resize(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 })?;
        }
        Ok(())
    }

    /// Kill a terminal session.
    pub fn kill(&self, id: &str) {
        self.sessions.remove(id);
    }
}

#[cfg(target_os = "windows")]
fn default_shell() -> String {
    std::env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".into())
}

#[cfg(not(target_os = "windows"))]
fn default_shell() -> String {
    std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".into())
}
