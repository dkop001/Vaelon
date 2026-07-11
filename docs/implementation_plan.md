# Vaelon — Rust-Core Architecture Redesign

## Background

The current codebase is **"Flow"** — a Tauri 2 + React + Vite app. The Rust backend (`src-tauri/src/lib.rs`) today is a minimal shim: 5 commands (`read_file`, `write_file`, `list_files`, `delete_file`, `run_shell_command`). Almost **all logic lives in JavaScript**: the database layer (`core/db.js` — 13-table SQLite), the AI router (`core/ai.js` — Ollama + Groq + Gemini), the agent system (`lib/agent/` — AgentLoop, Planner, CodeGen, Observer, Reviewer, ToolExecutor, Recovery, etc.), RAG (`lib/rag/vectorStore.js`), the event bus (`core/events.js`), and all application services (`app/workspace.js`, `app/project.js`, `app/note.js`, `app/chat.js`, `app/task.js`).

The goal is to **invert this**: move everything meaningful into a Rust core, and reduce React to a thin visualization layer communicating over a typed IPC channel (Tauri invoke + events).

---

## Target Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    UI Layer (React / Vite)                       │
│  Pure visualization. No business logic. No direct FS/DB access.  │
│  Sends commands via invoke(). Receives state via Tauri events.   │
└─────────────────────────┬────────────────────────────────────────┘
                          │  Tauri IPC (invoke + listen)
┌─────────────────────────▼────────────────────────────────────────┐
│                    Rust Core (Vaelon)                            │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │Workspace │  │   FS     │  │ Terminal │  │ Process Manager  │ │
│  │  Manager │  │  Layer   │  │  Manager │  │  (PTY / Spawn)   │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │  Tool    │  │  Event   │  │Permission│  │    Indexing &    │ │
│  │ Executor │  │   Bus    │  │  System  │  │  Search Engine   │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │   RAG    │  │  Local   │  │  Agent   │  │   SQLite DB      │ │
│  │ Pipeline │  │  Cache   │  │ Runtime  │  │  (rusqlite)      │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │               LLM Abstraction Layer                         │ │
│  │  Ollama (local) ◄──► Cloud APIs (Groq / Anthropic / OAI)   │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

## Open Questions

