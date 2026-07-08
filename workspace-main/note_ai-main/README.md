# Flow — Unified Local-First AI Workspace

A single desktop application where you can think, research, write, build, and get AI help — all in one continuous flow, without touching the cloud if you don't want to.

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- Rust and Cargo (for Tauri)
- Ollama (for local AI)

### Development

```bash
# Install dependencies
npm install

# Start development server (opens in desktop window)
npm run tauri dev

# Build for production
npm run tauri build
```

### Setting up Ollama

```bash
# Install Ollama from https://ollama.ai

# Pull a small model
ollama pull llama3.2:3b

# Or a larger model for better quality
ollama pull llama3:8b

# Verify Ollama is running
ollama list
```

## Project Structure

```
note_ai-main/
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── features/           # Feature modules
│   ├── lib/                # Utility libraries
│   ├── store/              # Zustand state stores
│   └── context/            # React contexts
├── api/                    # Vercel serverless (legacy)
├── src-tauri/              # Tauri backend (Rust)
│   ├── src/
│   │   ├── main.rs         # Rust entry point
│   │   └── lib.rs          # Tauri commands
│   ├── Cargo.toml          # Rust dependencies
│   └── tauri.conf.json     # Tauri configuration
├── docs/                   # Design documents
│   ├── aiRouter-design.md  # AI routing module
│   ├── database-schema.md  # SQLite schema
│   └── agent-mode-layout.md # Agent mode UI
└── package.json            # Node dependencies
```

## Architecture

### Two Modes, One Brain

**Mode 1 — Knowledge:** Projects, Study, Research
- Capture, summarise, quiz yourself, and organise what you know
- Built on top of the existing note_ai codebase

**Mode 2 — Agent:** Chat, Code, Terminal, Build
- Build things with an AI that already knows everything from Mode 1
- AI chat, embedded terminal, code viewer, agent runner

### Shared Layer
- **SQLite database:** One local .db file for all data
- **Ollama sidecar:** One running Ollama process, shared between modes
- **AI router:** Single module that decides local vs cloud inference
- **App state:** One Zustand store, mode switching is just a state change

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/aiRouter.js` | THE most important file. All AI calls go through here. |
| `src/store/noteStore.js` | Note CRUD and AI cache |
| `src/store/appStore.js` | UI state, active mode, settings |
| `src-tauri/tauri.conf.json` | Tauri app configuration |
| `src-tauri/src/main.rs` | Rust entry point for Tauri commands |

## Development Phases

### Phase 0 — Tauri Shell (Weeks 1-3)
- [x] Create Tauri directory structure
- [x] Configure Cargo.toml and tauri.conf.json
- [x] Create Rust entry point
- [ ] Test desktop app builds and runs
- [ ] Replace localStorage with file-based storage
- [ ] Remove Supabase auth dependency

### Phase 1 — Local AI + SQLite (Weeks 3-7)
- [ ] Build aiRouter.js module
- [ ] Integrate Ollama for local inference
- [ ] Set up SQLite via tauri-plugin-sql
- [ ] Migrate data from Supabase to SQLite
- [ ] Build Settings panel

### Phase 2 — Agent Mode (Weeks 7-12)
- [ ] Add mode switcher to top bar
- [ ] Build AI chat panel with context injection
- [ ] Embed xterm.js terminal
- [ ] Build command suggestion UI
- [ ] Add CodeMirror 6 code viewer

### Phase 3 — Agent Runner + RAG (Weeks 12-18)
- [ ] Build goal → plan → execute workflow
- [ ] Implement local RAG with embeddings
- [ ] Auto-generate build logs
- [ ] Add spaced repetition tracker

## Design Documents

- [AI Router Design](docs/aiRouter-design.md)
- [Database Schema](docs/database-schema.md)
- [Agent Mode Layout](docs/agent-mode-layout.md)

## License

MIT
