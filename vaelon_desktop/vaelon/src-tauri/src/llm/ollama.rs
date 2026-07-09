// ── Ollama Provider ───────────────────────────────────────────────────────
// Streams from Ollama's /api/chat endpoint. Each content chunk is emitted
// as a Tauri event `llm:chunk { session_id, content }`.

use crate::llm::{LlmChunkEvent, LlmMessage, LlmRequest, LlmSettings, ModelInfo};
use anyhow::Result;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Deserialize)]
struct OllamaChatChunk {
    message: Option<OllamaMessage>,
    done: bool,
}

#[derive(Debug, Deserialize)]
struct OllamaMessage {
    content: String,
}

#[derive(Debug, Deserialize)]
struct OllamaTagsResponse {
    models: Vec<OllamaModel>,
}

#[derive(Debug, Deserialize)]
struct OllamaModel {
    name: String,
    size: u64,
}

pub async fn is_available(base_url: &str) -> bool {
    let client = Client::new();
    client
        .get(format!("{}/api/tags", base_url))
        .timeout(std::time::Duration::from_secs(3))
        .send()
        .await
        .map(|r| r.status().is_success())
        .unwrap_or(false)
}

pub async fn list_models(base_url: &str) -> Result<Vec<ModelInfo>> {
    let client = Client::new();
    let resp = client
        .get(format!("{}/api/tags", base_url))
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await?;
    let data: OllamaTagsResponse = resp.json().await?;
    Ok(data.models.iter().map(|m| ModelInfo {
        name: m.name.clone(),
        provider: "ollama".into(),
        size_bytes: m.size,
    }).collect())
}

pub async fn stream_chat(app: &AppHandle, req: &LlmRequest, settings: &LlmSettings) -> Result<String> {
    let client = Client::new();
    let model = req.model.clone()
        .or_else(|| settings.ollama_model.clone())
        .unwrap_or_else(|| "llama3.2:3b".into());

    let mut body = json!({
        "model": model,
        "messages": req.messages.iter().map(|m| json!({"role": m.role, "content": m.content})).collect::<Vec<_>>(),
        "stream": true,
        "options": {
            "temperature": req.temperature.unwrap_or(0.3),
            "num_predict": req.max_tokens.unwrap_or(2000),
        }
    });

    if req.json_mode {
        body["format"] = json!("json");
    }

    let resp = client
        .post(format!("{}/api/chat", settings.ollama_base_url))
        .json(&body)
        .send()
        .await?;

    if !resp.status().is_success() {
        let err = resp.text().await?;
        return Err(anyhow::anyhow!("Ollama error: {}", err));
    }

    let mut full_content = String::new();
    let mut bytes = resp.bytes_stream();

    use futures::StreamExt;
    while let Some(chunk) = bytes.next().await {
        let chunk = chunk?;
        let text = String::from_utf8_lossy(&chunk);
        for line in text.lines() {
            if line.is_empty() { continue; }
            if let Ok(parsed) = serde_json::from_str::<OllamaChatChunk>(line) {
                if let Some(msg) = &parsed.message {
                    full_content.push_str(&msg.content);
                    let _ = app.emit("llm:chunk", LlmChunkEvent {
                        session_id: req.session_id.clone(),
                        content: msg.content.clone(),
                    });
                }
                if parsed.done { break; }
            }
        }
    }

    Ok(full_content)
}

/// Non-streaming, returns full response text.
pub async fn complete_blocking(req: &LlmRequest, settings: &LlmSettings) -> Result<String> {
    let client = Client::new();
    let model = req.model.clone()
        .or_else(|| settings.ollama_model.clone())
        .unwrap_or_else(|| "llama3.2:3b".into());

    let mut body = json!({
        "model": model,
        "messages": req.messages.iter().map(|m| json!({"role": m.role, "content": m.content})).collect::<Vec<_>>(),
        "stream": false,
        "options": {
            "temperature": req.temperature.unwrap_or(0.3),
            "num_predict": req.max_tokens.unwrap_or(2000),
        }
    });

    if req.json_mode {
        body["format"] = json!("json");
    }

    #[derive(Deserialize)]
    struct NonStreamResp { message: OllamaMessage }

    let resp = client
        .post(format!("{}/api/chat", settings.ollama_base_url))
        .json(&body)
        .send()
        .await?;

    let data: NonStreamResp = resp.json().await?;
    Ok(data.message.content)
}
