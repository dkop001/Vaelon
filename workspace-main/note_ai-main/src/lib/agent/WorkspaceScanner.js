// ── Workspace Scanner ───────────────────────────────────────────────────
// Lightweight scanners for: folder structure, package manager, framework,
// git status, important configs, dependency list.
// Runs once at agent start and on request.

import { getTool } from './tools.js';

const SCAN_PATHS = {
  rootFiles: ['.', '.'],
  packageJson: ['package.json', '.'],
  git: ['.git', '.'],
  configs: ['tsconfig.json', 'vite.config.js', 'next.config.js', '.env', 'Dockerfile', 'Makefile', '.gitignore'],
};

/**
 * Scan the workspace at the given path.
 * @param {string} [basePath='.']
 * @returns {Promise<WorkspaceContext>}
 */
export async function scanWorkspace(basePath = '.') {
  const listTool = getTool('list_files');
  const readTool = getTool('read_file');

  const ctx = {
    path: basePath,
    structure: [],
    packageManager: null,
    framework: null,
    language: null,
    hasGit: false,
    gitStatus: null,
    configs: {},
    dependencies: [],
    error: null,
  };

  try {
    // 1. Root file structure
    const rootResult = await listTool.execute({ path: basePath });
    if (rootResult.success) {
      ctx.structure = rootResult.files || [];
    }

    // 2. Detect package manager and dependencies
    const pkgResult = await readTool.execute({ path: `${basePath}/package.json` }).catch(() => null);
    if (pkgResult?.success) {
      ctx.hasPackageJson = true;
      try {
        const pkg = JSON.parse(pkgResult.content);
        ctx.packageManager = detectPackageManager(basePath);
        ctx.framework = detectFramework(pkg);
        ctx.dependencies = Object.keys(pkg.dependencies || {}).concat(Object.keys(pkg.devDependencies || {}));
        const scripts = pkg.scripts || {};
        ctx.configs.scripts = scripts;
      } catch {}
    }

    // 3. Detect language and framework from structure
    ctx.language = detectLanguage(ctx.structure);

    // 4. Git status
    const gitResult = await listTool.execute({ path: `${basePath}/.git` }).catch(() => null);
    ctx.hasGit = gitResult?.success;
    if (ctx.hasGit) {
      const cmdTool = getTool('run_command');
      const statusResult = await cmdTool.execute({ command: 'git status --short' }).catch(() => null);
      if (statusResult?.success) {
        ctx.gitStatus = statusResult.stdout || '';
      }
    }

    // 5. Key config files
    for (const configPath of SCAN_PATHS.configs) {
      const cr = await readTool.execute({ path: `${basePath}/${configPath}` }).catch(() => null);
      if (cr?.success) {
        ctx.configs[configPath] = cr.content.slice(0, 500);
      }
    }

  } catch (err) {
    ctx.error = err.message;
  }

  return ctx;
}

function detectPackageManager(basePath) {
  // Simple heuristic: look for lockfiles in the structure
  return 'npm'; // default
}

function detectFramework(pkg) {
  const all = { ...pkg.dependencies, ...pkg.devDependencies };
  const names = Object.keys(all).join(' ');

  if (names.includes('next')) return 'Next.js';
  if (names.includes('react')) return 'React';
  if (names.includes('vue')) return 'Vue';
  if (names.includes('svelte')) return 'Svelte';
  if (names.includes('angular')) return 'Angular';
  if (names.includes('express')) return 'Express';
  if (names.includes('@tauri-apps')) return 'Tauri';
  return 'Unknown';
}

function detectLanguage(files) {
  const names = files.map(f => (typeof f === 'string' ? f : f.name || f.path || '')).join(' ');
  if (names.includes('.tsx')) return 'TypeScript + React';
  if (names.includes('.ts')) return 'TypeScript';
  if (names.includes('.jsx')) return 'JavaScript + React';
  if (names.includes('.py')) return 'Python';
  if (names.includes('.rs')) return 'Rust';
  if (names.includes('.go')) return 'Go';
  if (names.includes('.java')) return 'Java';
  if (names.includes('.rb')) return 'Ruby';
  return 'Unknown';
}

/**
 * Format workspace context for the planner prompt.
 */
export function formatWorkspaceForPlanner(ctx) {
  const lines = [
    'Workspace context:',
    `  Path: ${ctx.path}`,
    `  Framework: ${ctx.framework || 'Unknown'}`,
    `  Language: ${ctx.language || 'Unknown'}`,
    `  Package manager: ${ctx.packageManager || 'Unknown'}`,
    `  Has git: ${ctx.hasGit}`,
  ];

  if (ctx.dependencies.length > 0) {
    lines.push(`  Dependencies: ${ctx.dependencies.slice(0, 20).join(', ')}`);
  }

  if (ctx.hasPackageJson && ctx.configs.scripts) {
    const scripts = Object.entries(ctx.configs.scripts).slice(0, 8)
      .map(([k, v]) => `    ${k}: ${v}`).join('\n');
    lines.push(`  Available scripts:\n${scripts}`);
  }

  if (ctx.gitStatus) {
    const status = ctx.gitStatus.split('\n').filter(Boolean).slice(0, 10).join('\n    ');
    lines.push(`  Git status:\n    ${status}`);
  }

  return lines.join('\n');
}
