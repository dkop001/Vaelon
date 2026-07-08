// ── Vector RAG with Ollama Embeddings ───────────────────────────────────────
// Uses Ollama's nomic-embed-text model for vector embeddings.
// Falls back to TF-IDF if embedding model is unavailable.

import { embed, embedBatch, isEmbeddingAvailable } from '../aiRouter.js';

// ── Configuration ───────────────────────────────────────────────────────────

const CHUNK_SIZE = 400; // tokens (approx words)
const CHUNK_OVERLAP = 80;
const EMBEDDING_MODEL = 'nomic-embed-text';
const STORAGE_KEY = 'flow-vector-index';
const MAX_INDEX_SIZE = 5000; // chunks

// ── Text Chunking ───────────────────────────────────────────────────────────

export function chunkText(text, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const words = text.split(/\s+/);
  const chunks = [];

  // Guard against infinite loop when chunkSize <= overlap
  const step = Math.max(1, chunkSize - overlap);

  for (let i = 0; i < words.length; i += step) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    if (chunk.trim().length > 20) {
      chunks.push(chunk);
    }
  }

  return chunks.length > 0 ? chunks : [text.slice(0, 500)];
}

// ── Vector Store ────────────────────────────────────────────────────────────

class VectorStore {
  constructor() {
    this.chunks = []; // { id, noteId, noteTitle, chunkIndex, text, vector }
    this.isEmbeddingAvailable = false;
    this.isIndexed = false;
  }

  async init() {
    this.isEmbeddingAvailable = await isEmbeddingAvailable();
    console.log('[VectorStore] Embedding available:', this.isEmbeddingAvailable);
    this.loadFromStorage();
  }

  // ── Index Management ────────────────────────────────────────────────────

  async buildIndex(notes, onProgress) {
    this.chunks = [];
    const allChunks = [];

    // Chunk all notes
    for (const note of notes) {
      const plainText = (note.content || '').replace(/<[^>]*>/g, '').trim();
      if (!plainText || plainText.length < 30) continue;

      const textChunks = chunkText(plainText);
      for (let i = 0; i < textChunks.length; i++) {
        allChunks.push({
          id: `${note.id}-${i}`,
          noteId: note.id,
          noteTitle: note.title || 'Untitled',
          chunkIndex: i,
          text: textChunks[i],
          vector: null,
        });
      }
    }

    console.log(`[VectorStore] Created ${allChunks.length} chunks from ${notes.length} notes`);

    if (allChunks.length === 0) {
      this.isIndexed = true;
      return 0;
    }

    // Generate embeddings if available
    if (this.isEmbeddingAvailable) {
      try {
        if (onProgress) onProgress('embedding', { total: allChunks.length });

        // Batch embed in groups of 20
        const batchSize = 20;
        for (let i = 0; i < allChunks.length; i += batchSize) {
          const batch = allChunks.slice(i, i + batchSize);
          const texts = batch.map(c => c.text);

          try {
            const vectors = await embedBatch(texts, EMBEDDING_MODEL);
            for (let j = 0; j < batch.length; j++) {
              if (vectors[j]) {
                allChunks[i + j].vector = vectors[j];
              }
            }
          } catch (err) {
            console.warn(`[VectorStore] Batch embedding failed at ${i}:`, err.message);
          }

          if (onProgress) {
            onProgress('embedding_progress', {
              done: Math.min(i + batchSize, allChunks.length),
              total: allChunks.length,
            });
          }
        }

        const embeddedCount = allChunks.filter(c => c.vector).length;
        console.log(`[VectorStore] Embedded ${embeddedCount}/${allChunks.length} chunks`);

      } catch (err) {
        console.warn('[VectorStore] Embedding failed, using TF-IDF fallback:', err.message);
      }
    }

    this.chunks = allChunks;
    this.isIndexed = true;
    this.saveToStorage();

    return this.chunks.length;
  }

  // ── Search ─────────────────────────────────────────────────────────────

  async search(query, topK = 5) {
    if (this.chunks.length === 0) return [];

    // Try vector search first
    if (this.isEmbeddingAvailable) {
      try {
        const queryVector = await embed(query, EMBEDDING_MODEL);
        if (queryVector) {
          return this.vectorSearch(queryVector, topK);
        }
      } catch (err) {
        console.warn('[VectorStore] Vector search failed, falling back to TF-IDF:', err.message);
      }
    }

    // Fallback to TF-IDF
    return this.tfidfSearch(query, topK);
  }

  vectorSearch(queryVector, topK) {
    const scored = this.chunks.map(chunk => {
      if (!chunk.vector) return { ...chunk, score: 0 };
      const score = cosineSimilarity(queryVector, chunk.vector);
      return { ...chunk, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  tfidfSearch(query, topK) {
    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) return [];

    const scored = this.chunks.map(chunk => {
      const chunkTokens = tokenize(chunk.text);
      const score = tokenOverlap(queryTokens, chunkTokens);
      return { ...chunk, score };
    });

    scored.sort((a, b) => b.score - a.score);

    // Dedupe by noteId (keep best chunk per note)
    const seen = new Set();
    const results = [];
    for (const doc of scored) {
      if (results.length >= topK) break;
      if (seen.has(doc.noteId)) continue;
      seen.add(doc.noteId);
      results.push(doc);
    }

    return results;
  }

  // ── Context Builder ─────────────────────────────────────────────────────

  async getRAGContext(query, maxChars = 2500) {
    const results = await this.search(query, 5);
    if (results.length === 0) return { context: '', sources: [] };

    const sources = results.map(r => ({
      noteId: r.noteId,
      noteTitle: r.noteTitle,
      score: r.score,
      chunkIndex: r.chunkIndex,
      text: r.text.slice(0, 200),
    }));

    const context = results
      .map(r => `[${r.noteTitle}]: ${r.text}`)
      .join('\n\n')
      .slice(0, maxChars);

    return { context, sources };
  }

  // ── Persistence ────────────────────────────────────────────────────────

  saveToStorage() {
    try {
      // Don't save vectors to localStorage (too large), only save metadata
      const lite = this.chunks.map(c => ({
        id: c.id,
        noteId: c.noteId,
        noteTitle: c.noteTitle,
        chunkIndex: c.chunkIndex,
        text: c.text,
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lite));
    } catch (err) {
      console.warn('[VectorStore] Save failed:', err.message);
    }
  }

  loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const lite = JSON.parse(raw);
        this.chunks = lite.map(c => ({ ...c, vector: null }));
        this.isIndexed = this.chunks.length > 0;
      }
    } catch {
      // Ignore
    }
  }

  getIndexSize() {
    return this.chunks.length;
  }

  getEmbeddedCount() {
    return this.chunks.filter(c => c.vector).length;
  }
}

// ── Tokenization helpers ────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'was', 'are', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'shall', 'can', 'need', 'dare',
  'it', 'its', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she',
  'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his',
  'our', 'their', 'what', 'which', 'who', 'whom', 'where', 'when', 'why',
  'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
  'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
  'than', 'too', 'very', 'just', 'don', 'now', 'here', 'there', 'then',
]);

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

function tokenOverlap(a, b) {
  const bSet = new Set(b);
  let overlap = 0;
  for (const t of a) {
    if (bSet.has(t)) overlap++;
  }
  return a.length > 0 ? overlap / a.length : 0;
}

// ── Cosine Similarity ───────────────────────────────────────────────────────

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;

  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ── Singleton export ────────────────────────────────────────────────────────

export const vectorStore = new VectorStore();
export default vectorStore;
