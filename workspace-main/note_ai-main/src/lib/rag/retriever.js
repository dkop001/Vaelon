// ── TF-IDF based RAG (no external models needed) ──────────────────────────

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

// ── Tokenization ────────────────────────────────────────────────────────────

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

function getTermFreqs(tokens) {
  const freq = {};
  for (const t of tokens) {
    freq[t] = (freq[t] || 0) + 1;
  }
  // Normalize by max
  const max = Math.max(...Object.values(freq), 1);
  for (const k in freq) {
    freq[k] /= max;
  }
  return freq;
}

// ── IDF Cache ───────────────────────────────────────────────────────────────

let idfCache = null;
let idfCacheDocCount = 0;

function computeIDF(documents) {
  const N = documents.length;
  const df = {};

  for (const doc of documents) {
    const uniqueTerms = new Set(tokenize(doc.content || doc.text || ''));
    for (const term of uniqueTerms) {
      df[term] = (df[term] || 0) + 1;
    }
  }

  const idf = {};
  for (const [term, freq] of Object.entries(df)) {
    idf[term] = Math.log((N + 1) / (freq + 1)) + 1;
  }

  return idf;
}

function getIDF(documents) {
  if (!idfCache || idfCacheDocCount !== documents.length) {
    idfCache = computeIDF(documents);
    idfCacheDocCount = documents.length;
  }
  return idfCache;
}

// ── TF-IDF Vector ───────────────────────────────────────────────────────────

function tfidfVector(tokens, idf) {
  const tf = getTermFreqs(tokens);
  const vec = {};
  for (const [term, freq] of Object.entries(tf)) {
    vec[term] = freq * (idf[term] || 1);
  }
  return vec;
}

function cosineSimilarity(a, b) {
  const allTerms = new Set([...Object.keys(a), ...Object.keys(b)]);
  let dot = 0, normA = 0, normB = 0;

  for (const term of allTerms) {
    const va = a[term] || 0;
    const vb = b[term] || 0;
    dot += va * vb;
    normA += va * va;
    normB += vb * vb;
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ── Chunking ────────────────────────────────────────────────────────────────

function chunkText(text, chunkSize = 500, overlap = 100) {
  const words = text.split(/\s+/);
  const chunks = [];

  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    chunks.push(words.slice(i, i + chunkSize).join(' '));
  }

  return chunks.length > 0 ? chunks : [text];
}

// ── Index ───────────────────────────────────────────────────────────────────

let noteIndex = [];

export function buildIndex(notes) {
  noteIndex = [];

  for (const note of notes) {
    const plainText = (note.content || '').replace(/<[^>]*>/g, '').trim();
    if (!plainText) continue;

    const chunks = chunkText(plainText);

    for (let i = 0; i < chunks.length; i++) {
      noteIndex.push({
        noteId: note.id,
        noteTitle: note.title || 'Untitled',
        chunkIndex: i,
        text: chunks[i],
        fullContent: plainText,
      });
    }
  }

  console.log(`[RAG] Indexed ${noteIndex.length} chunks from ${notes.length} notes`);
  return noteIndex.length;
}

// ── Search ──────────────────────────────────────────────────────────────────

export function search(query, topK = 3) {
  if (noteIndex.length === 0) return [];

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const idf = getIDF(noteIndex);
  const queryVec = tfidfVector(queryTokens, idf);

  // Score each chunk
  const scored = noteIndex.map(doc => {
    const docTokens = tokenize(doc.text);
    const docVec = tfidfVector(docTokens, idf);
    const score = cosineSimilarity(queryVec, docVec);
    return { ...doc, score };
  });

  // Sort by score, dedupe by noteId (keep best chunk per note)
  scored.sort((a, b) => b.score - a.score);

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

// ── Context Builder ─────────────────────────────────────────────────────────

export function getRAGContext(query, maxChars = 2000) {
  const results = search(query, 3);

  if (results.length === 0) return '';

  const context = results
    .map(r => `[${r.noteTitle}]: ${r.text}`)
    .join('\n\n');

  return context.slice(0, maxChars);
}

export function getIndexSize() {
  return noteIndex.length;
}
