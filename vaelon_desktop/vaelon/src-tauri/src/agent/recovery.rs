// ── Failure Recovery ──────────────────────────────────────────────────────
// Analyzes a failed tool result and generates repair actions.

use crate::agent::actions::{Action, ActionType, ToolResult};

pub fn analyze_failure(action: &Action, result: &ToolResult) -> Vec<Action> {
    let mut repairs = vec![];
    let error = result.error.as_deref().unwrap_or("");

    match action.action_type {
        ActionType::RunCommand => {
            // Missing dependency
            if error.contains("Cannot find module") || error.contains("Module not found") {
                if let Some(module) = extract_module_name(error) {
                    repairs.push(Action::run_command(
                        format!("npm install {}", module),
                        action.cwd.clone(),
                        format!("Install missing module: {}", module),
                    ));
                }
            }

            if error.contains("command not found") || error.contains("is not recognized") {
                repairs.push(Action::new(ActionType::Think, format!("Command not found. Check tool installation: {}", action.command.as_deref().unwrap_or("?"))));
            }

            if error.contains("Permission denied") || error.contains("EACCES") {
                repairs.push(Action::run_command(
                    format!("chmod +x {}", action.command.as_deref().unwrap_or(".")),
                    action.cwd.clone(),
                    "Fix permissions",
                ));
            }
        }

        ActionType::WriteFile | ActionType::EditFile => {
            // Parent directory doesn't exist
            if error.contains("No such file or directory") || error.contains("cannot find the path") {
                if let Some(path) = &action.path {
                    if let Some(parent) = std::path::Path::new(path).parent() {
                        repairs.push(Action::run_command(
                            format!("mkdir -p \"{}\"", parent.display()),
                            None,
                            format!("Create parent directories for {}", path),
                        ));
                    }
                }
            }
        }

        _ => {
            // Generic: just log the failure
            repairs.push(Action::new(ActionType::Think, format!("Analyze failure: {}", error)));
        }
    }

    repairs
}

fn extract_module_name(error: &str) -> Option<String> {
    // Node: Cannot find module 'xyz'
    if let Some(start) = error.find("Cannot find module '") {
        let rest = &error[start + 20..];
        if let Some(end) = rest.find('\'') {
            return Some(rest[..end].to_string());
        }
    }
    None
}
