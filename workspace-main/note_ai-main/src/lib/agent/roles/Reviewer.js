// ── Reviewer Role ─────────────────────────────────────────────────────────
// Verifies generated code for correctness, syntax, and conventions.
// Called before writing a file produced by CodeGen.

export function reviewFile(path, generatedContent, state) {
  const issues = [];

  // 1. Empty check
  if (!generatedContent || generatedContent.trim().length === 0) {
    issues.push({ severity: 'error', message: 'Generated content is empty' });
    return { pass: false, issues };
  }

  // 2. Size sanity
  if (generatedContent.length > 50000) {
    issues.push({ severity: 'warning', message: 'File is very large (>50KB), may need splitting' });
  }

  // 3. Language-specific checks
  const ext = path.split('.').pop();
  if (ext === 'js' || ext === 'jsx' || ext === 'ts' || ext === 'tsx') {
    // Check for obvious syntax issues
    const openBraces = (generatedContent.match(/\{/g) || []).length;
    const closeBraces = (generatedContent.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
      issues.push({ severity: 'error', message: `Mismatched braces: ${openBraces} open, ${closeBraces} close` });
    }

    const openParens = (generatedContent.match(/\(/g) || []).length;
    const closeParens = (generatedContent.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      issues.push({ severity: 'error', message: `Mismatched parentheses: ${openParens} open, ${closeParens} close` });
    }
  }

  if (ext === 'json') {
    try {
      JSON.parse(generatedContent);
    } catch {
      issues.push({ severity: 'error', message: 'Invalid JSON syntax' });
    }
  }

  // 4. Check for dangerous patterns
  const dangerousPatterns = ['process.env', 'require("child_process")', 'exec(', 'eval('];
  for (const pattern of dangerousPatterns) {
    if (generatedContent.includes(pattern) && !generatedContent.includes('//')) {
      issues.push({ severity: 'warning', message: `File contains '${pattern}' — verify intentional` });
    }
  }

  return {
    pass: issues.filter(i => i.severity === 'error').length === 0,
    issues,
  };
}

/**
 * Review a command result for errors.
 */
export function reviewCommandResult(result) {
  const issues = [];

  if (!result.success) {
    issues.push({ severity: 'error', message: result.error || 'Command failed' });
    return { pass: false, issues };
  }

  // Check stderr for warnings
  if (result.metadata?.stderr && result.metadata.stderr.length > 10) {
    const isError = /error|fail|fatal|cannot|not found/i.test(result.metadata.stderr);
    issues.push({
      severity: isError ? 'error' : 'warning',
      message: result.metadata.stderr.slice(0, 300),
    });
  }

  return { pass: issues.filter(i => i.severity === 'error').length === 0, issues };
}
