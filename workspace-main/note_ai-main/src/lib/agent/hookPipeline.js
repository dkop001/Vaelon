// ── Tool Hook Pipeline ──────────────────────────────────────────────────────
// The 6-stage tool execution pipeline:
//   resolve → prepare → validate → beforeHook → execute → afterHook
//
// Every tool call goes through this pipeline. Hooks can block, modify, log,
// capture output, and feed results back to RAG.

import { EventStream, AgentEventTypes } from './EventStream.js';
import { ToolPolicyEngine, RiskLevel } from './toolPolicy.js';

// ── Tool Registry ───────────────────────────────────────────────────────────

const toolRegistry = new Map();

export function registerTool(tool) {
  toolRegistry.set(tool.name, tool);
}

export function getRegisteredTool(name) {
  return toolRegistry.get(name);
}

export function getAllRegisteredTools() {
  return Array.from(toolRegistry.values());
}

// ── Hook Types ──────────────────────────────────────────────────────────────

/**
 * @typedef {Object} BeforeToolCallContext
 * @property {string} toolName
 * @property {Object} args
 * @property {Object} context - Agent context (notes, history, etc.)
 * @property {AbortSignal} signal
 */

/**
 * @typedef {Object} BeforeToolCallResult
 * @property {boolean} block - If true, tool does not execute
 * @property {string} reason - Why it was blocked
 * @property {boolean} requiresApproval - If true, user must approve
 * @property {Object} args - Modified args (optional transform)
 */

/**
 * @typedef {Object} AfterToolCallContext
 * @property {string} toolName
 * @property {Object} args
 * @property {Object} result - Tool execution result
 * @property {Object} context - Agent context
 */

/**
 * @typedef {Object} AfterToolCallResult
 * @property {Object} result - Modified result (optional)
 * @property {boolean} terminate - If true, stop agent after this tool
 * @property {string[]} ragChunks - Chunks to index for RAG
 * @property {string[]} filesChanged - Files that were modified
 */

// ── Hook Pipeline ───────────────────────────────────────────────────────────

export class ToolHookPipeline {
  constructor(options = {}) {
    this.policy = options.policy || new ToolPolicyEngine();
    this.stream = options.stream || null;

    // Registered hooks (ordered by priority)
    this._beforeHooks = [];
    this._afterHooks = [];

    // Built-in hooks
    this._registerBuiltinHooks();
  }

  // ── Hook Registration ──────────────────────────────────────────────────

  addBeforeHook(hook, priority = 0) {
    this._beforeHooks.push({ hook, priority });
    this._beforeHooks.sort((a, b) => b.priority - a.priority);
  }

  addAfterHook(hook, priority = 0) {
    this._afterHooks.push({ hook, priority });
    this._afterHooks.sort((a, b) => b.priority - a.priority);
  }

  // ── Built-in Hooks ─────────────────────────────────────────────────────

  _registerBuiltinHooks() {
    // Hook 1: Policy enforcement (highest priority)
    this.addBeforeHook(async ({ toolName, args, context }) => {
      const result = await this.policy.runBeforeHooks(toolName, args, context);
      return result;
    }, 100);

    // Hook 1b: Policy after-hook for logging
    this.addAfterHook(async ({ toolName, args, result, context }) => {
      const override = await this.policy.runAfterHooks(toolName, args, result, context);
      return override;
    }, 100);
  }

  // ── Pipeline Execution ─────────────────────────────────────────────────

  /**
   * Execute a tool through the full pipeline.
   * Returns { success, result, blocked, requiresApproval, reason }
   */
  async execute(toolName, args, context, signal) {
    const tool = toolRegistry.get(toolName);
    if (!tool) {
      return {
        success: false,
        result: { success: false, error: `Tool "${toolName}" not found` },
        blocked: false,
        requiresApproval: false,
      };
    }

    // Stage 1: Prepare arguments
    let preparedArgs = args;
    if (tool.prepareArguments) {
      try {
        preparedArgs = tool.prepareArguments(args);
      } catch (err) {
        return {
          success: false,
          result: { success: false, error: `Argument preparation failed: ${err.message}` },
          blocked: false,
          requiresApproval: false,
        };
      }
    }

    // Stage 2: Run before hooks (includes policy check)
    let blocked = false;
    let requiresApproval = false;
    let reason = '';

    for (const { hook } of this._beforeHooks) {
      if (signal?.aborted) {
        return {
          success: false,
          result: { success: false, error: 'Aborted' },
          blocked: false,
          requiresApproval: false,
        };
      }

      try {
        const hookResult = await hook({
          toolName,
          args: preparedArgs,
          context,
          signal,
        });

        if (hookResult?.block) {
          blocked = true;
          requiresApproval = hookResult.requiresApproval || false;
          reason = hookResult.reason || 'Blocked by policy';
          break;
        }

        // Allow hooks to transform args
        if (hookResult?.args) {
          preparedArgs = hookResult.args;
        }
      } catch (err) {
        return {
          success: false,
          result: { success: false, error: `beforeHook error: ${err.message}` },
          blocked: false,
          requiresApproval: false,
        };
      }
    }

    if (blocked) {
      if (this.stream) {
        this.stream.push({
          type: AgentEventTypes.TOOL_BLOCKED,
          toolName,
          args: preparedArgs,
          reason,
          requiresApproval,
        });
      }

      return {
        success: false,
        result: { success: false, error: reason },
        blocked: true,
        requiresApproval,
        reason,
      };
    }

    // Stage 3: Execute the tool
    if (this.stream) {
      this.stream.push({
        type: AgentEventTypes.TOOL_START,
        toolName,
        args: preparedArgs,
      });
    }

    let execResult;
    try {
      const startTime = Date.now();
      execResult = await tool.execute(preparedArgs);
      const duration = Date.now() - startTime;

      if (this.stream) {
        this.stream.push({
          type: AgentEventTypes.OUTPUT,
          toolName,
          command: preparedArgs.command || preparedArgs.path || '',
          stdout: execResult.stdout || execResult.content || '',
          stderr: execResult.stderr || '',
          duration,
        });
      }
    } catch (err) {
      execResult = { success: false, error: err.message };

      if (this.stream) {
        this.stream.push({
          type: AgentEventTypes.ERROR,
          source: 'tool',
          toolName,
          message: err.message,
        });
      }
    }

    // Stage 4: Run after hooks
    let afterOverride = {};
    for (const { hook } of this._afterHooks) {
      if (signal?.aborted) break;

      try {
        const override = await hook({
          toolName,
          args: preparedArgs,
          result: execResult,
          context,
        });

        if (override) {
          afterOverride = { ...afterOverride, ...override };
        }
      } catch (err) {
        console.error('[HookPipeline] afterHook error:', err);
      }
    }

    // Apply after-hook overrides
    if (afterOverride.result) {
      execResult = afterOverride.result;
    }

    if (this.stream) {
      this.stream.push({
        type: AgentEventTypes.TOOL_END,
        toolName,
        args: preparedArgs,
        result: execResult,
        terminate: afterOverride.terminate || false,
      });
    }

    return {
      success: execResult.success !== false,
      result: execResult,
      blocked: false,
      requiresApproval: false,
      terminate: afterOverride.terminate || false,
      filesChanged: afterOverride.filesChanged || [],
      ragChunks: afterOverride.ragChunks || [],
    };
  }
}

// ── Convenience: Create a fully configured pipeline ─────────────────────────

export function createHookPipeline(options = {}) {
  return new ToolHookPipeline(options);
}

export default ToolHookPipeline;
