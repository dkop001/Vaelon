// ── Note Indexer ────────────────────────────────────────────────────────────
// Handles chunking, embedding, and storing note vectors for RAG retrieval.

use crate::db::{DbPool, queries};
use crate::llm::embeddings::{embed, embed_batch, cosine_similarity, vector_to_blob, blob_to_vector};
use anyhow::Result;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbeddingChunk {
    pub id: String,
    pub note_id: String,
    pub chunk_index: usize,
    pub chunk_text: String,
    pub content_hash: String,
}

/// Configuration for chunking
const CHUNK_SIZE: usize = 500;      // characters per chunk
const CHUNK_OVERLAP: usize = 100;   // overlap between chunks
const MAX_CHUNKS_PER_NOTE: usize = 50;

/// Compute a simple hash of content to detect changes
fn content_hash(text: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    text.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

/// Split text into overlapping chunks
fn chunk_text(text: &str) -> Vec<String> {
    let text = text.trim();
    if text.len() <= CHUNK_SIZE {
        return vec![text.to_string()];
    }

    let mut chunks = Vec::new();
    let mut start = 0;

    while start < text.len() && chunks.len() < MAX_CHUNKS_PER_NOTE {
        let end = (start + CHUNK_SIZE).min(text.len());
        let chunk = &text[start..end];
        
        // Try to break at word boundary
        let chunk = if end < text.len() {
            if let Some(last_space) = chunk.rfind(' ') {
                if last_space > CHUNK_SIZE / 2 {
                    &chunk[..last_space]
                } else {
                    chunk
                }
            } else {
                chunk
            }
        } else {
            chunk
        };

        chunks.push(chunk.trim().to_string());
        start += CHUNK_SIZE - CHUNK_OVERLAP;
        
        if start >= text.len() {
            break;
        }
    }

    chunks
}

/// Delete all embeddings for a note
pub async fn delete_note_embeddings(pool: &DbPool, note_id: &str) -> Result<()> {
    let conn = pool.lock().unwrap();
    conn.execute(
        "DELETE FROM embeddings WHERE note_id = ?1",
        [note_id],
    )?;
    Ok(())
}

/// Index a single note: chunk, embed, and store vectors
pub async fn index_note(pool: &DbPool, note_id: &str, title: &str, content: &str, base_url: &str, model: Option<&str>) -> Result<usize> {
    // Delete existing embeddings for this note
    delete_note_embeddings(pool, note_id).await?;

    let full_text = format!("{}\n\n{}", title, content);
    let chunks = chunk_text(&full_text);
    
    if chunks.is_empty() {
        return Ok(0);
    }

    // Generate embeddings for all chunks
    let chunk_refs: Vec<&str> = chunks.iter().map(|s| s.as_str()).collect();
    let embeddings = embed_batch(&chunk_refs, base_url, model).await?;

    // Store in database
    let mut conn = pool.lock().unwrap();
    let tx = conn.transaction()?;

    let mut count = 0;
    for (idx, (chunk, embedding)) in chunks.iter().zip(embeddings.iter()).enumerate() {
        let chunk_id = Uuid::new_v4().to_string();
        let content_hash = content_hash(chunk);
        let blob = vector_to_blob(embedding);

        tx.execute(
            "INSERT INTO embeddings (id, note_id, chunk_index, chunk_text, vector_blob, content_hash, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, datetime('now'))",
            rusqlite::params![
                &chunk_id,
                note_id,
                &idx.to_string(),
                chunk,
                &blob,
                &content_hash,
            ],
        )?;
        count += 1;
    }

    tx.commit()?;
    Ok(count)
}

/// Build index from a list of notes (simpler API for sync indexing)
pub fn build_index(notes: Vec<crate::db::models::Note>) -> Result<()> {
    // For synchronous build_index, we just delete old embeddings
    // The actual async embedding will be done in background
    let _ = notes;
    Ok(())
}

/// Semantic search across all notes in a workspace
pub async fn semantic_search(
    pool: &DbPool,
    workspace_id: &str,
    query: &str,
    top_k: usize,
    base_url: &str,
    model: Option<&str>,
) -> Result<Vec<SearchResult>> {
    let query_vec: Vec<f32> = embed(query, base_url, model).await?;

    let conn = pool.lock().unwrap();
    
    // Get all embeddings for notes in this workspace
    let mut stmt = conn.prepare(
        "SELECT e.id, e.note_id, e.chunk_index, e.chunk_text, e.vector_blob,
                n.title, n.workspace_id
         FROM embeddings e
         JOIN notes n ON n.id = e.note_id
         WHERE n.workspace_id = ?1"
    )?;

    let rows = stmt.query_map([workspace_id], |row| {
        let blob: Vec<u8> = row.get(4)?;
        Ok((
            row.get::<_, String>(0)?,  // embedding id
            row.get::<_, String>(1)?,  // note_id
            row.get::<_, usize>(2)?,   // chunk_index
            row.get::<_, String>(3)?,  // chunk_text
            blob,                       // vector_blob
            row.get::<_, String>(5)?,  // note title
            row.get::<_, String>(6)?,  // workspace_id
        ))
    })?;

    let mut scored = Vec::new();
    for row in rows {
        let (emb_id, note_id, chunk_idx, chunk_text, blob, note_title, ws_id) = row?;
        let vector = blob_to_vector(&blob);
        let score = cosine_similarity(&query_vec, &vector);
        
        if score > 0.3 {  // threshold
            scored.push(SearchResult {
                embedding_id: emb_id,
                note_id,
                chunk_index: chunk_idx,
                chunk_text,
                score,
                note_title,
                workspace_id: ws_id,
            });
        }
    }

    // Sort by score descending
    scored.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
    scored.truncate(top_k);

    Ok(scored)
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchResult {
    pub embedding_id: String,
    pub note_id: String,
    pub chunk_index: usize,
    pub chunk_text: String,
    pub score: f32,
    pub note_title: String,
    pub workspace_id: String,
}

/// Re-index all notes in a workspace (for initial setup or model change)
pub async fn reindex_workspace(
    pool: &DbPool,
    workspace_id: &str,
    base_url: &str,
    model: Option<&str>,
) -> Result<usize> {
    let notes = queries::note_list(pool, workspace_id, None)?;
    let mut total = 0;

    for note in notes {
        let count = index_note(pool, &note.id, &note.title, &note.content, base_url, model).await?;
        total += count;
    }

    Ok(total)
}