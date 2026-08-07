// ── Vaelon Type-safe IPC Client ───────────────────────────────────────────
// Hand-crafted TS wrappers around Tauri invoke() commands.
// Matches Rust models and commands perfectly.

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

// ── Types ─────────────────────────────────────────────────────────────────

export interface Workspace {
  id: string;
  name: string;
  path: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  color: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: string;
  workspace_id: string;
  project_id: string;
  title: string;
  content: string;
  tags: string[];
  summary: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChatSession {
  id: string;
  workspace_id: string;
  project_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata: any;
  created_at: string;
}

export interface Task {
  id: string;
  workspace_id: string;
  project_id: string;
  note_id?: string;
  title: string;
  description: string;
  status: 'pending' | 'inprogress' | 'done' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  due_date?: string;
  created_at: string;
  updated_at: string;
}

export interface FsEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified: string;
}

export interface SearchResult {
  note_id: string;
  title: string;
  snippet: string;
  score: number;
  updated_at: string;
}

export interface LlmSettings {
  mode: 'auto' | 'local' | 'cloud';
  ollama_model?: string;
  ollama_base_url: string;
  groq_api_key: string;
  groq_model: string;
}

export interface ModelInfo {
  name: string;
  provider: string;
  size_bytes: number;
}

// ── Commands ──────────────────────────────────────────────────────────────

export const api = {
  // Workspace
  workspaceList: () => invoke<Workspace[]>('workspace_list_cmd'),
  workspaceCreate: (name: string, path: string) => invoke<Workspace>('workspace_create_cmd', { name, path }),
  workspaceDelete: (id: string) => invoke<void>('workspace_delete_cmd', { id }),

  // Projects
  projectList: (workspaceId: string) => invoke<Project[]>('project_list_cmd', { workspaceId }),
  projectCreate: (workspaceId: string, name: string) => invoke<Project>('project_create_cmd', { workspaceId, name }),
  projectDelete: (id: string) => invoke<void>('project_delete_cmd', { id }),

  // Notes
  noteList: (workspaceId: string, projectId?: string) => invoke<Note[]>('note_list_cmd', { workspaceId, projectId }),
  noteGet: (id: string) => invoke<Note | null>('note_get_cmd', { id }),
  noteCreate: (workspaceId: string, projectId: string, title: string) =>
    invoke<Note>('note_create_cmd', { workspaceId, projectId, title }),
  noteUpdate: (note: Note) => invoke<Note>('note_update_cmd', { note }),
  noteDelete: (id: string) => invoke<void>('note_delete_cmd', { id }),
  noteSearch: (workspaceId: string, query: string) => invoke<SearchResult[]>('note_search_cmd', { workspaceId, query }),

  // Chat
  chatSessionList: (workspaceId: string) => invoke<ChatSession[]>('chat_session_list_cmd', { workspaceId }),
  chatSessionCreate: (workspaceId: string, projectId: string) =>
    invoke<ChatSession>('chat_session_create_cmd', { workspaceId, projectId }),
  chatSessionDelete: (id: string) => invoke<void>('chat_session_delete_cmd', { id }),
  chatMessagesList: (sessionId: string) => invoke<ChatMessage[]>('chat_messages_list_cmd', { sessionId }),
  chatSend: (sessionId: string, content: string, workspaceContext?: string) =>
    invoke<void>('chat_send_cmd', { params: { session_id: sessionId, content, workspace_context: workspaceContext } }),

  // LLM Settings
  llmModels: () => invoke<ModelInfo[]>('llm_models_cmd'),
  llmSettingsGet: () => invoke<LlmSettings>('llm_settings_get_cmd'),
  llmSettingsSet: (settings: LlmSettings) => invoke<void>('llm_settings_set_cmd', { settings }),
  llmComplete: (messages: { role: string; content: string }[], temperature?: number, maxTokens?: number, jsonMode?: boolean) =>
    invoke<string>('llm_complete_cmd', { messages, temperature, maxTokens, jsonMode }),
  llmCompleteStreaming: (messages: { role: string; content: string }[], sessionId: string, temperature?: number, maxTokens?: number, jsonMode?: boolean) =>
    invoke<void>('llm_complete_streaming_cmd', { messages, sessionId, temperature, maxTokens, jsonMode }),

  // File System
  fsRead: (path: string) => invoke<string>('fs_read_cmd', { path }),
  fsWrite: (path: string, content: string) => invoke<void>('fs_write_cmd', { path, content }),
  fsList: (path: string) => invoke<FsEntry[]>('fs_list_cmd', { path }),
  fsDelete: (path: string) => invoke<void>('fs_delete_cmd', { path }),
  fsWatch: (path: string) => invoke<void>('fs_watch_cmd', { path }),

  // Terminal
  terminalSpawn: (shell?: string, cwd?: string) => invoke<string>('terminal_spawn_cmd', { shell, cwd }),
  terminalWrite: (id: string, data: string) => invoke<void>('terminal_write_cmd', { id, data }),
  terminalResize: (id: string, cols: number, rows: number) => invoke<void>('terminal_resize_cmd', { id, cols, rows }),
  terminalKill: (id: string) => invoke<void>('terminal_kill_cmd', { id }),

  // Agent
  agentStart: (goal: string, workspacePath: string) => invoke<string>('agent_start_cmd', { goal, workspacePath }),
  agentStop: (runId: string) => invoke<void>('agent_stop_cmd', { runId }),
  agentApprove: (actionId: string) => invoke<void>('agent_approve_cmd', { actionId }),

  // Config
  configGet: (key: string) => invoke<string | null>('config_get_cmd', { key }),
  configSet: (key: string, value: string) => invoke<void>('config_set_cmd', { key, value }),
};

// ── Events ────────────────────────────────────────────────────────────────

export function onEvent<T>(event: string, handler: (payload: T) => void) {
  let unsub: (() => void) | null = null;
  listen<T>(event, (ev) => {
    handler(ev.payload);
  }).then((un) => {
    unsub = un;
  });
  return () => {
    if (unsub) unsub();
  };
}
