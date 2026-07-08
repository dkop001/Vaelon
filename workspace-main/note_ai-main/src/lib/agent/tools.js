// ── Tool Definitions ────────────────────────────────────────────────────────
// Each tool has: name, description, parameters, execute, risk level, capability.
// Tools self-register with the hook pipeline on import.

import { invoke } from '@tauri-apps/api/core';
import { RiskLevel } from './toolPolicy.js';

// ── File System Tools ──────────────────────────────────────────────────────

export const readFile = {
  name: 'read_file',
  label: 'Read File',
  description: 'Read the contents of a file',
  capability: 'filesystem',
  risk: RiskLevel.SAFE,
  parameters: {
    path: { type: 'string', description: 'File path to read' }
  },
  prepareArguments: (args) => {
    if (!args.path) throw new Error('path is required');
    return { path: args.path };
  },
  execute: async ({ path }) => {
    try {
      const content = await invoke('read_file_cmd', { path });
      return { success: true, content };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }
};

export const writeFile = {
  name: 'write_file',
  label: 'Write File',
  description: 'Write content to a file (creates or overwrites)',
  capability: 'filesystem',
  risk: RiskLevel.MEDIUM,
  parameters: {
    path: { type: 'string', description: 'File path to write' },
    content: { type: 'string', description: 'Content to write' }
  },
  prepareArguments: (args) => ({ path: args.path, content: args.content }),
  execute: async ({ path, content }) => {
    try {
      await invoke('write_file_cmd', { path, content });
      return {
        success: true,
        message: `Wrote ${content.length} chars to ${path}`,
        fileChanged: { path, operation: 'write' },
      };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }
};

export const listFiles = {
  name: 'list_files',
  label: 'List Files',
  description: 'List files in a directory',
  capability: 'filesystem',
  risk: RiskLevel.SAFE,
  parameters: {
    path: { type: 'string', description: 'Directory path to list', optional: true }
  },
  prepareArguments: (args) => ({ path: args.path || '.' }),
  execute: async ({ path = '.' }) => {
    try {
      const files = await invoke('list_files_cmd', { path });
      return { success: true, files };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }
};

export const deleteFile = {
  name: 'delete_file',
  label: 'Delete File',
  description: 'Delete a file',
  capability: 'filesystem',
  risk: RiskLevel.HIGH,
  parameters: {
    path: { type: 'string', description: 'File path to delete' }
  },
  prepareArguments: (args) => ({ path: args.path }),
  execute: async ({ path }) => {
    try {
      await invoke('delete_file_cmd', { path });
      return {
        success: true,
        message: `Deleted ${path}`,
        fileChanged: { path, operation: 'delete' },
      };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }
};

// ── Terminal Tool ───────────────────────────────────────────────────────────

export const runCommand = {
  name: 'run_command',
  label: 'Run Command',
  description: 'Run a shell command',
  capability: 'terminal',
  risk: RiskLevel.HIGH,
  parameters: {
    command: { type: 'string', description: 'The command to execute' }
  },
  prepareArguments: (args) => ({ command: args.command }),
  execute: async ({ command }) => {
    try {
      const result = await invoke('run_shell_command', { command });
      return {
        success: result.code === 0 || result.code === undefined,
        stdout: result.stdout,
        stderr: result.stderr,
        command,
      };
    } catch (err) {
      return { success: false, error: String(err), command };
    }
  }
};

// ── Web Tools ───────────────────────────────────────────────────────────────

export const fetchUrl = {
  name: 'fetch_url',
  label: 'Fetch URL',
  description: 'Fetch content from a URL',
  capability: 'web',
  risk: RiskLevel.SAFE,
  parameters: {
    url: { type: 'string', description: 'URL to fetch' }
  },
  prepareArguments: (args) => {
    if (!args.url) throw new Error('url is required');
    // SSRF protection: validate URL scheme and block private ranges
    const parsed = new URL(args.url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Only HTTP/HTTPS URLs are allowed');
    }
    const hostname = parsed.hostname;
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.') ||
      hostname === '169.254.169.254'
    ) {
      throw new Error('Requests to private/internal addresses are blocked');
    }
    return { url: args.url };
  },
  execute: async ({ url }) => {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      const text = await res.text();
      return {
        success: true,
        content: text.slice(0, 10000),
        truncated: text.length > 10000,
        status: res.status,
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};

// ── Tool Registry ───────────────────────────────────────────────────────────

export const ALL_TOOLS = [
  readFile,
  writeFile,
  listFiles,
  deleteFile,
  runCommand,
  fetchUrl,
];

export function getTool(name) {
  return ALL_TOOLS.find(t => t.name === name);
}

export function getToolDescriptions() {
  return ALL_TOOLS.map(t => ({
    name: t.name,
    label: t.label,
    description: t.description,
    risk: t.risk,
    capability: t.capability,
    parameters: t.parameters,
  }));
}

// ── Auto-register with hook pipeline ────────────────────────────────────────

let _pipeline = null;

export function registerToolsWithPipeline(pipeline) {
  _pipeline = pipeline;
  for (const tool of ALL_TOOLS) {
    pipeline.policy.setToolRisk(tool.name, tool.risk);
  }
}

export function getPipeline() {
  return _pipeline;
}
