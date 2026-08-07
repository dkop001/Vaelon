# Flow — Development Progress Report

> **Flow** is a unified local-first AI workspace desktop app combining knowledge management (notes, study, research) with an agentic AI that has workspace context, terminal access, tool execution, and RAG over user notes.

---

## Architecture

### Three-Layer System

```
┌─────────────────────────────────────────┐
│           UI Layer (React)              │
│  Components · Layouts · Panels · Views  │
│           Button → Command              │
├─────────────────────────────────────────┤
│      Application Layer (src/app/)       │
│  Workspaces · Projects · Notes · Chats  │
│  Tasks · Files · Attachments · Commands │
│           Command → Core                │
├─────────────────────────────────────────┤
│           Core Layer (src/core/)        │
│  Database · AI Router · Events · Cmds   │
│  Agent · RAG · Plugin System            │
└─────────────────────────────────────────┘
```

### Data Flow
```
Button → register('note.create', handler) → execute('note.create', {title, content})
  → noteService.create() → core/db.js → SQLite
  → emit('note:created') → UI subscribes → re-render
```

---

## Phase 1 — Foundation ✅

### Core Layer (`src/core/`)

| File | Status | Purpose |
|------|--------|---------|
| `events.js` | ✅ | Pub/sub event bus: `on()`, `emit()`, 40+ named events |
| `commands.js` | ✅ | Command registry: `register()`, `execute()`, `list()` |
| `db.js` | ✅ | SQLite v2 with localStorage fallback. 13 tables |
| `ai.js` | ✅ | Unified AI router: single `complete()` entry point |

### Application Layer (`src/app/`)

| File | Status | Purpose |
|------|--------|---------|
| `workspace.js` | ✅ | Workspace CRUD + active workspace switching |
| `project.js` | ✅ | Project CRUD + archive |
| `note.js` | ✅ | Note CRUD + search + relations + AI cache |
| `chat.js` | ✅ | Chat sessions + messages |
| `task.js` | ✅ | Task CRUD + status management |

### Database Schema (13 tables)

| Table | Purpose |
|-------|---------|
| `workspaces` | Top-level container for everything |
| `projects` | Collections within a workspace |
| `notes` | Core knowledge unit (title, content, tags, summary) |
| `note_relations` | Bidirectional note linking (e.g. "Physics → Newton → Force") |
| `note_attachments` | File attachments per note |
| `files` | Project-level files (PDF, images, code) |
| `tasks` | Task tracking (status, priority, due date) |
| `ai_cache` | Cached AI outputs per note |
| `chat_sessions` | Persistent chat threads |
| `chat_messages` | Individual messages (role, content, metadata) |
| `build_logs` | Agent execution logs |
| `embeddings` | Vector embeddings for RAG |
| `app_config` | Key-value user settings |

### Tables Added Since Initial Schema

- `workspaces` — root container, all entities scoped to a workspace
- `note_relations` — link notes with typed relationships
- `note_attachments` — per-note file storage
- `files` — project-level file management
- `tasks` — task tracking with status/priority/due dates

### Backward Compatibility

Old files in `src/lib/` are now thin re-exports from `src/core/`:

| Old File | Behavior |
|----------|----------|
| `src/lib/aiRouter.js` | Re-exports from `src/core/ai.js` + legacy `summarize`/`generateQuiz`/`chat` wrappers |
| `src/lib/ai.js` | Re-exports from `src/lib/aiRouter.js` ← `src/core/ai.js` |
| `src/lib/db.js` | Re-exports from `src/core/db.js` + legacy CRUD helpers |

### Agent Layer (built separately, reused)

| File | Status | Purpose |
|------|--------|---------|
| `src/lib/agent/EventStream.js` | ✅ | Push + AsyncIterable hybrid event system |
| `src/lib/agent/toolPolicy.js` | ✅ | Capability graph + risk levels (SAFE/MEDIUM/HIGH) |
| `src/lib/agent/hookPipeline.js` | ✅ | 6-stage tool execution pipeline |
| `src/lib/agent/tools.js` | ✅ | Tool definitions with SSRF protection |
| `src/lib/agent/agentRunner.js` | ✅ | Plan generation + step execution orchestrator |
| `src/lib/rag/vectorStore.js` | ✅ | Vector RAG (Ollama embeddings + TF-IDF fallback) |

---

## Phase 0 — Shell ✅

