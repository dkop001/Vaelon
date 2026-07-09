// ── Embeddings ────────────────────────────────────────────────────────────
// Vector embeddings via Ollama's /api/embed endpoint.
// Used for RAG retrieval and semantic search.

use anyhow::Result;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;

const DEFAULT_EMBED_MODEL: &str = "nomic-embed-text";

#[derive(Debug, Deserialize)]
struct EmbedResponse {
    embeddings: Vec<Vec<f32>>,
}

/// Embed a single text string. Returns a 768-dim float vector.
pub async fn embed(text: &str, base_url: &str, model: Option<&str>) -> Result<Vec<f32>> {
    let vecs = embed_batch(&[text], base_url, model).await?;
    vecs.into_iter().next().ok_or_else(|| anyhow::anyhow!("No embedding returned"))
}

/// Batch embed multiple texts. More efficient than calling embed() in a loop.
pub async fn embed_batch(texts: &[&str], base_url: &str, model: Option<&str>) -> Result<Vec<Vec<f32>>> {
    let client = Client::new();
    let model = model.unwrap_or(DEFAULT_EMBED_MODEL);

    let resp = client
        .post(format!("{}/api/embed", base_url))
        .json(&json!({
            "model": model,
            "input": texts,
        }))
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .await?;

    if !resp.status().is_success() {
        let err = resp.text().await?;
        return Err(anyhow::anyhow!("Ollama embed error: {}", err));
    }

    let data: EmbedResponse = resp.json().await?;
    Ok(data.embeddings)
}

/// Cosine similarity between two vectors.
pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() { return 0.0; }
    let dot: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
    let mag_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let mag_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();
    if mag_a == 0.0 || mag_b == 0.0 { return 0.0; }
    dot / (mag_a * mag_b)
}

/// Serialize a float vector to a BLOB (little-endian f32 bytes).
pub fn vector_to_blob(vec: &[f32]) -> Vec<u8> {
    vec.iter().flat_map(|f| f.to_le_bytes()).collect()
}

/// Deserialize a BLOB back to a float vector.
pub fn blob_to_vector(blob: &[u8]) -> Vec<f32> {
    blob.chunks_exact(4)
        .map(|b| f32::from_le_bytes([b[0], b[1], b[2], b[3]]))
        .collect()
}
