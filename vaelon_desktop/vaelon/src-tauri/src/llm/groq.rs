// ── Groq Cloud Provider ───────────────────────────────────────────────────
// OpenAI-compatible SSE streaming. Emits `llm:chunk` Tauri events per chunk.

use crate::llm::{LlmChunkEvent, LlmRequest, LlmSettings};
use anyhow::{anyhow, Result};
use reqwest::Client;
use serde::Deserialize;
use serde_json::json;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Deserialize)]
struct GroqChunk {
    choices: Vec<GroqChoice>,
}

#[derive(Debug, Deserialize)]
struct GroqChoice {
    delta: GroqDelta,
}

#[derive(Debug, Deserialize)]
struct GroqDelta {
    content: Option<String>,
}

pub async fn stream_chat(app: &AppHandle, req: &LlmRequest, settings: &LlmSettings) -> Result<String> {
    if settings.groq_api_key.is_empty() {
        return Err(anyhow!("Groq API key not configured"));
    }

    let client = Client::new();
    let model = settings.groq_model.clone();

    let mut body = json!({
        "model": model,
        "messages": req.messages.iter().map(|m| json!({"role": m.role, "content": m.content})).collect::<Vec<_>>(),
        "temperature": req.temperature.unwrap_or(0.3),
        "max_tokens": req.max_tokens.unwrap_or(2000),
        "stream": true,
    });

    if req.json_mode {
        body["response_format"] = json!({"type": "json_object"});
    }

    let resp = client
        .post("https://api.groq.com/openai/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", settings.groq_api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await?;

    if !resp.status().is_success() {
        let err = resp.text().await?;
        return Err(anyhow!("Groq error: {}", err));
    }

    let mut full_content = String::new();
    let mut bytes = resp.bytes_stream();

    use futures::StreamExt;
    while let Some(chunk) = bytes.next().await {
        let chunk = chunk?;
        let text = String::from_utf8_lossy(&chunk);
        for line in text.lines() {
            if !line.starts_with("data: ") { continue; }
            let data = &line[6..];
            if data == "[DONE]" { break; }
            if let Ok(parsed) = serde_json::from_str::<GroqChunk>(data) {
                if let Some(content) = parsed.choices.first().and_then(|c| c.delta.content.clone()) {
                    full_content.push_str(&content);
                    let _ = app.emit("llm:chunk", LlmChunkEvent {
                        session_id: req.session_id.clone(),
                        content,
                    });
                }
            }
        }
    }

    Ok(full_content)
}

pub async fn complete_blocking(req: &LlmRequest, settings: &LlmSettings) -> Result<String> {
    if settings.groq_api_key.is_empty() {
        return Err(anyhow!("Groq API key not configured"));
    }

    let client = Client::new();
    let mut body = json!({
        "model": settings.groq_model,
        "messages": req.messages.iter().map(|m| json!({"role": m.role, "content": m.content})).collect::<Vec<_>>(),
        "temperature": req.temperature.unwrap_or(0.3),
        "max_tokens": req.max_tokens.unwrap_or(2000),
        "stream": false,
    });

    if req.json_mode {
        body["response_format"] = json!({"type": "json_object"});
    }

    #[derive(Deserialize)]
    struct Resp { choices: Vec<Choice> }
    #[derive(Deserialize)]
    struct Choice { message: Msg }
    #[derive(Deserialize)]
    struct Msg { content: String }

    let resp = client
        .post("https://api.groq.com/openai/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", settings.groq_api_key))
        .json(&body)
        .send()
        .await?;

    let data: Resp = resp.json().await?;
    Ok(data.choices.into_iter().next().map(|c| c.message.content).unwrap_or_default())
}
