// ── AgentState ───────────────────────────────────────────────────────────
// Central memory for every agent run. Single source of truth.
// Every component reads/writes from here instead of raw conversation.

import { createAction, ActionType } from './actions.js';

export class AgentState {
  constructor(goal, workspaceContext = {}) {
    this.goal = goal;
    this.currentObjective = goal;
    this.summary = '';
    this.createdAt = new Date().toISOString();

    // Tasks
    this.taskQueue = [];           // Ordered list of pending actions
    this.completedActions = [];    // All finished actions
    this.currentAction = null;     // The action being executed

    // Files
    this.filesCreated = [];        // Paths created this run
    this.filesModified = [];       // Paths modified this run

    // State
    this.recentToolOutputs = [];   // Last N tool results (for context)
    this.currentErrors = [];       // Active errors needing resolution
    this.buildStatus = 'idle';     // idle | running | failed | success
    this.isRunning = false;
    this.isComplete = false;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.abortRequested = false;

    // Workspace snapshot
    this.workspace = workspaceContext;

    // Observations (most recent first)
    this.observations = [];
  }

  // ── Task Queue ────────────────────────────────────────────────────────

  addTask(action) {
    this.taskQueue.push(action);
  }

  addTaskAtFront(action) {
    this.taskQueue.unshift(action);
  }

  addRepairTask(action) {
    action.isRepair = true;
    this.taskQueue.unshift(action);
  }

  nextTask() {
    if (this.taskQueue.length === 0) return null;
    this.currentAction = this.taskQueue.shift();
    this.currentAction.status = 'running';
    return this.currentAction;
  }

  peekNext() {
    return this.taskQueue[0] || null;
  }

  hasPendingTasks() {
    return this.taskQueue.length > 0;
  }

  clearTasks() {
    this.taskQueue = [];
  }

  // ── Action Recording ──────────────────────────────────────────────────

  recordCompleted(action, result) {
    action.status = result?.success ? 'completed' : 'failed';
    action.result = result;
    action.completedAt = new Date().toISOString();
    this.completedActions.push(action);
    this.currentAction = null;

    // Track files
    if (action.type === ActionType.WRITE_FILE && result?.success) {
      const path = action.params.path;
      if (!this.filesCreated.includes(path) && !this.filesModified.includes(path)) {
        if (result.metadata?.operation === 'update') {
          this.filesModified.push(path);
        } else {
          this.filesCreated.push(path);
        }
      }
    }
    if (action.type === ActionType.EDIT_FILE && result?.success) {
      const path = action.params.path;
      if (!this.filesModified.includes(path)) {
        this.filesModified.push(path);
      }
    }

    // Track errors
    if (!result?.success && result?.error) {
      if (!this.currentErrors.includes(result.error)) {
        this.currentErrors.push(result.error);
      }
    } else if (result?.success && this.currentErrors.length > 0) {
      // Clear resolved errors (simple heuristic: clear all on success)
      this.currentErrors = [];
    }
  }

  recordObservation(observation) {
    this.observations.unshift(observation);
    // Keep last 20
    if (this.observations.length > 20) this.observations.pop();
  }

  // ── Tool Output History ───────────────────────────────────────────────

  pushToolOutput(output) {
    this.recentToolOutputs.unshift(output);
    if (this.recentToolOutputs.length > 10) this.recentToolOutputs.pop();
  }

  // ── Build Status ──────────────────────────────────────────────────────

  setBuildStatus(status) {
    this.buildStatus = status;
  }

  // ── Completion ────────────────────────────────────────────────────────

  markComplete() {
    this.isComplete = true;
    this.isRunning = false;
    this.buildStatus = 'success';
  }

  markFailed(reason) {
    this.isComplete = true;
    this.isRunning = false;
    this.buildStatus = 'failed';
    this.currentErrors.push(reason);
  }

  // ── Recovery ──────────────────────────────────────────────────────────

  canRetry() {
    return this.retryCount < this.maxRetries;
  }

  incrementRetry() {
    this.retryCount++;
  }

  // ── Context Builder ───────────────────────────────────────────────────
  // Builds a focused context string for the planner/codegen.

  buildPlannerContext() {
    const parts = [
      `Goal: ${this.goal}`,
      `Current objective: ${this.currentObjective}`,
      `Build status: ${this.buildStatus}`,
      `Pending tasks: ${this.taskQueue.length}`,
    ];

    if (this.completedActions.length > 0) {
      const last = this.completedActions.slice(-3);
      parts.push('Recent actions:');
      for (const a of last) {
        parts.push(`  ${a.status}: ${a.description}`);
      }
    }

    if (this.currentErrors.length > 0) {
      parts.push('Current errors:');
      for (const err of this.currentErrors) {
        parts.push(`  ${err}`);
      }
    }

    if (this.observations.length > 0) {
      parts.push('Recent observations:');
      for (const obs of this.observations.slice(0, 3)) {
        parts.push(`  ${obs.summary}`);
      }
    }

    return parts.join('\n');
  }
}
