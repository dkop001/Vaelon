// ── LLM Abstraction Layer ─────────────────────────────────────────────────
// Single entry point for all AI calls.
// Automatically routes between Ollama (local) and cloud providers (Groq).

pub mod ollama;
pub mod groq;
pub mod embeddings;

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc;

// ── LLM Config ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmSettings {
    pub mode: LlmMode,
    pub ollama_model: Option<String>,
    pub ollama_base_url: String,
    pub groq_api_key: String,
    pub groq_model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum LlmMode {
    Auto,
    Local,
    Cloud,
}

impl Default for LlmSettings {
    fn default() -> Self {
        Self {
            mode: LlmMode::Auto,
            ollama_model: None,
            ollama_base_url: "http://localhost:11434".into(),
            groq_api_key: String::new(),
            groq_model: "llama-3.1-8b-instant".into(),
        }
    }
}

// ── Request / Response ────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmRequest {
    pub messages: Vec<LlmMessage>,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
    pub json_mode: bool,
    pub model: Option<String>,
    /// Unique ID used to tag streaming Tauri events: `llm:chunk { session_id, content }`
    pub session_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmChunkEvent {
    pub session_id: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmDoneEvent {
    pub session_id: String,
    pub full_content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub name: String,
    pub provider: String,
    pub size_bytes: u64,
}

// ── Router ────────────────────────────────────────────────────────────────

/// Complete an LLM request with streaming. Chunks are emitted to the frontend
/// as Tauri events `llm:chunk` and `llm:done`.
pub async fn complete_streaming(
    app: AppHandle,
    req: LlmRequest,
    settings: &LlmSettings,
) -> Result<String> {
    let use_local = match settings.mode {
        LlmMode::Local => true,
        LlmMode::Cloud => false,
        LlmMode::Auto => ollama::is_available(&settings.ollama_base_url).await,
    };

    let result = if use_local {
        ollama::stream_chat(&app, &req, settings).await
            .or_else(|_| {
                // Fallback to cloud if key available
                if !settings.groq_api_key.is_empty() {
                    let app2 = app.clone();
                    let req2 = req.clone();
                    let settings2 = settings.clone();
                    tokio::runtime::Handle::current()
                        .block_on(async move { groq::stream_chat(&app2, &req2, &settings2).await })
                } else {
                    Err(anyhow::anyhow!("Ollama unavailable and no cloud API key set"))
                }
            })
    } else {
        groq::stream_chat(&app, &req, settings).await
            .or_else(|_| {
                let app2 = app.clone();
                let req2 = req.clone();
                let settings2 = settings.clone();
                tokio::runtime::Handle::current()
                    .block_on(async move { ollama::stream_chat(&app2, &req2, &settings2).await })
            })
    }?;

    app.emit("llm:done", LlmDoneEvent {
        session_id: req.session_id.clone(),
        full_content: result.clone(),
    })?;

    Ok(result)
}

/// Non-streaming completion. Returns the full text.
pub async fn complete(req: LlmRequest, settings: &LlmSettings) -> Result<String> {
    let use_local = match settings.mode {
        LlmMode::Local => true,
        LlmMode::Cloud => false,
        LlmMode::Auto => ollama::is_available(&settings.ollama_base_url).await,
    };

    if use_local {
        ollama::complete_blocking(&req, settings).await
    } else {
        groq::complete_blocking(&req, settings).await
    }
}

pub async fn list_models(settings: &LlmSettings) -> Result<Vec<ModelInfo>> {
    let mut models = vec![];
    if ollama::is_available(&settings.ollama_base_url).await {
        let local = ollama::list_models(&settings.ollama_base_url).await?;
        models.extend(local);
    }
    Ok(models)
}
