// ── Agent Loop ───────────────────────────────────────────────────────────
// Continuous reasoning loop: observe → decide → execute → observe → update
//   → repeat until goal complete or aborted.

// 1. User Goal
// 2. Observe workspace
// 3. Generate ONE action (Planner)
// 4. If WRITE_FILE, generate content (CodeGen) then review (Reviewer)
// 5. Permission check (ToolExecutor)
// 6. Execute tool (ToolExecutor)
// 7. Observe result (Observer)
// 8. Update state
// 9. If failed: create repair tasks (Recovery)
// 10. Verify completion
// 11. Repeat until verified or aborted

import { AgentState } from './AgentState.js';
import { TaskQueue } from './TaskQueue.js';
import { ToolExecutor } from './ToolExecutor.js';
import { scanWorkspace, formatWorkspaceForPlanner } from './WorkspaceScanner.js';
import { planNext } from './roles/Planner.js';
import { generateFile } from './roles/CodeGen.js';
import { reviewFile, reviewCommandResult } from './roles/Reviewer.js';
import { observe } from './roles/Observer.js';
import { analyzeFailure, isHumanRequired } from './recovery.js';
import { verifyCompletion } from './verify.js';
import { createAction, ActionType } from './actions.js';
import { EventStream, AgentEventTypes } from './EventStream.js';
import { ToolPolicyEngine } from './toolPolicy.js';

export class AgentLoop {
  constructor(options = {}) {
    this.stream = options.stream || new EventStream();
    this.policy = options.policy || new ToolPolicyEngine();
    this.executor = new ToolExecutor({ policy: this.policy, stream: this.stream });
    this.maxIterations = options.maxIterations || 50;
    this.iteration = 0;
    this.state = null;
  }

  /**
   * Start the agent loop for the given goal.
   * @param {string} goal
   * @param {string} [basePath='.']
   * @returns {Promise<{state: AgentState, summary: Object}>}
   */
  async run(goal, basePath = '.') {
    this.iteration = 0;

    // 1. Scan workspace
    this.stream.push({ type: 'observation_recorded', summary: 'Scanning workspace...' });
    const workspaceCtx = await scanWorkspace(basePath);

    // 2. Initialize state
    this.state = new AgentState(goal, workspaceCtx);
    this.state.isRunning = true;
    this.state.buildStatus = 'running';

    this.stream.push({ type: 'reasoning_started', goal, workspaceCtx });

    // 3. Main loop
    while (this.state.isRunning && !this.state.isComplete && this.iteration < this.maxIterations) {
      if (this.state.abortRequested) break;
      this.iteration++;

      // Check if we have queued tasks first
      let action = this.state.taskQueue.shift();
      if (!action) {
        // No pending tasks — ask planner for next action
        this.stream.push({ type: 'reasoning_started', iteration: this.iteration });
        action = await planNext(this.state, workspaceCtx);
        this.stream.push({ type: 'action_created', action });
      }

      // Handle DONE
      if (action.type === ActionType.DONE) {
        this.stream.push({ type: 'reasoning_completed', summary: 'Planner signaled done' });
        break;
      }

      // If WRITE_FILE, generate code content
      if (action.type === ActionType.WRITE_FILE && !action.params.content && action.params.requirements) {
        action.params.content = await generateFile(action, this.state);
        // Review the generated code
        const review = reviewFile(action.params.path, action.params.content, this.state);
        if (!review.pass) {
          this.stream.push({ type: 'tool_error', action, error: 'Code review failed', review });
          // Try once more
          action.params.content = await generateFile(action, this.state);
          const retryReview = reviewFile(action.params.path, action.params.content, this.state);
          if (!retryReview.pass) {
            this.stream.push({ type: 'tool_error', action, error: 'Code review failed after retry', review: retryReview });
            this.state.currentErrors.push('Code generation failed review');
            continue;
          }
        }
      }

      // Execute
      this.stream.push({ type: 'action_started', action });
      const result = await this.executor.execute(action, this.state);

      // Handle checkpoint requirement (pending approval)
      if (result.error === 'CHECKPOINT_REQUIRED') {
        this.stream.push({
          type: 'tool_blocked',
          action,
          reason: result.error,
          requiresApproval: true,
        });
        // Wait for approval (UI listens for this event)
        await this._waitForCheckpoint(action.id);
        // Re-execute after approval
        this.executor.approveAction(action.id);
        const retryResult = await this.executor.execute(action, this.state);

        if (retryResult.success) {
          this.state.recordCompleted(action, retryResult);
        } else {
          this._handleFailure(action, retryResult);
        }
        continue;
      }

      if (result.success) {
        this.state.recordCompleted(action, result);

        // Build observation
        const obs = observe(action, result);
        this.stream.push({ type: 'observation_recorded', observation: obs });

        // If command ran, check stderr for warnings
        if (action.type === ActionType.RUN_COMMAND) {
          const cmdReview = reviewCommandResult(result);
          if (!cmdReview.pass) {
            for (const issue of cmdReview.issues) {
              if (issue.severity === 'error') {
                this.state.currentErrors.push(issue.message);
              }
            }
          }
        }

      } else {
        this._handleFailure(action, result);
      }

      // Progress event
      this.stream.push({
        type: 'task_completed',
        completedCount: this.state.completedActions.length,
        pendingCount: this.state.taskQueue.length,
      });
    }

    // 4. Verify completion
    this.stream.push({ type: 'observation_recorded', summary: 'Verifying completion...' });
    const verification = await verifyCompletion(this.state);

    if (verification.complete) {
      this.state.markComplete();
      this.stream.push({ type: 'goal_completed', state: this.state, verification });
    } else {
      // If verification failed but we have retries, add repair tasks
      if (this.state.canRetry() && this.iteration < this.maxIterations) {
        this.state.retryCount++;
        this.state.incrementRetry();
        for (const issue of verification.issues) {
          this.state.taskQueue.push(
            createAction(ActionType.RUN_COMMAND, { command: `echo "FIX: ${issue}"` }, `Repair: ${issue}`)
          );
        }
        // Recurse (one level)
        return this.run(goal, basePath);
      }
      this.state.markFailed(verification.reason);
      this.stream.push({ type: 'goal_completed', state: this.state, verification, failed: true });
    }

    return {
      state: this.state,
      summary: this._buildSummary(),
    };
  }

