// ── Observer Role ────────────────────────────────────────────────────────
// Examines the result of an action and produces a structured observation.
// Determines whether the action succeeded and what changed.

export function observe(action, result) {
  const obs = {
    actionId: action.id,
    actionType: action.type,
    success: !!result?.success,
    summary: '',
    issues: [],
    filesChanged: [],
    suggestions: [],
    timestamp: new Date().toISOString(),
  };

  if (result?.success) {
    switch (action.type) {
      case 'write_file':
      case 'edit_file':
        obs.summary = `File ${action.params.path} written successfully`;
        obs.filesChanged = [action.params.path];
        break;
      case 'delete_file':
        obs.summary = `File ${action.params.path} deleted`;
        obs.filesChanged = [action.params.path];
        break;
      case 'read_file':
        obs.summary = `Read ${action.params.path} (${(result.output || '').length} chars)`;
        break;
      case 'run_command':
        obs.summary = `Command completed (exit ${result.metadata?.exitCode ?? 0})`;
        if (result.metadata?.stderr) {
          obs.issues.push(result.metadata.stderr.slice(0, 200));
        }
        break;
      case 'list_directory':
        obs.summary = `Listed directory: ${(result.metadata?.files || []).length} entries`;
        break;
      default:
        obs.summary = `Action completed: ${action.description}`;
    }
  } else {
    obs.summary = `Action failed: ${result?.error || 'unknown error'}`;
    obs.issues.push(result?.error || 'Unknown failure');

    // Suggest recovery
    if (action.type === 'run_command') {
      obs.suggestions.push('Check command syntax, dependencies, or permissions');
    }
    if (action.type === 'write_file') {
      obs.suggestions.push('Check directory exists and is writable');
    }
    if (action.type === 'read_file') {
      obs.suggestions.push('File may not exist or path is incorrect');
    }
  }

  return obs;
}