- Tauri 2 desktop shell configured (`src-tauri/`)
- Vite 8 build verified (web build passes)
- All core React components operational
- Three design documents created (aiRouter, database, agent layout)

---

## Build Verification

```bash
node node_modules/vite/bin/vite.js build
# ✓ built in 12.28s
# 731 modules transformed
# All chunks generated (7 output files)
```

### Blocked Items

| Issue | Impact | Workaround |
|-------|--------|------------|
| Windows Application Control Policy | Tauri Rust builds fail (error 4551) | Use web build (`npm run dev`) or CI/CD |
| `@tauri-apps/plugin-sql` externalized | SQLite not available in browser dev mode | localStorage fallback works seamlessly |

---

## Development Vision

### Week 1 — Foundation (Current)

| Day | Task | Status |
|-----|------|--------|
| 1 | Finish SQLite integration | ✅ Done |
| 2 | Finish Workspace model | ✅ Done |
| 3 | Finish Project model | ✅ Done |
| 4 | Finish unified AI router | ✅ Done |
| 5 | Remove duplicate AI logic | ✅ Done |

### Week 2 — Knowledge System ✅

| Task | Status | What Was Built |
|------|--------|----------------|
| Inline sidebar note filter | ✅ | Search input in sidebar filters notes by title/content in real-time |
| Tag system | ✅ | Tag input on notes (Enter/comma to add, Backspace to remove), tag badges, sidebar tag filter pills |
| Note pin/unpin | ✅ | Pin button in NoteWorkspace header, pinned notes shown first in sidebar |
| File attachments | ✅ | Image OCR + PDF extraction already existed; improved metadata display and source tracking |
| Note export | ✅ | Export menu in NoteWorkspace header — Markdown (.md) and JSON (.json) download |
| Dedicated search page | ✅ | Full `SearchPage` at `activeView === 'search'` with relevance previews, highlight matching, result counts |

### What Changed

| File | Change |
|------|--------|
| `src/store/noteStore.js` | Added `searchText`, `filterTag`, `getFilteredNotes()`, `getAllTags()`, `togglePin()`, `addTag()`, `removeTag()`, `getTagsArray()` |
| `src/components/workspace/Sidebar.jsx` | Added inline search bar, tag filter pills, pin icon indicator, tag display on note rows, filtered note count |
| `src/features/editor/NoteWorkspace.jsx` | Added tag input bar (enter/comma to add, backspace to remove), pin toggle button, export menu (Markdown/JSON) |
| `src/features/search/SearchPage.jsx` | New — full search page with keyword matching, highlight previews, time-ago timestamps, empty state |
| `src/App.jsx` | Wired `SearchPage` into `activeView === 'search'` |
| `src/index.css` | Added CSS for sidebar search bar, tag pills, tag input, export menu, search page, search highlights |

### Week 3 — Continuous Reasoning Agent ✅

| Task | Status | What Was Built |
|------|--------|----------------|
| AgentState | ✅ | Central memory class: goal, tasks, files, observations, retry, status, context builder |
| Action Types | ✅ | 10 typed actions: WRITE_FILE, READ_FILE, EDIT_FILE, DELETE_FILE, LIST_DIRECTORY, RUN_COMMAND, SEARCH_CODE, FETCH_URL, THINK, DONE |
| Task Queue | ✅ | Dynamic queue: add, prepend, insert after, remove, reorder, clear |
| Workspace Scanner | ✅ | Scans folder structure, package.json, framework, language, git status, configs, dependencies |
| Tool Executor | ✅ | Unified execution: permission check → tool execute → output capture → events. Unified result: `{success, output, error, metadata}` |
| Observation System | ✅ | Structured observations after every action: success/fail, summary, metadata, issues, suggestions |
| Agent Roles | ✅ | **Planner** (decides next action), **CodeGen** (produces file content only), **Observer** (examines results), **Reviewer** (validates code/commands) |
| Reasoning Loop | ✅ | `AgentLoop` — observe → plan → codegen → review → execute → observe → update → repeat. Never assumes plan is valid after action |
| Auto Recovery | ✅ | `analyzeFailure()` — detects failure type, creates repair tasks (install deps, create dirs, retry). `isHumanRequired()` for permissions |
| Verification | ✅ | `verifyCompletion()` — checks files exist, queue empty, no critical errors, build succeeds |
| Expanded Events | ✅ | 15 new EventStream event types: reasoning_started, action_created, tool_started, observation_recorded, retry_started, goal_completed, etc. |

