// ── Unified Tool Executor ───────────────────────────────────────────────
// Responsible for: validating permissions, executing tools, capturing output,
// handling failures, emitting events.

import { getTool } from './tools.js';
import { ToolPolicyEngine, RiskLevel } from './toolPolicy.js';
import { actionTypeToTool, actionRisk, ActionType } from './actions.js';
import { makeObservation } from './Observation.js';

export class ToolExecutor {
  constructor(options = {}) {
    this.policy = options.policy || new ToolPolicyEngine();
    this.stream = options.stream || null;
    this.sessionApproved = new Set();
  }

  /**
   * Execute an action through the tool system.
   * Returns unified result: { success, output, error, metadata }
   */
  async execute(action, state) {
    const toolName = actionTypeToTool(action.type);
    if (!toolName && action.type !== ActionType.THINK && action.type !== ActionType.RESPOND && action.type !== ActionType.DONE) {
      return this._failure(action, `No tool mapping for action type: ${action.type}`);
    }

    // Non-tool actions succeed automatically
    if (action.type === ActionType.THINK || action.type === ActionType.RESPOND || action.type === ActionType.DONE) {
      const result = { success: true, output: '', error: null, metadata: {} };
      this._emit('tool_finished', { action, result });
      return result;
    }

    // 1. Permission check
    const risk = actionRisk(action.type);
    const allowed = this.policy.isToolAllowed(toolName);
    if (!allowed) {
      return this._failure(action, `Tool "${toolName}" blocked by capability policy`);
    }

    // 2. Risk-based checkpoint
    if (this._requiresCheckpoint(toolName, risk)) {
      if (!this.sessionApproved.has(action.id)) {
        this._emit('tool_blocked', { action, toolName, risk, reason: `${toolName} requires approval (risk: ${risk})` });
        // The calling loop handles waiting for user approval
        return { success: false, output: null, error: 'CHECKPOINT_REQUIRED', metadata: { blocked: true, risk } };
      }
    }

    // 3. Execute
    this._emit('tool_started', { action, toolName, risk });

    const tool = getTool(toolName);
    if (!tool) {
      return this._failure(action, `Tool "${toolName}" not found in registry`);
    }

    try {
      const startTime = Date.now();
      const args = this._prepareArgs(tool, action.params);
      const rawResult = await tool.execute(args);
      const duration = Date.now() - startTime;

      // Build unified result
      const result = {
        success: rawResult.success !== false,
        output: rawResult.content || rawResult.stdout || '',
        error: rawResult.error || rawResult.stderr || null,
        metadata: {
          duration,
          exitCode: rawResult.code ?? (rawResult.success ? 0 : 1),
          operation: rawResult.fileChanged?.operation,
          files: rawResult.files,
          stdout: rawResult.stdout,
          stderr: rawResult.stderr,
        },
      };

      // Build observation
      const obs = makeObservation(action, result);
      if (state) state.recordObservation(obs);
      if (state) state.pushToolOutput(result);

      this._emit('tool_finished', { action, toolName, result, observation: obs });

      return result;

    } catch (err) {
      return this._failure(action, err.message);
    }
  }

  approveAction(actionId) {
    this.sessionApproved.add(actionId);
  }

  // ── Private ────────────────────────────────────────────────────────────

  _prepareArgs(tool, params) {
    if (tool.prepareArguments) {
      return tool.prepareArguments(params);
    }
    return params;
  }

  _requiresCheckpoint(toolName, risk) {
    if (risk === RiskLevel.SAFE) return false;
    if (risk === RiskLevel.HIGH) return true;
    // MEDIUM: check session approval
    return false;
  }

  _failure(action, message) {
    const result = { success: false, output: null, error: message, metadata: {} };
    this._emit('tool_error', { action, error: message });
    return result;
  }

  _emit(type, data) {
    if (this.stream) {
      this.stream.push({ type: `tool_${type}`, ...data });
    }
  }
}
