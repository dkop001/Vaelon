// ── Planner Role ──────────────────────────────────────────────────────────
// Decides the next single action given the current agent state context.
// Returns a typed Action (never raw code).

use crate::agent::actions::{Action, ActionType};
use crate::llm::{complete, LlmMessage, LlmRequest, LlmSettings};
use anyhow::Result;
use serde::Deserialize;

const SYSTEM_PROMPT: &str = r#"You are the Planner component of an autonomous coding agent.

Your job is to decide the SINGLE next action to take to make progress toward the goal.
Respond ONLY with a JSON object with this structure:
{
  "action_type": "WRITE_FILE" | "READ_FILE" | "EDIT_FILE" | "DELETE_FILE" | "LIST_DIRECTORY" | "RUN_COMMAND" | "SEARCH_CODE" | "FETCH_URL" | "THINK" | "DONE",
  "path": "<file path if applicable>",
  "command": "<shell command if action_type is RUN_COMMAND>",
  "cwd": "<working directory for command>",
  "query": "<search query if action_type is SEARCH_CODE>",
  "url": "<URL if action_type is FETCH_URL>",
  "thought": "<your step-by-step reasoning before choosing this action>",
  "description": "<short human-readable description of what this action does>"
}

Action semantics:
- WRITE_FILE: Create a new file. CodeGen will produce the content — you only provide the path and description.
- EDIT_FILE: Fully overwrite an existing file. Same as WRITE_FILE — CodeGen rewrites the entire file. Never use this expecting a diff/patch.
- READ_FILE: Read a file's contents. The output will appear in your next context under RECENT OBSERVATIONS.
- RUN_COMMAND: Execute a shell command. stdout/stderr will appear in RECENT OBSERVATIONS.
- THINK: Use this to reason out loud when you are stuck or need to plan several steps. Your "thought" field content will be stored and fed back into future context.
- DONE: Return this when the goal is fully complete.

Rules:
- Choose ONE action. Never output code directly.
- Always populate "thought" with your genuine reasoning — it will be remembered across iterations.
- If the goal is complete, return action_type: "DONE".
- Prefer running commands to verify success after file operations.
- Never repeat the same failed action without a different approach — check RECENT OBSERVATIONS for error details.
- If RECENT OBSERVATIONS shows a command failed with specific stderr, address that specific error.
"#;

#[derive(Debug, Deserialize)]
struct PlannerResponse {
    action_type: String,
    path: Option<String>,
    command: Option<String>,
    cwd: Option<String>,
    query: Option<String>,
    url: Option<String>,
    /// The planner's reasoning — captured and stored on the Action so it
    /// flows back into build_context() for future iterations.
    thought: Option<String>,
    description: Option<String>,
}

pub async fn plan_next(context: &str, settings: &LlmSettings) -> Result<Action> {
    let req = LlmRequest {
        messages: vec![
            LlmMessage { role: "system".into(), content: SYSTEM_PROMPT.into() },
            LlmMessage { role: "user".into(), content: context.to_string() },
        ],
        temperature: Some(0.2),
        max_tokens: Some(2048),
        json_mode: true,
        model: None,
        session_id: "planner".into(),
    };

    let raw = complete(req, settings).await?;
    let parsed: PlannerResponse = serde_json::from_str(&raw)
        .map_err(|e| anyhow::anyhow!("Planner returned invalid JSON: {} — raw: {}", e, raw))?;

    let action_type = match parsed.action_type.as_str() {
        "WRITE_FILE"     => ActionType::WriteFile,
        "READ_FILE"      => ActionType::ReadFile,
        "EDIT_FILE"      => ActionType::EditFile,
        "DELETE_FILE"    => ActionType::DeleteFile,
        "LIST_DIRECTORY" => ActionType::ListDirectory,
        "RUN_COMMAND"    => ActionType::RunCommand,
        "SEARCH_CODE"    => ActionType::SearchCode,
        "FETCH_URL"      => ActionType::FetchUrl,
        "THINK"          => ActionType::Think,
        "DONE"           => ActionType::Done,
        other            => return Err(anyhow::anyhow!("Unknown action type: {}", other)),
    };

    let mut action = Action::new(action_type, parsed.description.unwrap_or_default());
    action.path    = parsed.path;
    action.command = parsed.command;
    action.cwd     = parsed.cwd;
    action.query   = parsed.query;
    action.url     = parsed.url;
    action.thought = parsed.thought;   // ← capture reasoning for context replay

    Ok(action)
}
