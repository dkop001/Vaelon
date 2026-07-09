// ── Planner Role ─────────────────────────────────────────────────────────
// Decides what action to take next based on goal, state, and observations.
// Never generates code — only decides the next action type.

import { complete } from '../../../core/ai.js';
import { createAction, ActionType } from '../actions.js';

const PLANNER_SYSTEM = `You are a workspace agent planner. Your job is to decide the single next action.

Produce valid JSON only:
{
  "action": "WRITE_FILE | READ_FILE | EDIT_FILE | DELETE_FILE | LIST_DIRECTORY | RUN_COMMAND | SEARCH_CODE | FETCH_URL | THINK | DONE",
  "params": {},
  "description": "one-line summary",
  "reasoning": "why this action"
}

Rules:
- Always produce exactly ONE action.
- Never generate code. Only decide actions.
- Use THINK when you need to reason before acting.
- Use DONE when the goal is complete.
- Prefer small, verifiable steps.
- If a command failed, schedule a repair before continuing.`;

export async function planNext(state, workspaceCtx) {
  const context = [
    `Goal: ${state.goal}`,
    `Current objective: ${state.currentObjective}`,
    `Build status: ${state.buildStatus}`,
    `Pending tasks: ${state.taskQueue.length}`,
    state.taskQueue.length > 0 ? `Next queued: ${state.taskQueue[0].type} - ${state.taskQueue[0].description}` : '',
    `Files created: ${state.filesCreated.length}`,
    `Files modified: ${state.filesModified.length}`,
    '',
    'Workspace:',
    `  Framework: ${workspaceCtx.framework || 'Unknown'}`,
    `  Language: ${workspaceCtx.language || 'Unknown'}`,
    '',
    state.currentErrors.length > 0 ? `Errors:\n${state.currentErrors.map(e => `  ${e}`).join('\n')}` : '',
    state.observations.length > 0
      ? `Last observation: ${state.observations[0].summary}`
      : 'No observations yet.',
  ].filter(Boolean).join('\n');

  const messages = [
    { role: 'system', content: PLANNER_SYSTEM },
    { role: 'user', content: context },
  ];

  let raw = '';
  await complete({
    messages,
    options: { temperature: 0.1, maxTokens: 300, jsonMode: true },
    stream: false,
    onChunk: (chunk) => { raw += chunk; },
  });

  const parsed = parsePlannerResponse(raw);
  const action = createAction(
    ActionType[parsed.action] || ActionType.THINK,
    parsed.params || {},
    parsed.description || parsed.action,
  );
  action.reasoning = parsed.reasoning || '';

  return action;
}

function parsePlannerResponse(raw) {
  let str = raw.trim();
  if (str.startsWith('```')) str = str.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try {
    return JSON.parse(str);
  } catch {
    return { action: 'THINK', params: {}, description: 'Parse fallback', reasoning: 'Failed to parse planner output' };
  }
}
