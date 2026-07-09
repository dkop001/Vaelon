// ── Verification ─────────────────────────────────────────────────────────
// The agent should never stop because it thinks it's done — verify first.

import { getTool } from '../tools.js';
import { ActionType } from '../actions.js';

/**
 * Verify if the goal is complete.
 * Checks: all required files exist, commands succeed, queue empty, no critical errors.
 * @returns {{ complete: boolean, reason: string, issues: string[] }}
 */
export async function verifyCompletion(state) {
  const issues = [];

  // 1. Task queue empty?
  if (state.taskQueue.length > 0) {
    issues.push(`${state.taskQueue.length} pending tasks remain`);
  }

  // 2. Critical errors?
  if (state.currentErrors.length > 0) {
    issues.push(`Unresolved errors: ${state.currentErrors.join('; ')}`);
  }

  // 3. Build status
  if (state.buildStatus === 'failed') {
    issues.push('Build is in failed state');
  }

  // 4. Verify files exist (if goal specified outputs)
  const expectedFiles = state.completedActions
    .filter(a => a.type === ActionType.WRITE_FILE && a.result?.success)
    .map(a => a.params.path);

  if (expectedFiles.length > 0) {
    const readTool = getTool('read_file');
    for (const filePath of expectedFiles) {
      try {
        const result = await readTool.execute({ path: filePath });
        if (!result.success) {
          issues.push(`Expected file not found: ${filePath}`);
        }
      } catch {
        issues.push(`Could not verify file: ${filePath}`);
      }
    }
  }

  // 5. Last observation shows success?
  const lastObs = state.observations[0];
  if (lastObs && !lastObs.success && state.taskQueue.length === 0) {
    issues.push(`Last action failed: ${lastObs.summary}`);
  }

  return {
    complete: issues.length === 0,
    reason: issues.length === 0 ? 'All checks passed' : issues.join('; '),
    issues,
  };
}

/**
 * Verify a specific file exists and has content.
 */
export async function verifyFile(path) {
  const tool = getTool('read_file');
  const result = await tool.execute({ path });
  return {
    exists: result.success,
    size: result.content?.length || 0,
    content: result.content,
  };
}

/**
 * Check if a build command succeeds.
 */
export async function verifyBuild(command) {
  const tool = getTool('run_command');
  const result = await tool.execute({ command });
  return {
    success: result.success,
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.metadata?.exitCode,
  };
}