  /** Stop the agent loop. */
  stop() {
    if (this.state) {
      this.state.abortRequested = true;
      this.state.isRunning = false;
    }
    this._resolveCheckpoint();
  }

  /** Approve a blocked action. */
  approve(actionId) {
    this.executor.approveAction(actionId);
    this._resolveCheckpoint();
  }

  // ── Private ────────────────────────────────────────────────────────────

  _handleFailure(action, result) {
    this.state.recordCompleted(action, result);
    const obs = observe(action, result);
    this.stream.push({ type: 'observation_recorded', observation: obs });

    if (isHumanRequired(action, result)) {
      this.stream.push({
        type: 'tool_blocked',
        action,
        reason: result.error,
        requiresHuman: true,
      });
      return;
    }

    // Generate repair tasks
    if (action.retryCount < 3) {
      const repairs = analyzeFailure(action, result, this.state);
      for (const r of repairs) {
        r.isRepair = true;
        this.state.taskQueue.unshift(r);
      }
      this.stream.push({ type: 'retry_started', action, repairCount: repairs.length });
    }
  }

  _checkpointResolve = null;

  _waitForCheckpoint(actionId) {
    return new Promise((resolve) => {
      this._checkpointResolve = () => { resolve(); this._checkpointResolve = null; };
    });
  }

  _resolveCheckpoint() {
    if (this._checkpointResolve) {
      this._checkpointResolve();
    }
  }

  _buildSummary() {
    return {
      goal: this.state.goal,
      completedActions: this.state.completedActions.length,
      filesCreated: this.state.filesCreated.length,
      filesModified: this.state.filesModified.length,
      errors: this.state.currentErrors.length,
      observations: this.state.observations.length,
      status: this.state.buildStatus,
    };
  }
}
