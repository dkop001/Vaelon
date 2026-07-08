use std::fs;
use std::path::PathBuf;

fn get_notes_dir() -> PathBuf {
    let mut path = dirs::document_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("Flow");
    path.push("notes");
    fs::create_dir_all(&path).ok();
    path
}

#[tauri::command]
fn read_file_cmd(path: String) -> Result<String, String> {
    let notes_dir = get_notes_dir();
    let full_path = notes_dir.join(&path);
    fs::read_to_string(&full_path).map_err(|e| format!("Failed to read {}: {}", path, e))
}

#[tauri::command]
fn write_file_cmd(path: String, content: String) -> Result<(), String> {
    let notes_dir = get_notes_dir();
    let full_path = notes_dir.join(&path);
    if let Some(parent) = full_path.parent() {
        fs::create_dir_all(parent).ok();
    }
    fs::write(&full_path, &content).map_err(|e| format!("Failed to write {}: {}", path, e))
}

#[tauri::command]
fn list_files_cmd(path: String) -> Result<Vec<serde_json::Value>, String> {
    let notes_dir = get_notes_dir();
    let full_path = notes_dir.join(&path);
    let entries = fs::read_dir(&full_path).map_err(|e| format!("Failed to list {}: {}", path, e))?;

    let mut files = Vec::new();
    for entry in entries.flatten() {
        let metadata = entry.metadata().ok();
        files.push(serde_json::json!({
            "name": entry.file_name().to_string_lossy(),
            "isDir": metadata.as_ref().map(|m| m.is_dir()).unwrap_or(false),
            "size": metadata.as_ref().map(|m| m.len()).unwrap_or(0),
        }));
    }
    Ok(files)
}

#[tauri::command]
fn delete_file_cmd(path: String) -> Result<(), String> {
    let notes_dir = get_notes_dir();
    let full_path = notes_dir.join(&path);
    fs::remove_file(&full_path).map_err(|e| format!("Failed to delete {}: {}", path, e))
}

#[tauri::command]
fn run_shell_command(command: String) -> Result<serde_json::Value, String> {
    let output = std::process::Command::new("cmd")
        .args(["/C", &command])
        .output()
        .map_err(|e| format!("Failed to run command: {}", e))?;

    Ok(serde_json::json!({
        "stdout": String::from_utf8_lossy(&output.stdout),
        "stderr": String::from_utf8_lossy(&output.stderr),
        "code": output.status.code(),
    }))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            read_file_cmd,
            write_file_cmd,
            list_files_cmd,
            delete_file_cmd,
            run_shell_command,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
