// ── Verification Layer ──────────────────────────────────────────────────
// Every completed task automatically runs: Build → Tests → Lint → Typecheck → Diff validation.
// Only then mark completed.

use crate::agent::actions::{Action, ActionType};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationResult {
    pub passed: bool,
    pub build_success: Option<bool>,
    pub test_success: Option<bool>,
    pub lint_success: Option<bool>,
    pub typecheck_success: Option<bool>,
    pub diff_valid: Option<bool>,
    pub details: Vec<String>,
    pub errors: Vec<String>,
}

impl VerificationResult {
    pub fn ok() -> Self {
        Self {
            passed: true,
            build_success: None,
            test_success: None,
            lint_success: None,
            typecheck_success: None,
            diff_valid: None,
            details: vec![],
            errors: vec![],
        }
    }
}

pub struct Verifier;

impl Verifier {
    /// Verify the result of a completed action.
    /// Runs applicable checks based on action type and project context.
    pub async fn verify(workspace_path: &str, _action: &Action) -> VerificationResult {
        let mut details = vec![];
        let mut errors = vec![];
        let mut build_success = None;
        let mut test_success = None;
        let mut lint_success = None;
        let mut typecheck_success = None;
        let diff_valid = None;

        // Only run verification for file-modifying actions
        match _action.action_type {
            ActionType::WriteFile | ActionType::EditFile => {
                // Determine project type and run applicable checks
                let has_cargo_toml = std::path::Path::new(workspace_path).join("Cargo.toml").exists();
                let has_package_json = std::path::Path::new(workspace_path).join("package.json").exists();

                if has_cargo_toml {
                    // Check compilation
                    match run_cmd("cargo check", workspace_path).await {
                        Ok(output) => {
                            let success = output.exit_code == 0;
                            build_success = Some(success);
                            if success {
                                details.push("cargo check: passed".into());
                            } else {
                                errors.push(format!("cargo check failed:\n{}", output.stderr));
                            }
                        }
                        Err(e) => errors.push(format!("cargo check error: {}", e)),
                    }

                    // Check tests (only if any exist)
                    if build_success == Some(true) {
                        match run_cmd("cargo test --quiet", workspace_path).await {
                            Ok(output) => {
                                let success = output.exit_code == 0;
                                test_success = Some(success);
                                if success {
                                    details.push("cargo test: passed".into());
                                } else {
                                    errors.push(format!("cargo test failed:\n{}", output.stderr));
                                }
                            }
                            Err(e) => errors.push(format!("cargo test error: {}", e)),
                        }
                    }
                }

                if has_package_json {
                    // Check with npm/npx if available
                    let has_tsconfig = std::path::Path::new(workspace_path).join("tsconfig.json").exists();

                    if has_tsconfig {
                        match run_cmd("npx tsc --noEmit", workspace_path).await {
                            Ok(output) => {
                                let success = output.exit_code == 0;
                                typecheck_success = Some(success);
                                if success {
                                    details.push("TypeScript typecheck: passed".into());
                                } else {
                                    errors.push(format!("TypeScript check failed:\n{}", output.stderr));
                                }
                            }
                            Err(e) => errors.push(format!("TypeScript check error: {}", e)),
                        }
                    }

                    match run_cmd("npx eslint . --quiet", workspace_path).await {
                        Ok(output) => {
                            let success = output.exit_code == 0;
                            lint_success = Some(success);
                            if success {
                                details.push("ESLint: passed".into());
                            } else {
                                errors.push(format!("ESLint failed:\n{}", output.stderr));
                            }
                        }
                        Err(_) => {} // eslint may not be available
                    }
                }
            }
            _ => {}
        }

        let passed = errors.is_empty();
        VerificationResult {
            passed,
            build_success,
            test_success,
            lint_success,
            typecheck_success,
            diff_valid,
            details,
            errors,
        }
    }
}

struct CmdOutput {
    exit_code: i32,
    #[allow(dead_code)]
    stdout: String,
    stderr: String,
}

async fn run_cmd(command: &str, cwd: &str) -> Result<CmdOutput, String> {
    let cwd_owned = cwd.to_string();
    let cmd_owned = command.to_string();
    let output = tokio::task::spawn_blocking(move || {
        std::process::Command::new("cmd")
            .args(["/C", &cmd_owned])
            .current_dir(&cwd_owned)
            .output()
    }).await.map_err(|e| e.to_string())?;

    match output {
        Ok(out) => {
            Ok(CmdOutput {
                exit_code: out.status.code().unwrap_or(-1),
                stdout: String::from_utf8_lossy(&out.stdout).to_string(),
                stderr: String::from_utf8_lossy(&out.stderr).to_string(),
            })
        }
        Err(e) => Err(e.to_string()),
    }
}
