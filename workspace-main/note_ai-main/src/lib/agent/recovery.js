// ── Automatic Recovery ──────────────────────────────────────────────────
// When something fails: observe → determine failure type → create repair
// task → execute → retry → continue.

import { createAction, ActionType } from './actions.js';

/**
 * Analyze a failed action and generate repair tasks.
 * @param {Object} action - The failed action
 * @param {Object} result - The result from tool executor
 * @param {Object} state - AgentState
 * @returns {AgentAction[]} - Repair tasks to prepend
 */
export function analyzeFailure(action, result, state) {
  const repairs = [];
  const error = result?.error || 'Unknown error';

  switch (action.type) {
    case ActionType.RUN_COMMAND: {
      const cmd = action.params.command || '';
      if (error.includes('not found') || error.includes('command not found')) {
        // Missing dependency — try installing
        const tool = cmd.split(' ')[0];
        repairs.push(createAction(
          ActionType.RUN_COMMAND,
          { command: `npm install ${tool}` },
          `Install missing dependency: ${tool}`
        ));
      } else if (error.includes('ENOENT') || error.includes('no such file')) {
        // Missing file reference in command
        repairs.push(createAction(
          ActionType.LIST_DIRECTORY,
          { path: '.' },
          'Check directory contents to find correct path'
        ));
      } else if (error.includes('permission') || error.includes('EACCES')) {
        repairs.push(createAction(
          ActionType.RUN_COMMAND,
          { command: cmd.startsWith('npm ') ? `npx ${cmd.slice(4)}` : cmd },
          'Retry with different permissions'
        ));
      }
      break;
    }

    case ActionType.WRITE_FILE: {
      const path = action.params.path || '';
      const dir = path.includes('/') ? path.split('/').slice(0, -1).join('/') : '.';
      repairs.push(createAction(
        ActionType.LIST_DIRECTORY,
        { path: dir },
        `Verify directory exists: ${dir}`
      ));
      if (dir !== '.') {
        repairs.push(createAction(
          ActionType.RUN_COMMAND,
          { command: `mkdir -p "${dir}"` },
          `Create directory: ${dir}`
        ));
        // Re-add the write after directory creation
        repairs.push(createAction(
          ActionType.WRITE_FILE,
          { path, content: action.params.content, requirements: action.params.requirements },
          `Retry writing ${path}`
        ));
      }
      break;
    }

    case ActionType.READ_FILE: {
      // File doesn't exist — list parent dir to find alternatives
      const path = action.params.path || '';
      const dir = path.includes('/') ? path.split('/').slice(0, -1).join('/') : '.';
      repairs.push(createAction(
        ActionType.LIST_DIRECTORY,
        { path: dir },
        `Search for file in ${dir}`
      ));
      break;
    }

    default:
      // Generic retry
      if (state.canRetry()) {
        const retry = createAction(
          action.type,
          action.params,
          `Retry: ${action.description}`
        );
        retry.retryCount = action.retryCount + 1;
        repairs.push(retry);
      }
  }

  return repairs;
}

/**
 * Determine if a failure requires human intervention.
 */
export function isHumanRequired(action, result) {
  const critical = [
    'permission denied',
    'EACCES',
    'authentication',
    'API key',
    'rate limit',
  ];
  const error = (result?.error || '').toLowerCase();
  return critical.some(c => error.includes(c));
}
