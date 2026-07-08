// ── Agent Runner ────────────────────────────────────────────────────────────
// Orchestrates plan generation → step execution → build log.
// Uses EventStream for all UI updates. Uses HookPipeline for tool safety.
// Single source of truth for agent lifecycle.

import { complete } from '../aiRouter.js';
import { ALL_TOOLS, getTool } from './tools.js';
import { EventStream, AgentEventTypes } from './EventStream.js';
import { ToolHookPipeline, registerTool } from './hookPipeline.js';
import { ToolPolicyEngine, RiskLevel } from './toolPolicy.js';

// ── Singleton Pipeline ──────────────────────────────────────────────────────

let defaultPipeline = null;

function getPipeline() {
  if (!defaultPipeline) {
    const policy = new ToolPolicyEngine();
    defaultPipeline = new ToolHookPipeline({ policy });

    // Register all tools
    for (const tool of ALL_TOOLS) {
      registerTool(tool);
    }
  }
  return defaultPipeline;
}

// ── Agent State ─────────────────────────────────────────────────────────────

let agentState = {
  goal: '',
  plan: null,
  currentStep: -1,
  history: [],
  isRunning: false,
  abortRequested: false,
};

export function getAgentState() {
  return { ...agentState };
}

export function stopAgent() {
  agentState.abortRequested = true;
  agentState.isRunning = false;
  // Unblock any pending checkpoint — prevents deadlock
  if (checkpointResolve) {
    checkpointResolve();
    checkpointResolve = null;
  }
}

// ── Plan Generation ────────────────────────────────────────────────────────

const PLAN_SYSTEM_PROMPT = `You are a build agent. Given a goal, produce a step-by-step plan.

You MUST respond with ONLY valid JSON. No markdown, no explanation, no code fences.

Output format:
{
  "goal": "<restated goal>",
  "summary": "<one-line summary of the plan>",
  "steps": [
    {
      "id": 1,
      "description": "What this step does",
      "command": "shell command to execute (or empty string if no command needed)",
      "tool": "run_command | read_file | write_file | list_files | none",
      "params": {},
      "risk": "low | medium | high",
      "dependsOn": []
    }
  ]
}

RULES:
- Each step must be independently executable
- Use "tool": "run_command" for shell commands
- Use "tool": "none" for steps that don't need a tool
- Mark destructive operations (rm, delete, overwrite) as "risk": "high"
- Keep steps small and focused (one logical action each)
- Maximum 12 steps
- If the goal is a question (not a build task), produce a single step with "tool": "none"`;

export async function generatePlan({ goal, noteContext, stream }) {
  stream.push({ type: AgentEventTypes.PROGRESS, phase: 'planning', message: 'Generating plan...' });

  const toolDescs = ALL_TOOLS
    .map(t => `${t.name} (${t.risk} risk): ${t.description}`)
    .join('\n');

  const messages = [
    { role: 'system', content: PLAN_SYSTEM_PROMPT + '\n\nAvailable tools:\n' + toolDescs },
    {
      role: 'user',
      content: `Goal: ${goal}\n\n${noteContext ? 'Context from notes:\n' + noteContext.slice(0, 1500) : ''}`
    }
  ];

  let rawResponse = '';
  await complete({
    messages,
    options: { temperature: 0.2, maxTokens: 800 },
    stream: true,
    onChunk: (chunk) => {
      rawResponse += chunk;
      stream.push({ type: AgentEventTypes.THINKING, text: rawResponse });
    }
  });

  const plan = parsePlanResponse(rawResponse, goal);

  stream.push({
    type: AgentEventTypes.PLAN_GENERATED,
    plan,
  });

  return plan;
}

function parsePlanResponse(raw, goal) {
  let jsonStr = raw.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  }

  const objMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (objMatch) jsonStr = objMatch[0];

  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed.steps && Array.isArray(parsed.steps)) {
      const steps = parsed.steps.map((s, i) => ({
        id: s.id || i + 1,
        description: s.description || 'Execute step',
        command: s.command || '',
        tool: s.tool || (s.command ? 'run_command' : 'none'),
        params: s.params || {},
        risk: s.risk || 'low',
        dependsOn: s.dependsOn || [],
        status: 'pending',
        result: null,
      }));

      return {
        goal: parsed.goal || goal,
        summary: parsed.summary || `Plan with ${steps.length} steps`,
        steps,
        createdAt: new Date().toISOString(),
      };
    }
  } catch (e) {
    console.warn('[agentRunner] Failed to parse plan JSON:', e.message);
  }

  // Fallback: direct response
  return {
    goal,
    summary: 'Direct response (no structured plan)',
    steps: [{
      id: 1,
      description: raw.slice(0, 500),
      command: '',
      tool: 'none',
      params: {},
      risk: 'low',
      dependsOn: [],
      status: 'completed',
      result: { content: raw },
    }],
    createdAt: new Date().toISOString(),
  };
}

