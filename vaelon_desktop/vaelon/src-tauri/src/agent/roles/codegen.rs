// ── CodeGen Role ──────────────────────────────────────────────────────────
// Generates file content for WRITE_FILE actions.
// Responds with raw code only — no markdown fences, no JSON wrapper.

use crate::agent::actions::Action;
use crate::llm::{complete, LlmMessage, LlmRequest, LlmSettings};
use anyhow::Result;

const SYSTEM_PROMPT: &str = r#"You are the CodeGen component of an autonomous coding agent.

Your ONLY job is to produce the raw content of a file. Output ONLY the file content.
- No markdown code fences
- No explanation text before or after
- No JSON wrapper
- Complete, working code only

Follow these rules:
- Match the language implied by the file extension
- Use best practices and clean code
- Handle edge cases
- Do not include TODO comments — implement everything
"#;

pub async fn generate(action: &Action, context: &str, settings: &LlmSettings) -> Result<String> {
    let path = action.path.as_deref().unwrap_or("unknown");
    let user_prompt = format!(
        "File to create: {}\nDescription: {}\n\nProject context:\n{}",
        path,
        action.description,
        context
    );

    let req = LlmRequest {
        messages: vec![
            LlmMessage { role: "system".into(), content: SYSTEM_PROMPT.into() },
            LlmMessage { role: "user".into(), content: user_prompt },
        ],
        temperature: Some(0.1),
        max_tokens: Some(4000),
        json_mode: false,
        model: None,
        session_id: "codegen".into(),
    };

    let content = complete(req, settings).await?;
    // Strip any accidental markdown fences
    Ok(strip_fences(&content))
}

fn strip_fences(s: &str) -> String {
    let s = s.trim();
    // Remove ```lang ... ``` or ``` ... ```
    if s.starts_with("```") {
        let after_first = s.find('\n').map(|i| &s[i+1..]).unwrap_or(s);
        let trimmed = if let Some(end) = after_first.rfind("```") {
            &after_first[..end]
        } else {
            after_first
        };
        return trimmed.trim().to_string();
    }
    s.to_string()
}
