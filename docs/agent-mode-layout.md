# Agent Mode Layout — Flow v1.0

## Overview
Agent mode (Mode 2) is the build/coding interface. It shares the same database and AI engine as Knowledge mode (Mode 1) but provides a split-view layout optimized for development tasks.

## Layout Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│  TopBar  [Knowledge] [Agent]  │  Model: llama3.2:3b ▼  │ ⚙️ 🌙  │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────┬────────────────────────────────────────┐ │
│  │                      │                                        │ │
│  │    AI Chat Panel     │         Terminal / Code Panel          │ │
│  │                      │                                        │ │
│  │  ┌────────────────┐  │  ┌──────────────────────────────────┐  │ │
│  │  │  Session List  │  │  │  Terminal                        │  │ │
│  │  │  - Chat 1      │  │  │  $ npm run dev                  │  │ │
│  │  │  - Chat 2      │  │  │  > Server running on :3000      │  │ │
│  │  │  - Chat 3      │  │  │  $                               │  │ │
│  │  └────────────────┘  │  └──────────────────────────────────┘  │ │
│  │                      │  ┌──────────────────────────────────┐  │ │
│  │  ┌────────────────┐  │  │  Code Viewer                     │  │ │
│  │  │  Chat Messages │  │  │  // src/App.jsx                  │  │ │
│  │  │  User: ...     │  │  │  function App() {                │  │ │
│  │  │  AI: ...       │  │  │    return <div>...</div>         │  │ │
│  │  │  [Run] button  │  │  │  }                               │  │ │
│  │  └────────────────┘  │  └──────────────────────────────────┘  │ │
│  │                      │                                        │ │
│  │  ┌────────────────┐  │  ┌──────────────────────────────────┐  │ │
│  │  │  Input Bar     │  │  │  Agent Runner (expandable)       │  │ │
│  │  │  [📎] [Ask AI] │  │  │  Goal: Set up React project      │  │ │
│  │  └────────────────┘  │  │  [ ] Step 1: init                │  │ │
│  │                      │  │  [ ] Step 2: install tailwind     │  │ │
│  └──────────────────────┴──┴──────────────────────────────────┘  │ │
├─────────────────────────────────────────────────────────────────────┤
│  StatusBar  │  Ln 12, Col 5  │  UTF-8  │  JavaScript  │  42 lines │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Hierarchy

```
AgentMode/
├── AgentLayout.jsx              # Main split-view container
│   ├── AgentTopBar.jsx          # Mode switcher + model selector
│   ├── AgentSidebar.jsx         # Left panel: sessions + chat
│   │   ├── SessionList.jsx      # Chat session history
│   │   ├── ChatPanel.jsx        # Active chat messages
│   │   │   ├── MessageBubble.jsx
│   │   │   ├── CommandSuggestion.jsx  # AI-suggested commands with Run button
│   │   │   └── SourcesPanel.jsx      # RAG sources (Phase 3)
│   │   └── ChatInput.jsx        # Message input + file attach
│   └── AgentMainPanel.jsx       # Right panel: terminal + code
│       ├── TerminalPanel.jsx    # xterm.js terminal
│       ├── CodeViewer.jsx       # CodeMirror 6 file viewer
│       └── AgentRunner.jsx      # Goal → Plan → Execute workflow
└── AgentContext.jsx             # Shared state for agent mode
```

## Component Specifications

### 1. AgentLayout.jsx
Main container managing the split-view layout.

```jsx
// State
{
  rightPanel: 'terminal' | 'code' | 'runner',
  splitRatio: number,  // 0.4 = 40% left, 60% right
  isResizing: boolean,
}

// Features
- Draggable divider between panels
- Responsive: collapses to tabs on narrow windows
- Remembers layout preference in app_config
```

### 2. ChatPanel.jsx
AI chat with full project context injection.

```jsx
// Props
{
  sessionId: string,
  projectId: string,
  onRunCommand: (cmd: string) => void,
  onSendToTerminal: (output: string) => void,
}

// Features
- Streams AI responses via aiRouter
- Shows command suggestions with [Run] buttons
- Attaches files via Tauri file picker
- Displays RAG sources in footer (Phase 3)
- Auto-scrolls to latest message
```

### 3. CommandSuggestion.jsx
Renders AI-suggested commands with approval UI.

```jsx
// Props
{
  command: string,
  description: string,
  onRun: (cmd: string) => void,
  status: 'pending' | 'running' | 'completed' | 'failed',
}

// UI
┌─────────────────────────────────────────┐
│  $ npm install tailwindcss @tailwindcss/vite │
│  Install Tailwind CSS and Vite plugin   │
│                      [Run] [Copy] [Skip]│
└─────────────────────────────────────────┘

// States
- pending: [Run] button enabled, gray background
- running: Spinner, [Run] disabled
- completed: Green checkmark, [Run] disabled
- failed: Red X, [Retry] button
```

### 4. TerminalPanel.jsx
Embedded terminal powered by xterm.js + Tauri shell.

```jsx
// State
{
  instance: Terminal,  // xterm.js instance
  shell: string,       // Current shell path
  cwd: string,         // Current working directory
  history: string[],   // Command history
}

// Features
- Real shell execution via Tauri invoke('run_command')
- ANSI color support
- Copy/paste integration
- Split terminal support
- Command history (up/down arrows)
- [Send to AI] button for error diagnosis
```

