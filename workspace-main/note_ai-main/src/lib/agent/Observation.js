// ── Observation System ─────────────────────────────────────────────────
// Structured observations captured after every action.
// The planner receives observations instead of raw tool outputs.

import { ActionType } from './actions.js';

/**
 * Build an observation from a completed action and its result.
 * @param {AgentAction} action
 * @param {Object} result - from tool executor
 * @returns {Observation}
 */
export function makeObservation(action, result) {
  const obs = {
    type: 'observation',
    actionType: action.type,
    actionDescription: action.description,
    summary: '',
    success: !!result?.success,
    timestamp: new Date().toISOString(),
    metadata: {},
  };

  switch (action.type) {
    case ActionType.WRITE_FILE: {
      const path = action.params.path || '';
      obs.summary = result?.success
        ? `Wrote ${path}${result.metadata?.operation === 'update' ? ' (updated existing)' : ''}`
        : `Failed to write ${path}: ${result?.error}`;
      obs.metadata = { path, operation: result?.metadata?.operation || 'create', size: action.params.content?.length || 0 };
      break;
    }
    case ActionType.READ_FILE: {
      const path = action.params.path || '';
      obs.summary = result?.success
        ? `Read ${path} (${result.content?.length || 0} chars)`
        : `Failed to read ${path}: ${result?.error}`;
      obs.metadata = { path, found: !!result?.content };
      break;
    }
    case ActionType.EDIT_FILE: {
      const path = action.params.path || '';
      obs.summary = result?.success
        ? `Edited ${path}`
        : `Failed to edit ${path}: ${result?.error}`;
      obs.metadata = { path };
      break;
    }
    case ActionType.DELETE_FILE: {
      const path = action.params.path || '';
      obs.summary = result?.success
        ? `Deleted ${path}`
        : `Failed to delete ${path}: ${result?.error}`;
      obs.metadata = { path };
      break;
    }
    case ActionType.LIST_DIRECTORY: {
      const path = action.params.path || '.';
      const fileCount = result?.files?.length || 0;
      obs.summary = result?.success
        ? `Listed ${path}: ${fileCount} entries`
        : `Failed to list ${path}: ${result?.error}`;
      obs.metadata = { path, fileCount, files: result?.files?.slice(0, 20) };
      break;
    }
    case ActionType.RUN_COMMAND: {
      const cmd = (action.params.command || '').slice(0, 80);
      const exitCode = result?.metadata?.exitCode ?? (result?.success ? 0 : 1);
      obs.summary = result?.success
        ? `Command succeeded (exit ${exitCode}): ${cmd}`
        : `Command failed (exit ${exitCode}): ${cmd} — ${(result?.stderr || result?.error || '').slice(0, 200)}`;
      obs.metadata = { command: action.params.command, exitCode, stdout: result?.stdout, stderr: result?.stderr };
      break;
    }
    case ActionType.SEARCH_CODE: {
      obs.summary = result?.success
        ? `Searched for "${action.params.query}": ${result?.files?.length || 0} matches`
        : `Search failed: ${result?.error}`;
      obs.metadata = { query: action.params.query, matches: result?.files };
      break;
    }
    default:
      obs.summary = result?.success
        ? `Action completed: ${action.description}`
        : `Action failed: ${result?.error || 'unknown error'}`;
  }

  return obs;
}

/**
 * Format observations for the planner prompt.
 */
export function observationsForPlanner(observations, max = 5) {
  return observations.slice(0, max).map(o =>
    `  [${o.actionType}] ${o.summary}`
  ).join('\n');
}