> [!IMPORTANT]
> **Q1 — New project vs. incremental migration?**
> The cleanest approach is a **new Tauri project** under `c:\projects\Vaelon\vaelon_desktop\` with a fresh Rust workspace + a fresh React frontend, then copying in React UI components piece by piece. The alternative is migrating in-place inside `workspace-main/note_ai-main`. Which do you prefer?

> [!IMPORTANT]
> **Q2 — Monorepo or separate crates?**
> The Rust core could be a single `vaelon-core` library crate with submodules, or split into workspace crates (`vaelon-db`, `vaelon-agent`, `vaelon-llm`, etc.). Split crates are cleaner long-term. Do you want a Cargo workspace from day one?

> [!IMPORTANT]
> **Q3 — IPC protocol format?**
> Options: (a) JSON over Tauri `invoke` — simple, already used; (b) MessagePack for binary efficiency; (c) typed Rust→TS type generation with `ts-rs` or `specta`. The `specta` + `tauri-specta` approach gives you full type safety with zero handwriting. Recommended?

> [!IMPORTANT]
> **Q4 — Terminal backend?**
> For a real PTY (pseudo-terminal), we need `portable-pty` crate or `tauri-plugin-pty`. The current `run_shell_command` is fire-and-forget (no streaming). Do you want full interactive PTY (streaming stdin/stdout) from day one?

> [!WARNING]
> **Q5 — Existing Supabase / Auth code?**
> `App.jsx` currently wires in Supabase auth and `@supabase/supabase-js`. The new architecture is local-first. Should auth/cloud sync be dropped, kept as an optional plugin, or deferred?

---

## Proposed Changes

### Phase 0 — Scaffold (Week 1)

Set up the project skeleton with correct tooling.

#### [NEW] `vaelon_desktop/` — New Tauri project
- `vaelon_desktop/src-tauri/` — Rust workspace
- `vaelon_desktop/src/` — React + Vite frontend (clean)
- `vaelon_desktop/package.json` — minimal deps: `react`, `react-dom`, `@tauri-apps/api`, `vite`, `lucide-react`, `zustand`

---

### Phase 1 — Rust Core Foundation (Weeks 1–2)

Build the Rust modules. Nothing in React changes yet.

#### [NEW] `src-tauri/src/db/mod.rs`
- SQLite via `rusqlite` (direct, not plugin-sql)
- Full schema migration system (same 13 tables as current `core/db.js`)
- `DbPool` with `Arc<Mutex<Connection>>` 
- CRUD operations for: workspaces, projects, notes, chat_sessions, chat_messages, tasks, build_logs, embeddings, app_config

#### [NEW] `src-tauri/src/fs/mod.rs`
- Sandboxed file system operations
- `read_file`, `write_file`, `list_dir`, `delete_file`, `move_file`, `copy_file`
- Path canonicalization + sandbox enforcement (no escape outside workspace root)
- File watcher via `notify` crate → emit `fs:changed` events to UI

#### [NEW] `src-tauri/src/terminal/mod.rs`
- PTY via `portable-pty` crate
- Spawn shell, stream stdout/stderr chunks as Tauri events `terminal:output`
- Accept stdin via `invoke('terminal_write', { data })`
- Session management: multiple terminal instances

#### [NEW] `src-tauri/src/process/mod.rs`
- Long-running process tracking
- Start/stop/kill processes
- Capture output with backpressure
- Emit `process:stdout`, `process:stderr`, `process:exit` events

#### [NEW] `src-tauri/src/events/mod.rs`
- Internal Rust event bus (tokio broadcast channel)
- All modules publish typed events here
- Bridge: Rust events → Tauri frontend events

#### [NEW] `src-tauri/src/permissions/mod.rs`
- Capability graph: SAFE / MEDIUM / HIGH / CRITICAL
- Per-tool permission levels (mirrors current `toolPolicy.js`)
- Approval queue: HIGH/CRITICAL actions wait for UI `invoke('approve_action', { id })`
- Rate limiting per tool category

---

### Phase 2 — Agent Runtime in Rust (Weeks 3–4)

Port the agent system from `src/lib/agent/` to Rust.

#### [NEW] `src-tauri/src/agent/mod.rs`
- `AgentState` — goal, task queue, observations, retry counter, context
- `TaskQueue` — VecDeque with insert/prepend/remove
- `AgentLoop` — async Tokio task running the reasoning loop
- Emits typed events: `agent:reasoning_started`, `agent:action_created`, `agent:observation_recorded`, `agent:goal_completed`, etc.

#### [NEW] `src-tauri/src/agent/roles/`
- `planner.rs` — calls LLM, returns typed `Action` enum
- `codegen.rs` — generates file content
- `reviewer.rs` — validates code (braces, syntax, dangerous patterns)
- `observer.rs` — builds structured `Observation` from tool result

#### [NEW] `src-tauri/src/agent/tools/`
- `write_file.rs`, `read_file.rs`, `list_dir.rs`, `run_command.rs`, `search_code.rs`, `fetch_url.rs`
- Each tool: permission check → execute → capture → emit observation
- SSRF protection on `fetch_url`

#### [NEW] `src-tauri/src/agent/recovery.rs`
- Failure analysis by error pattern
- Repair task generation (install deps, create dirs, retry)

---

### Phase 3 — LLM Abstraction Layer (Week 3)

#### [NEW] `src-tauri/src/llm/mod.rs`
- Unified `complete(request: LlmRequest) -> Result<LlmResponse>` 
- `LlmRequest`: messages, model, temperature, max_tokens, json_mode, stream
- `OllamaProvider` — HTTP to `localhost:11434`, SSE streaming → Tauri events
- `GroqProvider` — HTTP to Groq API, SSE streaming
- `AnthropicProvider` — placeholder for future
- Auto-routing: ping Ollama → use local if up, else cloud
- Streaming: chunks emitted as `llm:chunk { session_id, content }` Tauri events

#### [NEW] `src-tauri/src/llm/embeddings.rs`
- `embed(text)` → `Vec<f32>` via Ollama `/api/embed`
- `embed_batch(texts)` → `Vec<Vec<f32>>`

---

### Phase 4 — Indexing, Search & RAG (Week 4)

#### [NEW] `src-tauri/src/indexing/mod.rs`
- Background Tokio task that watches for note changes (via event bus)
- Chunks text, calls `llm::embeddings::embed_batch`
- Stores vectors in `embeddings` SQLite table

#### [NEW] `src-tauri/src/search/mod.rs`
- Full-text search: SQLite FTS5 virtual table over notes
- Semantic search: cosine similarity over stored embeddings (pure Rust, no external vector DB needed at this scale)
- Hybrid ranking: BM25 + semantic score blend

#### [NEW] `src-tauri/src/rag/mod.rs`
- `retrieve(query, workspace_id, k)` → `Vec<Chunk>`
- Injects context into LLM requests for chat
- TF-IDF fallback when embeddings unavailable

---

### Phase 5 — IPC Command Surface (Week 4)

All Tauri `invoke` commands, typed end-to-end.

#### [NEW] `src-tauri/src/commands/mod.rs`

```rust
// Workspace
invoke("workspace_list") -> Vec<Workspace>
invoke("workspace_create", { name, path }) -> Workspace
invoke("workspace_delete", { id }) -> ()