### 5. CodeViewer.jsx
Read/write code editor powered by CodeMirror 6.

```jsx
// Props
{
  filePath: string,
  content: string,
  language: string,
  onSave: (content: string) => void,
  onAIEdit: (suggestion: Diff) => void,
}

// Features
- Syntax highlighting for 100+ languages
- AI-suggested diffs shown inline
- Approve/reject each change
- File tree sidebar
- Search and replace
- Minimap (optional)
```

### 6. AgentRunner.jsx
Goal → Plan → Execute workflow UI.

```jsx
// State
{
  goal: string,
  plan: Array<{step, command, description, status}>,
  currentStep: number,
  isExecuting: boolean,
}

// Flow
1. User enters goal text
2. AI generates plan (JSON array)
3. User reviews checklist
4. User approves → execution begins
5. Each step:
   - Run command in terminal
   - Capture output
   - Show checkpoint
   - User can pause/skip/abort
6. On completion:
   - Auto-generate build log
   - Save to Mode 1 (Projects)
   - Show summary
```

### 7. SessionList.jsx
Chat session history sidebar.

```jsx
// Features
- Lists all chat sessions for current project
- Sorted by most recent
- Shows message count
- Search/filter sessions
- Delete session (with confirmation)
- Create new session button
```

### 8. AgentTopBar.jsx
Mode switcher and model selector.

```jsx
// Features
- [Knowledge] [Agent] tab switcher
- Model dropdown (from Ollama /api/tags)
- Sync badge (Saved/Saving/Offline)
- Theme toggle
- Settings button
```

## Context Injection (Agent Mode)

When Agent mode opens for a project, the AI gets:

```javascript
const systemPrompt = `
You are an AI coding assistant in Flow.

ACTIVE PROJECT: ${project.name}
PROJECT NOTES:
${projectNotes.map(n => `--- ${n.title} ---\n${n.content}`).join('\n\n')}

RECENT BUILD LOGS:
${buildLogs.slice(0, 5).map(log => `Goal: ${log.goal}\nOutcome: ${log.outcome}`).join('\n\n')}

INSTRUCTIONS:
- Help the user build and code based on their research
- Suggest shell commands when appropriate (prefix with $)
- Use [Run] buttons for command approval
- Reference their notes when answering questions
- Be concise and actionable
`;
```

## File Structure

```
src/features/agent/
├── AgentMode.jsx           # Main Agent mode wrapper
├── AgentLayout.jsx         # Split-view layout
├── AgentTopBar.jsx         # Mode switcher
├── AgentContext.jsx        # Shared state provider
├── chat/
│   ├── ChatPanel.jsx       # Chat messages container
│   ├── MessageBubble.jsx   # Individual message
│   ├── CommandSuggestion.jsx  # Command with Run button
│   ├── ChatInput.jsx       # Input bar
│   └── SourcesPanel.jsx    # RAG sources (Phase 3)
├── terminal/
│   ├── TerminalPanel.jsx   # xterm.js wrapper
│   └── TerminalToolbar.jsx # Send to AI, clear, etc.
├── code/
│   ├── CodeViewer.jsx      # CodeMirror 6 wrapper
│   └── FileTree.jsx        # File explorer sidebar
├── runner/
│   ├── AgentRunner.jsx     # Goal → Plan → Execute
│   ├── StepChecklist.jsx   # Plan checklist UI
│   └── StepCheckpoint.jsx  # Pause/skip/abort controls
└── sessions/
    ├── SessionList.jsx     # Chat session history
    └── SessionItem.jsx     # Individual session card
```

## State Management

```javascript
// AgentContext.jsx
{
  // Mode
  activeMode: 'knowledge' | 'agent',
  setActiveMode: (mode) => void,

  // Project
  activeProjectId: string,
  setActiveProject: (id) => void,

  // Chat
  activeSessionId: string,
  chatMessages: Message[],
  sendMessage: (text) => void,

  // Terminal
  terminalOutput: string,
  runCommand: (cmd) => void,
  sendToAI: (output) => void,

  // Code
  openFile: string | null,
  openFileContent: string,

  // Runner
  runnerGoal: string,
  runnerPlan: Step[],
  executePlan: () => void,
}
```

## Integration with Mode 1

| Action in Agent Mode | Effect in Knowledge Mode |
|---------------------|-------------------------|
| Complete build task | Build log appears in project notes |
| Save code snippet | Can be referenced in chat history |
| Run study command | Logged to study sessions |
| Chat about notes | Sources shown from RAG |

## Phase 2 Implementation Order

1. **Week 1:** AgentLayout + AgentTopBar + mode switching
2. **Week 2:** ChatPanel + MessageBubble + aiRouter integration
3. **Week 3:** TerminalPanel with xterm.js + Tauri shell
4. **Week 4:** CommandSuggestion + Run button + Send to AI
5. **Week 5:** CodeViewer with CodeMirror 6

## Phase 3 Additions

1. **Week 1-2:** AgentRunner goal → plan → execute
2. **Week 3-4:** RAG integration with embeddings
3. **Week 5-6:** Build log auto-generation