// ── Plan Execution ──────────────────────────────────────────────────────────

export async function executePlan({ plan, noteContext, stream }) {
  // Guard against concurrent runs
  if (agentState.isRunning) {
    throw new Error('Agent is already running. Stop the current run first.');
  }

  const pipeline = getPipeline();

  agentState = {
    goal: plan.goal,
    plan,
    currentStep: 0,
    history: [],
    isRunning: true,
    abortRequested: false,
  };

  stream.push({ type: AgentEventTypes.AGENT_START, goal: plan.goal });

  try {
    for (let i = 0; i < plan.steps.length; i++) {
      if (agentState.abortRequested) break;

      const step = plan.steps[i];
      agentState.currentStep = i;

      // Skip already completed/skipped steps
      if (step.status === 'completed' || step.status === 'skipped') continue;

      // Check dependencies
      const depsMet = step.dependsOn.every(depId => {
        const dep = plan.steps.find(s => s.id === depId);
        return dep && dep.status === 'completed';
      });

      if (!depsMet) {
        const updatedStep = { ...step, status: 'skipped' };
        plan.steps[i] = updatedStep;
        stream.push({ type: AgentEventTypes.STEP_END, step: updatedStep, skipped: true });
        continue;
      }

      // Mark running (immutable)
      const runningStep = { ...step, status: 'running' };
      plan.steps[i] = runningStep;
      stream.push({
        type: AgentEventTypes.STEP_START,
        step: runningStep,
        stepIndex: i,
        totalSteps: plan.steps.length,
      });

      // Execute through hook pipeline
      if (step.tool !== 'none' && step.command) {
        const execResult = await pipeline.execute(
          step.tool,
          step.tool === 'run_command' ? { command: step.command } : step.params,
          { noteContext, step, stepIndex: i },
          new AbortController().signal,
        );

        if (execResult.blocked) {
          // Tool was blocked by policy — needs checkpoint
          const blockedStep = { ...step, status: 'pending', result: { success: false, error: execResult.reason } };
          plan.steps[i] = blockedStep;

          stream.push({
            type: AgentEventTypes.CHECKPOINT,
            step: blockedStep,
            stepIndex: i,
            reason: execResult.reason,
            requiresApproval: execResult.requiresApproval,
          });

          // Wait for user response (handled by UI calling resumeExecution)
          await waitForCheckpoint();

          if (agentState.abortRequested) break;

          // Re-execute after approval
          const retryResult = await pipeline.execute(
            step.tool,
            step.tool === 'run_command' ? { command: step.command } : step.params,
            { noteContext, step, stepIndex: i },
            new AbortController().signal,
          );

          const completedStep = { ...step, status: retryResult.success ? 'completed' : 'failed', result: retryResult.result };
          plan.steps[i] = completedStep;
        } else {
          const completedStep = { ...step, status: execResult.success ? 'completed' : 'failed', result: execResult.result };
          plan.steps[i] = completedStep;
        }
      } else {
        // No tool needed — mark complete
        step.status = 'completed';
        step.result = { success: true, content: step.description };
      }

      const currentStep = plan.steps[i];

      agentState.history.push({
        step: i,
        tool: currentStep.tool,
        command: currentStep.command,
        result: currentStep.result,
      });

      stream.push({
        type: AgentEventTypes.STEP_END,
        step: currentStep,
        stepIndex: i,
        totalSteps: plan.steps.length,
      });

      // Checkpoint after completed step (not the last one)
      if (i < plan.steps.length - 1 && currentStep.status === 'completed') {
        stream.push({
          type: AgentEventTypes.CHECKPOINT,
          step: currentStep,
          stepIndex: i,
          reason: `Step ${i + 1} completed`,
          requiresApproval: false,
          autoResume: true,
        });
      }

      // If failed, checkpoint and wait
      if (currentStep.status === 'failed') {
        stream.push({
          type: AgentEventTypes.CHECKPOINT,
          step: currentStep,
          stepIndex: i,
          reason: `Step ${i + 1} failed: ${currentStep.result?.error || 'Unknown error'}`,
          requiresApproval: true,
          failed: true,
        });

        await waitForCheckpoint();
        if (agentState.abortRequested) break;
      }
    }

    // Generate build log
    const buildLog = generateBuildLog(plan, agentState.history);

    agentState.isRunning = false;
    stream.push({ type: AgentEventTypes.BUILD_LOG, buildLog });
    stream.push({ type: AgentEventTypes.AGENT_END, buildLog, history: agentState.history });

    return { buildLog, history: agentState.history };

  } catch (err) {
    agentState.isRunning = false;
    stream.push({ type: AgentEventTypes.ERROR, source: 'runner', message: err.message });
    stream.push({ type: AgentEventTypes.AGENT_END, error: err.message });
    throw err;
  }
}

