// ── Project Context Assembly ─────────────────────────────────────────────────
// Prioritized, budgeted context builder (FR-12/FR-13). Shared by Chat Mode
// (AIPanel) and Agent Mode so both run with identical grounding.
//
// Priority order:
//   1. Project Identity  (confirmed, always)
//   2. Decisions & Mistakes (confirmed first, then recency)
//   3. Core knowledge (architecture, tech-stack, coding-style, patterns, folder-structure)
//   4. Everything else (conversations, completed-tasks, custom)
//   5. Active document (truncated with an explicit indicator, never mid-sentence)
//
// Returns the assembled string plus a report of what was included/omitted so
// the UI can show the user exactly what the model is running with.

import { useWorkspaceStore } from '../store/workspaceStore';
import { useAgentMemoryStore } from '../store/agentMemoryStore';
import { MemoryEntry, MemoryType } from '../ipc/client';

export interface ContextReport {
  identity: boolean;
  memoryIncluded: number;
  memoryOmitted: number;
  documentIncluded: boolean;
  documentTruncated: boolean;
  omittedKinds: string[];
}

export interface ProjectContext {
  context: string | undefined;
  report: ContextReport;
}

const BUDGET = {
  identity: 900,
  decisions: 2000,
  core: 2000,
  other: 1000,
  document: 4000,
};

const TIER_1: MemoryType[] = ['decisions', 'mistakes'];
const TIER_2: MemoryType[] = ['architecture', 'tech-stack', 'coding-style', 'patterns', 'folder-structure'];
const TIER_3: MemoryType[] = ['conversations', 'completed-tasks', 'custom'];

const TYPE_LABELS: Record<MemoryType, string> = {
  'architecture': 'Architecture',
  'patterns': 'Patterns & Conventions',
  'coding-style': 'Coding Style',
  'tech-stack': 'Tech Stack',
  'mistakes': 'Common Mistakes',
  'conversations': 'Past Conversations',
  'folder-structure': 'Folder Structure',
  'completed-tasks': 'Completed Tasks',
  'decisions': 'Decisions & Rationale',
  'custom': 'Custom',
};

const RENDER_ORDER: MemoryType[] = [...TIER_1, ...TIER_2, ...TIER_3];

function len(e: MemoryEntry): number {
  return e.value.length + e.key.length;
}

function sortEntries(list: MemoryEntry[]): MemoryEntry[] {
  return [...list].sort((a, b) => {
    const aConf = a.source === 'user-confirmed' ? 0 : 1;
    const bConf = b.source === 'user-confirmed' ? 0 : 1;
    if (aConf !== bConf) return aConf - bConf;
    return b.updated_at.localeCompare(a.updated_at);
  });
}

function renderSection(label: string, entries: MemoryEntry[]): string {
  const content = entries.map((e) => (e.key ? `${e.key}: ${e.value}` : e.value)).join('\n');
  return `## ${label}\n${content}`;
}

function renderIdentity(meta: NonNullable<ReturnType<typeof useWorkspaceStore.getState>['projectMeta']>): string {
  const lines: string[] = [];
  if (meta.mission.trim()) lines.push(`Mission: ${meta.mission.trim()}`);
  if (meta.tech_stack.trim()) lines.push(`Tech Stack: ${meta.tech_stack.trim()}`);
  if (meta.architecture.trim()) lines.push(`Architecture: ${meta.architecture.trim()}`);
  if (meta.coding_style.trim()) lines.push(`Coding Style: ${meta.coding_style.trim()}`);
  if (meta.current_milestone.trim()) lines.push(`Current Milestone: ${meta.current_milestone.trim()}`);
  if (meta.priority.trim()) lines.push(`Priority: ${meta.priority.trim()}`);
  if (meta.known_problems.trim()) lines.push(`Known Problems: ${meta.known_problems.trim()}`);
  return lines.join('\n');
}

function selectTier(entries: MemoryEntry[], budget: number): { selected: MemoryEntry[]; omitted: number } {
  let used = 0;
  const selected: MemoryEntry[] = [];
  for (const e of sortEntries(entries)) {
    const cost = len(e);
    if (used + cost > budget) continue;
    selected.push(e);
    used += cost;
  }
  return { selected, omitted: Math.max(0, entries.length - selected.length) };
}

export function buildProjectContext(activeNote?: { content?: string; title?: string } | null): ProjectContext {
  const parts: string[] = [];
  const report: ContextReport = {
    identity: false,
    memoryIncluded: 0,
    memoryOmitted: 0,
    documentIncluded: false,
    documentTruncated: false,
    omittedKinds: [],
  };

  // 1. Project Identity — always first, never omitted (confirmed context).
  const meta = useWorkspaceStore.getState().projectMeta;
  if (meta) {
    const text = renderIdentity(meta);
    if (text) {
      parts.push(`## PROJECT IDENTITY (confirmed context this project starts with)\n${text.slice(0, BUDGET.identity)}`);
      report.identity = true;
    }
  }

  // 2–4. Memory, tiered by priority. Only the active project's memory (plus
  // workspace-level entries) is included, so switching projects can never leak
  // another project's context into the prompt.
  const activeProjectId = useWorkspaceStore.getState().activeProjectId;
  const memories = useAgentMemoryStore.getState().memories.filter(
    (m) => !activeProjectId || m.project_id === activeProjectId || m.project_id === ''
  );
  if (memories.length > 0) {
    const byType = memories.reduce((acc, m) => {
      if (!acc[m.type]) acc[m.type] = [];
      acc[m.type].push(m);
      return acc;
    }, {} as Record<string, MemoryEntry[]>);

    const tiers: { types: MemoryType[]; budget: number }[] = [
      { types: TIER_1, budget: BUDGET.decisions },
      { types: TIER_2, budget: BUDGET.core },
      { types: TIER_3, budget: BUDGET.other },
    ];

    const selectedByType: Partial<Record<MemoryType, MemoryEntry[]>> = {};
    for (const { types, budget } of tiers) {
      const entries = types.flatMap((t) => byType[t] ?? []);
      const { selected, omitted } = selectTier(entries, budget);
      report.memoryOmitted += omitted;
      for (const e of selected) {
        (selectedByType[e.type] = selectedByType[e.type] ?? []).push(e);
      }
    }

    report.memoryIncluded = Object.values(selectedByType).flat().length;
    for (const t of RENDER_ORDER) {
      const list = selectedByType[t];
      if (!list || list.length === 0) continue;
      parts.push(renderSection(TYPE_LABELS[t], list));
    }
  }

  // 5. Active document — truncated with an explicit indicator.
  const noteText = activeNote?.content?.replace(/<[^>]*>/g, '').trim() ?? '';
  if (noteText) {
    const truncated = noteText.length > BUDGET.document;
    parts.push(
      `## ACTIVE DOCUMENT${truncated ? ' (truncated)' : ''}\n${noteText.slice(0, BUDGET.document)}`
    );
    report.documentIncluded = true;
    report.documentTruncated = truncated;
  }

  if (report.memoryOmitted > 0) {
    report.omittedKinds.push(`${report.memoryOmitted} older memories omitted for space`);
  }

  if (parts.length === 0) {
    return { context: undefined, report };
  }

  return { context: `--- PROJECT CONTEXT ---\n${parts.join('\n\n')}\n--- END CONTEXT ---`, report };
}
