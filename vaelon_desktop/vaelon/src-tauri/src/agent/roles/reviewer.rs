// ── Reviewer Role ─────────────────────────────────────────────────────────
// Static validation of generated code. No LLM — pure heuristic checks.

#[derive(Debug, Clone)]
pub struct ReviewResult {
    pub pass: bool,
    pub issues: Vec<ReviewIssue>,
}

#[derive(Debug, Clone)]
pub struct ReviewIssue {
    pub severity: &'static str, // "error" | "warning"
    pub message: String,
}

pub fn review_file(path: &str, content: &str) -> ReviewResult {
    let mut issues = vec![];

    // Check for empty content
    if content.trim().is_empty() {
        issues.push(ReviewIssue { severity: "error", message: "File content is empty".into() });
        return ReviewResult { pass: false, issues };
    }

    // Check for accidental markdown fences
    if content.contains("```") {
        issues.push(ReviewIssue { severity: "error", message: "Content contains markdown code fences".into() });
    }

    // Language-specific checks
    let ext = std::path::Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");

    match ext {
        "js" | "ts" | "jsx" | "tsx" => {
            check_braces(content, &mut issues);
            check_dangerous_patterns(content, &mut issues);
        }
        "rs" => {
            check_braces(content, &mut issues);
            check_dangerous_patterns(content, &mut issues);
        }
        "json" => {
            if serde_json::from_str::<serde_json::Value>(content).is_err() {
                issues.push(ReviewIssue { severity: "error", message: "Invalid JSON".into() });
            }
        }
        _ => {}
    }

    let has_errors = issues.iter().any(|i| i.severity == "error");
    ReviewResult { pass: !has_errors, issues }
}

fn check_braces(content: &str, issues: &mut Vec<ReviewIssue>) {
    let opens = content.chars().filter(|&c| c == '{').count();
    let closes = content.chars().filter(|&c| c == '}').count();
    if opens != closes {
        issues.push(ReviewIssue {
            severity: "error",
            message: format!("Mismatched braces: {} open vs {} close", opens, closes),
        });
    }
}

fn check_dangerous_patterns(content: &str, issues: &mut Vec<ReviewIssue>) {
    let dangerous = ["eval(", "exec(", "__import__", "os.system(", "subprocess.call("];
    for pattern in &dangerous {
        if content.contains(pattern) {
            issues.push(ReviewIssue {
                severity: "warning",
                message: format!("Potentially dangerous pattern: {}", pattern),
            });
        }
    }
}

pub fn review_command_result(stdout: &str, stderr: &str, exit_code: i32) -> ReviewResult {
    let mut issues = vec![];

    if exit_code != 0 {
        issues.push(ReviewIssue {
            severity: "error",
            message: format!("Command exited with code {}: {}", exit_code, stderr.trim()),
        });
    }

    // Common error patterns in stderr
    let error_patterns = ["Error:", "error:", "FAILED", "Cannot find module", "ModuleNotFoundError"];
    for pattern in &error_patterns {
        if stderr.contains(pattern) {
            issues.push(ReviewIssue {
                severity: "error",
                message: format!("stderr contains '{}'", pattern),
            });
            break;
        }
    }

    let has_errors = issues.iter().any(|i| i.severity == "error");
    ReviewResult { pass: !has_errors, issues }
}
