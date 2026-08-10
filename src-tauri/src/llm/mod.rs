// ── LLM Abstraction Layer ─────────────────────────────────────────────────
// Single entry point for all AI calls.
// Automatically routes between Ollama (local) and cloud providers (Groq).

pub mod ollama;
pub mod groq;
pub mod embeddings;

use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

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
            groq_model: "llama-3.3-70b-versatile".into(),
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

/// Non-streaming completion with rate-limit retry. Returns the full text.
/// Prefers Ollama (Local) or Groq (Cloud) based on `settings.mode`, and
/// falls back to the other provider when the preferred one is unreachable
/// (e.g. Ollama not running) or a cloud key is available.
pub async fn complete(req: LlmRequest, settings: &LlmSettings) -> Result<String> {
    let use_local = match settings.mode {
        LlmMode::Local => true,
        LlmMode::Cloud => false,
        LlmMode::Auto => ollama::is_available(&settings.ollama_base_url).await,
    };

    let max_retries = 3;
    for attempt in 0..=max_retries {
        let result = if use_local {
            match ollama::complete_blocking(&req, settings).await {
                Ok(text) => Ok(text),
                Err(_) => fallback_cloud(&req, settings).await,
            }
        } else {
            match groq::complete_blocking(&req, settings).await {
                Ok(text) => Ok(text),
                Err(_) => fallback_local(&req, settings).await,
            }
        };

        match result {
            Ok(text) => return Ok(text),
            Err(e) => {
                let err_msg = e.to_string();
                // Check for rate limit
                if let Some(secs) = extract_rate_limit_delay(&err_msg) {
                    if attempt < max_retries {
                        let delay = std::cmp::min(secs + 2, 60);
                        tracing::warn!("Rate limited, retrying in {}s (attempt {}/{})", delay, attempt + 1, max_retries);
                        tokio::time::sleep(std::time::Duration::from_secs(delay)).await;
                        continue;
                    }
                }
                return Err(e);
            }
        }
    }

    Err(anyhow!("LLM call failed after {} retries", max_retries))
}

async fn fallback_cloud(req: &LlmRequest, settings: &LlmSettings) -> anyhow::Result<String> {
    if settings.groq_api_key.is_empty() {
        return Err(anyhow::anyhow!(
            "Local LLM (Ollama) unavailable at {} and no cloud API key set. \
             Start Ollama (ollama serve) or set a Groq API key in Settings.",
            settings.ollama_base_url
        ));
    }
    tracing::warn!("Local LLM unavailable, falling back to Groq");
    groq::complete_blocking(req, settings).await
}

async fn fallback_local(req: &LlmRequest, settings: &LlmSettings) -> anyhow::Result<String> {
    if !ollama::is_available(&settings.ollama_base_url).await {
        return Err(anyhow::anyhow!(
            "Cloud LLM unavailable and local Ollama is not running at {}. \
             Start Ollama (ollama serve) or check your Groq API key in Settings.",
            settings.ollama_base_url
        ));
    }
    tracing::warn!("Cloud LLM unavailable, falling back to local Ollama");
    ollama::complete_blocking(req, settings).await
}

/// Extract suggested wait time from a rate limit error message.
/// Looks for patterns like "try again in 33.935s" or "Retry after 30s"
fn extract_rate_limit_delay(msg: &str) -> Option<u64> {
    for pattern in &["try again in ", "retry after ", "Retry after "] {
        if let Some(pos) = msg.to_lowercase().find(&pattern.to_lowercase()) {
            let rest = &msg[pos + pattern.len()..];
            let secs: String = rest.chars().take_while(|c| c.is_digit(10) || *c == '.').collect();
            if let Ok(secs_f) = secs.parse::<f64>() {
                return Some(secs_f.ceil() as u64);
            }
        }
    }
    None
}

pub async fn list_models(settings: &LlmSettings) -> Result<Vec<ModelInfo>> {
    let mut models = vec![];
    if ollama::is_available(&settings.ollama_base_url).await {
        let local = ollama::list_models(&settings.ollama_base_url).await?;
        models.extend(local);
    }
    Ok(models)
}