// Notes
invoke("note_list", { workspace_id, project_id }) -> Vec<Note>
invoke("note_create", { workspace_id, project_id, title, content }) -> Note
invoke("note_update", { id, title, content, tags, pinned }) -> Note
invoke("note_delete", { id }) -> ()
invoke("note_search", { workspace_id, query }) -> Vec<SearchResult>

// Chat
invoke("chat_session_create", { workspace_id, project_id }) -> ChatSession
invoke("chat_send", { session_id, content, workspace_context }) -> ()
// Response streamed as events: llm:chunk, llm:done

// Agent
invoke("agent_start", { goal, workspace_path }) -> AgentRunId
invoke("agent_stop", { run_id }) -> ()
invoke("agent_approve", { action_id }) -> ()
// Progress via events: agent:*

// Terminal
invoke("terminal_spawn", { shell, cwd }) -> TerminalId
invoke("terminal_write", { id, data }) -> ()
invoke("terminal_resize", { id, cols, rows }) -> ()
invoke("terminal_kill", { id }) -> ()
// Output via events: terminal:output { id, data }

// FS
invoke("fs_read", { path }) -> String
invoke("fs_write", { path, content }) -> ()
invoke("fs_list", { path }) -> Vec<FsEntry>
invoke("fs_watch", { path }) -> ()

// LLM
invoke("llm_models") -> Vec<ModelInfo>
invoke("llm_settings_get") -> LlmSettings
invoke("llm_settings_set", { settings }) -> ()