// ── Checkpoint Control ──────────────────────────────────────────────────────

let checkpointResolve = null;

function waitForCheckpoint() {
  return new Promise((resolve) => {
    checkpointResolve = resolve;
  });
}

export function acknowledgeCheckpoint(continueExecution = true) {
  agentState.isRunning = continueExecution;
  if (!continueExecution) {
    agentState.abortRequested = true;
  }

  if (checkpointResolve) {
    checkpointResolve();
    checkpointResolve = null;
  }
}

// ── Build Log Generation ────────────────────────────────────────────────────

function generateBuildLog(plan, history) {
  const stepsLog = plan.steps.map((step, i) => {
    const histEntry = history.find(h => h.step === i);
    return {
      step: step.id,
      description: step.description,
      command: step.command,
      tool: step.tool,
      status: step.status,
      risk: step.risk,
      result: histEntry?.result || step.result,
    };
  });

  const completed = stepsLog.filter(s => s.status === 'completed').length;
  const failed = stepsLog.filter(s => s.status === 'failed').length;
  const skipped = stepsLog.filter(s => s.status === 'skipped').length;

  let outcome = 'success';
  if (failed > 0) outcome = 'partial';
  if (completed === 0) outcome = 'failed';

  return {
    goal: plan.goal,
    summary: plan.summary,
    steps: stepsLog,
    outcome,
    stats: { total: stepsLog.length, completed, failed, skipped },
    createdAt: new Date().toISOString(),
  };
}

// ── Simple Chat Agent (non-build goals) ─────────────────────────────────────

export async function runAgent({ goal, noteContext, stream }) {
  agentState = {
    goal,
    plan: null,
    currentStep: 0,
    history: [],
    isRunning: true,
    abortRequested: false,
  };

  stream.push({ type: AgentEventTypes.AGENT_START, goal });

  try {
    const toolDescs = ALL_TOOLS
      .map(t => `${t.name}: ${t.description}`)
      .join('\n');

    const messages = [
      {
        role: 'system',
        content: `You are Flow's AI assistant. Answer directly and concisely.

Tools available:
${toolDescs}

RULES:
- Answer concisely
- If you need to run commands, show them with $ prefix in a code block
- Reference the user's notes when relevant
- Keep responses under 300 words`
      },
      {
        role: 'user',
        content: `Goal: ${goal}\n\nContext:\n${(noteContext || '').slice(0, 1500)}`
      }
    ];

    let fullResponse = '';

    await complete({
      messages,
      options: { temperature: 0.3, maxTokens: 500 },
      stream: true,
      onChunk: (chunk) => {
        fullResponse += chunk;
        stream.push({ type: AgentEventTypes.THINKING, text: fullResponse });
      },
    });

    agentState.history.push({
      step: 0,
      tool: 'respond',
      result: { success: true, content: fullResponse },
    });

    agentState.isRunning = false;
    stream.push({ type: AgentEventTypes.AGENT_END, response: fullResponse, history: agentState.history });

    return { response: fullResponse, history: agentState.history };

  } catch (err) {
    agentState.isRunning = false;
    stream.push({ type: AgentEventTypes.ERROR, source: 'runner', message: err.message });
    stream.push({ type: AgentEventTypes.AGENT_END, error: err.message });
    throw err;
  }
}
