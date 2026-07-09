// ── Agent Action Types ──────────────────────────────────────────────────
// Every agent cycle produces exactly one executable action.
// Actions are the only way the agent interacts with the world.

export const ActionType = {
  WRITE_FILE: 'write_file',
  READ_FILE: 'read_file',
  EDIT_FILE: 'edit_file',
  DELETE_FILE: 'delete_file',
  LIST_DIRECTORY: 'list_directory',
  RUN_COMMAND: 'run_command',
  SEARCH_CODE: 'search_code',
  FETCH_URL: 'fetch_url',
  THINK: 'think',
  RESPOND: 'respond',
  DONE: 'done',
};

/**
 * Create a typed action.
 * @param {string} type - ActionType value
 * @param {Object} params - Tool-specific parameters
 * @param {string} [description] - Human-readable summary
 * @returns {AgentAction}
 */
export function createAction(type, params = {}, description = '') {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
    type,
    params,
    description: description || type,
    status: 'pending', // pending | running | completed | failed | skipped
    createdAt: new Date().toISOString(),
    completedAt: null,
    result: null,
    retryCount: 0,
    maxRetries: 3,
  };
}

/**
 * Action type to tool name mapping.
 */
export function actionTypeToTool(type) {
  const map = {
    [ActionType.WRITE_FILE]: 'write_file',
    [ActionType.READ_FILE]: 'read_file',
    [ActionType.EDIT_FILE]: 'edit_file',
    [ActionType.DELETE_FILE]: 'delete_file',
    [ActionType.LIST_DIRECTORY]: 'list_files',
    [ActionType.RUN_COMMAND]: 'run_command',
    [ActionType.SEARCH_CODE]: null,
    [ActionType.FETCH_URL]: 'fetch_url',
  };
  return map[type] || null;
}

/**
 * Default risk level for each action type.
 */
export function actionRisk(type) {
  const map = {
    [ActionType.WRITE_FILE]: 'medium',
    [ActionType.READ_FILE]: 'safe',
    [ActionType.EDIT_FILE]: 'medium',
    [ActionType.DELETE_FILE]: 'high',
    [ActionType.LIST_DIRECTORY]: 'safe',
    [ActionType.RUN_COMMAND]: 'high',
    [ActionType.SEARCH_CODE]: 'safe',
    [ActionType.FETCH_URL]: 'safe',
    [ActionType.THINK]: 'safe',
    [ActionType.RESPOND]: 'safe',
    [ActionType.DONE]: 'safe',
  };
  return map[type] || 'safe';
}