// Search
invoke("search_semantic", { query, workspace_id, k }) -> Vec<SearchResult>
invoke("search_index_rebuild", { workspace_id }) -> ()
```

#### Tauri Events emitted by Rust:
```
fs:changed          { path, kind }
terminal:output     { id, data }
process:stdout      { id, data }
llm:chunk           { session_id, content }
llm:done            { session_id, full_content }
agent:action_created   { run_id, action }
agent:observation      { run_id, observation }
agent:tool_blocked     { run_id, action_id, reason }
agent:goal_completed   { run_id, summary }
indexing:progress      { workspace_id, percent }
```

---

### Phase 6 — React UI Refactor (Weeks 5–6)

Strip all business logic from React. Components only call `invoke()` and listen to events.

#### [MODIFY] `src/core/` — **DELETE ENTIRE DIRECTORY**
All JS logic moves to Rust. Replace with thin IPC client.

#### [NEW] `src/ipc/` — IPC client layer
- `src/ipc/client.ts` — typed wrappers around `invoke()`
- `src/ipc/events.ts` — typed event listeners
- `src/ipc/types.ts` — TypeScript types mirroring Rust structs (generated via `specta`)

#### [MODIFY] `src/store/` — Zustand stores
- Stores only hold UI state and cached server state
- No async logic: stores subscribe to Tauri events and update on push
- `workspaceStore.ts`, `noteStore.ts`, `chatStore.ts`, `agentStore.ts`, `terminalStore.ts`

#### [MODIFY] `src/features/agent/AgentMode.jsx`
- Remove all JS agent logic
- Replace with event listener on `agent:*` events
- Renders progress from store

#### [MODIFY] `src/features/editor/NoteWorkspace.jsx`
- `invoke('note_update', ...)` on save
- Real-time sync via `fs:changed` events

#### [MODIFY] `src/components/workspace/`
- TopBar, Sidebar, AIPanel remain but dispatch IPC commands
- No direct DB access, no localStorage settings

---

### Phase 7 — Local Cache & Persistence (Week 6)

#### [NEW] `src-tauri/src/cache/mod.rs`
- LRU cache for frequently-accessed notes and search results
- Embedding cache keyed by content hash (avoid re-embedding unchanged notes)
- Session state persistence across app restarts

---

## Migration Strategy

> [!CAUTION]
> The JS agent system (`lib/agent/`) is the most complex part. It should be ported **last**, after the simpler Rust modules are validated. Do not delete the JS agents until the Rust agent passes the same integration tests.

### Suggested phase order:
1. **New project scaffold** (Tauri 2 + React + Vite, clean slate)
2. **Rust DB module** — all 13 tables, migrations, CRUD
3. **Rust FS + Terminal** — PTY, file watcher
4. **Rust LLM abstraction** — Ollama + Groq streaming
5. **IPC command surface** — all invoke/event contracts
6. **React UI refactor** — thin IPC clients, new stores
7. **Rust agent runtime** — port AgentLoop, roles, recovery
8. **Indexing + RAG** — background indexer, semantic search

---

## Verification Plan

### Automated
- Rust unit tests per module (`cargo test`)
- Integration test: Tauri dev mode + Playwright for IPC round-trips
- `cargo clippy` + `cargo fmt` in CI

### Manual
- Terminal: spawn shell, type `ls`, see streaming output in React
- LLM: send chat message, see streamed response chunks appear in real-time
- Agent: give a goal ("create a React component"), watch Rust agent write files step by step
- Notes: create/edit/delete note, verify SQLite persistence across restart
- Search: full-text and semantic search return relevant results

---

## Key Dependencies (Rust)

| Crate | Purpose |
|-------|---------|
| `tauri 2` | Desktop shell + IPC |
| `tauri-specta` | Type-safe IPC contract generation |
| `rusqlite` + `rusqlite_migration` | SQLite |
| `tokio` (full) | Async runtime |
| `serde` + `serde_json` | Serialization |
| `reqwest` | HTTP for LLM providers |
| `tokio-stream` | SSE streaming from LLMs |
| `portable-pty` | Real PTY for terminal |
| `notify` | File system watcher |
| `tantivy` (optional) | Full-text search (or SQLite FTS5) |
| `dirs` | Platform paths |
| `anyhow` | Error handling |
| `uuid` | ID generation |
| `chrono` | Timestamps |
| `dashmap` | Concurrent cache |
| `tracing` + `tracing-subscriber` | Structured logging |
