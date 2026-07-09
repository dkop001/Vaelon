// ── Command Registry ──────────────────────────────────────────────────────
// Every user action is a command.
// Button → Command → Application → Core → AI
// Commands are the only way to mutate state.

const commands = new Map();

/**
 * Register a command.
 * @param {string} id - Unique command ID (e.g. "note.create", "chat.send")
 * @param {{ execute: Function, description?: string, shortcut?: string }} handler
 */
export function register(id, handler) {
  if (commands.has(id)) {
    console.warn(`[commands] Overwriting command "${id}"`);
  }
  commands.set(id, handler);
}

/**
 * Execute a command by ID.
 * @param {string} id - Command ID
 * @param {Object} [params] - Command parameters
 * @returns {Promise<any>} Command result
 */
export async function execute(id, params = {}) {
  const cmd = commands.get(id);
  if (!cmd) {
    throw new Error(`Command "${id}" not found. Available: ${[...commands.keys()].join(', ')}`);
  }

  try {
    const result = await cmd.execute(params);
    return result;
  } catch (err) {
    console.error(`[commands] Error executing "${id}":`, err);
    throw err;
  }
}

/**
 * Check if a command exists.
 */
export function has(id) {
  return commands.has(id);
}

/**
 * Get all registered commands.
 */
export function list() {
  return [...commands.entries()].map(([id, cmd]) => ({
    id,
    description: cmd.description || '',
    shortcut: cmd.shortcut || null,
  }));
}

/**
 * Clear all commands (for testing).
 */
export function clear() {
  commands.clear();
}