### New Files (src/lib/agent/)

| File | Purpose |
|------|---------|
| `actions.js` | Action type constants, factory, type→tool mapping |
| `AgentState.js` | Central state: goal, queue, files, observations, retry, context builder |
| `AgentLoop.js` | Main reasoning loop orchestrating all roles |
| `TaskQueue.js` | Dynamic task queue with insert/reorder/remove |
| `ToolExecutor.js` | Unified tool execution: permission, execute, capture, emit |
| `WorkspaceScanner.js` | Lightweight workspace inspection |
| `Observation.js` | Structured observation factory and formatting |
| `verify.js` | Completion verification (files, commands, queue, errors) |
| `recovery.js` | Failure analysis and repair task generation |
| `roles/Planner.js` | Decides next action (JSON output, never code) |
| `roles/CodeGen.js` | Generates file content only |
| `roles/Observer.js` | Examines tool results |
| `roles/Reviewer.js` | Validates code (braces, parens, JSON, dangerous patterns) |

### Architecture Flow

```
User Goal
    │
    ▼
AgentLoop.run()
    │
    ├── AgentState initialized
    ├── WorkspaceScanner — gather context
    │
    ▼
Loop (until done or abort):
    │
    ├── Planner: decide next action (typed: WRITE_FILE, RUN_COMMAND, etc.)
    ├── CodeGen: if WRITE_FILE, generate content
    ├── Reviewer: validate generated code
    ├── ToolExecutor: permission check → execute → capture
    ├── Observer: build structured observation
    ├── AgentState: update files, tasks, errors, observations
    ├── Recovery: if failed, create repair tasks
    ├── EventStream: emit typed events for UI
    │
    ▼
VerifyCompletion: files exist? commands ok? queue empty? no errors?
    │
    ├── Yes → mark complete, return results
    └── No  → retry with repair tasks
```

### Week 4 — RAG + Polish

| Task | Description |
|------|-------------|
| RAG indexing | Background index build on notes changes |
| Semantic search | Embedding-based note retrieval |
| Related notes | Auto-detect and show related notes |
| AI memory | Agent remembers past sessions |
| Polish | Animations, theme, performance |

### Post-V1 (Out of Scope)

- Custom inference engine
- Multi-agent orchestration
- Plugin marketplace
- Mobile app
- Team collaboration
- Cloud sync

---

## File Structure

```
note_ai-main/
├── src/
│   ├── core/                   ← Core layer (new)
│   │   ├── ai.js               Unified AI router (single complete())
│   │   ├── commands.js         Command registry
│   │   ├── db.js                SQLite v2 (13 tables)
│   │   └── events.js           Event bus
│   ├── app/                    ← Application layer (new)
│   │   ├── workspace.js        Workspace service
│   │   ├── project.js          Project service
│   │   ├── note.js              Note service (CRUD + relations + cache)
│   │   ├── chat.js             Chat service
│   │   └── task.js             Task service
│   ├── lib/                    # Legacy (re-exports from core/)
│   │   ├── aiRouter.js         Re-exports + legacy wrappers
│   │   ├── ai.js               Legacy API surface
│   │   ├── db.js               Legacy CRUD helpers
│   │   ├── agent/              Agent system v2 (AgentState, AgentLoop, ToolExecutor, TaskQueue, WorkspaceScanner, Observation, recovery, verify, actions, roles/)
│   │   └── rag/                Vector RAG system
│   ├── components/             React components
│   │   └── workspace/          Workspace UI (Sidebar v2, TopBar, AIPanel, etc.)
│   ├── features/
│   │   ├── agent/              Agent mode (AgentMode, TerminalPanel, StepChecklist, etc.)
│   │   ├── editor/             Note editor (NoteWorkspace v2, RichEditor with tags/pin/export)
│   │   ├── search/             Search (GlobalSearch, SearchPage, HomeDashboard)
│   │   └── study/              Study center (StudyCenter)
│   └── store/                  Zustand stores (noteStore v2 — tags, pin, search, filter)
├── docs/
│   ├── progress_report.md      ← This file
│   ├── phase0-progress.md      Phase 0 report
│   ├── database-schema.md      Schema reference
│   ├── aiRouter-design.md      AI router design doc
│   └── agent-mode-layout.md    Agent mode layout spec
├── src-tauri/                  Tauri 2 desktop shell
└── vite.config.js              Build config (Tauri plugins externalized)
```