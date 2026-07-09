// ── Code Generator Role ────────────────────────────────────────────────
// Produces file content only. Never decides what to write.
// Receives file path, context, conventions, and returns code.

import { complete } from '../../../core/ai.js';

const CODEGEN_SYSTEM = `You are a code generator. Given a file path and requirements, produce ONLY the file content.

Rules:
- Output ONLY the file content. No explanations, no markdown.
- If the file already has existing content, preserve its style and patterns.
- Follow the project's language and framework conventions.
- Keep code clean, typed where appropriate, and well-structured.`;

export async function generateFile(action, state) {
  if (!action.params.path) {
    return '// No file path specified';
  }

  const context = [
    `Path: ${action.params.path}`,
    `Language/Framework: ${state.workspace.language || 'Unknown'}`,
    '',
    action.params.requirements ? `Requirements:\n${action.params.requirements}` : '',
    '',
    state.workspace.dependencies?.length > 0
      ? `Project dependencies: ${state.workspace.dependencies.slice(0, 15).join(', ')}`
      : '',
    '',
    action.params.referenceFiles?.length > 0
      ? `Reference files:\n${action.params.referenceFiles.map(r => `  ${r.path}\n${r.content?.slice(0, 300)}`).join('\n')}`
      : '',
  ].filter(Boolean).join('\n');

  const messages = [
    { role: 'system', content: CODEGEN_SYSTEM },
    { role: 'user', content: context },
  ];

  let code = '';
  await complete({
    messages,
    options: { temperature: 0.1, maxTokens: 2000 },
    stream: false,
    onChunk: (chunk) => { code += chunk; },
  });

  // Strip code fences if the model wraps output
  let cleaned = code.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');
  }

  return cleaned;
}
