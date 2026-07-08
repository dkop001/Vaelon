// ── Tool Policy Engine ──────────────────────────────────────────────────────
// Risk-based tool filtering with capability graph.
// Tools are organized by capability groups. Policies filter by group, not individual tools.

/**
 * Risk levels determine execution behavior:
 * - SAFE: auto-execute, no checkpoint needed
 * - MEDIUM: ask once at session start, then auto-execute
 * - HIGH: always checkpoint, user must approve every time
 */
export const RiskLevel = {
  SAFE: 'safe',
  MEDIUM: 'medium',
  HIGH: 'high',
};

/**
 * Execution policies for each risk level.
 */
const EXECUTION_POLICIES = {
  [RiskLevel.SAFE]: {
    requiresApproval: false,
    autoExecute: true,
    description: 'Auto-execute, no approval needed',
  },
  [RiskLevel.MEDIUM]: {
    requiresApproval: true,
    autoExecute: false,
    description: 'Ask once per session, then auto-execute',
  },
  [RiskLevel.HIGH]: {
    requiresApproval: true,
    autoExecute: false,
    description: 'Always require user approval',
  },
};

// ── Capability Graph ────────────────────────────────────────────────────────

/**
 * Capabilities group related tools under a single permission scope.
 * Policies apply to entire capabilities, not individual tools.
 *
 * Example:
 *   capability: 'filesystem' → tools: ['read_file', 'write_file', 'delete_file']
 *   policy: 'filesystem' = 'allowed'  → all three tools work
 *   policy: 'filesystem' = 'blocked'  → none work
 *   policy: 'filesystem' = 'approval' → all require approval
 */
export const CAPABILITIES = {
  filesystem: {
    label: 'Filesystem',
    description: 'Read, write, and manage files',
    tools: ['read_file', 'write_file', 'delete_file', 'list_files'],
    risk: {
      read_file: RiskLevel.SAFE,
      list_files: RiskLevel.SAFE,
      write_file: RiskLevel.MEDIUM,
      delete_file: RiskLevel.HIGH,
    },
  },
  terminal: {
    label: 'Terminal',
    description: 'Execute shell commands',
    tools: ['run_command'],
    risk: {
      run_command: RiskLevel.HIGH,
    },
  },
  web: {
    label: 'Web',
    description: 'Fetch content from URLs',
    tools: ['fetch_url'],
    risk: {
      fetch_url: RiskLevel.SAFE,
    },
  },
};

// ── Tool Risk Registry ──────────────────────────────────────────────────────

const TOOL_RISK = {};
const TOOL_CAPABILITY = {};

for (const [capName, cap] of Object.entries(CAPABILITIES)) {
  for (const toolName of cap.tools) {
    TOOL_RISK[toolName] = cap.risk[toolName] || RiskLevel.SAFE;
    TOOL_CAPABILITY[toolName] = capName;
  }
}

// ── Policy Engine ───────────────────────────────────────────────────────────

export class ToolPolicyEngine {
  constructor() {
    // Default: all capabilities enabled with default risk levels
    this.capabilityPolicies = {};
    for (const capName of Object.keys(CAPABILITIES)) {
      this.capabilityPolicies[capName] = 'enabled'; // 'enabled' | 'approval' | 'blocked'
    }

    // Per-tool overrides (toolName → RiskLevel)
    this.toolOverrides = {};

    // Session-approved tools (medium-risk tools approved once)
    this.sessionApproved = new Set();

    // Custom hooks
    this._beforeToolCall = null;
    this._afterToolCall = null;
  }

  // ── Configuration ────────────────────────────────────────────────────────

  setCapabilityPolicy(capability, policy) {
    if (CAPABILITIES[capability]) {
      this.capabilityPolicies[capability] = policy;
    }
  }

  setToolRisk(toolName, riskLevel) {
    this.toolOverrides[toolName] = riskLevel;
  }

  setBeforeToolCallHook(hook) {
    this._beforeToolCall = hook;
  }

  setAfterToolCallHook(hook) {
    this._afterToolCall = hook;
  }

  // ── Query ────────────────────────────────────────────────────────────────

  getToolRisk(toolName) {
    if (this.toolOverrides[toolName]) {
      return this.toolOverrides[toolName];
    }
    // Unknown tools default to HIGH (safe by default)
    return TOOL_RISK[toolName] ?? RiskLevel.HIGH;
  }

  getToolCapability(toolName) {
    return TOOL_CAPABILITY[toolName] || null;
  }

  getCapabilityPolicy(capability) {
    return this.capabilityPolicies[capability] || 'enabled';
  }

  isToolAllowed(toolName) {
    const cap = this.getToolCapability(toolName);
    if (cap && this.capabilityPolicies[cap] === 'blocked') {
      return false;
    }
    return true;
  }

  requiresCheckpoint(toolName) {
    const cap = this.getToolCapability(toolName);

    // If capability is blocked, tool is blocked entirely
    if (cap && this.capabilityPolicies[cap] === 'blocked') {
      return false; // Will be filtered out, not checkpointed
    }

    // If capability is in approval mode, check session approval first
    if (cap && this.capabilityPolicies[cap] === 'approval') {
      return !this.sessionApproved.has(toolName);
    }

    // Check per-tool risk level
    const risk = this.getToolRisk(toolName);

    if (risk === RiskLevel.SAFE) return false;
    if (risk === RiskLevel.HIGH) return true;

    // MEDIUM: check if already approved this session
    if (risk === RiskLevel.MEDIUM) {
      return !this.sessionApproved.has(toolName);
    }

    return false;
  }

  approveTool(toolName) {
    this.sessionApproved.add(toolName);
  }

  revokeApproval(toolName) {
    this.sessionApproved.delete(toolName);
  }

  // ── Filter Tools ─────────────────────────────────────────────────────────

  filterTools(tools) {
    return tools.filter(tool => this.isToolAllowed(tool.name));
  }

  // ── Policy Pipeline ──────────────────────────────────────────────────────
  // Runs before each tool execution. Can block, modify, or pass through.

  async runBeforeHooks(toolName, args, context) {
    // 1. Check if tool is allowed
    if (!this.isToolAllowed(toolName)) {
      return {
        block: true,
        reason: `Tool "${toolName}" is blocked by policy (capability: ${this.getToolCapability(toolName)})`,
      };
    }

    // 2. Check if capability is in approval mode
    const cap = this.getToolCapability(toolName);
    if (cap && this.capabilityPolicies[cap] === 'approval') {
      if (!this.sessionApproved.has(toolName)) {
        return {
          block: true,
          requiresApproval: true,
          reason: `Tool "${toolName}" requires approval (capability: ${cap} is in approval mode)`,
        };
      }
    }

    // 3. Check risk level
    if (this.requiresCheckpoint(toolName)) {
      return {
        block: true,
        requiresApproval: true,
        reason: `Tool "${toolName}" requires approval (risk: ${this.getToolRisk(toolName)})`,
      };
    }

    // 4. Run custom beforeToolCall hook
    if (this._beforeToolCall) {
      try {
        const result = await this._beforeToolCall({ toolName, args, context });
        if (result?.block) {
          return { block: true, reason: result.reason || 'Blocked by beforeToolCall hook' };
        }
      } catch (err) {
        return { block: true, reason: `beforeToolCall hook error: ${err.message}` };
      }
    }

    return { block: false };
  }

  async runAfterHooks(toolName, args, result, context) {
    // Run custom afterToolCall hook
    if (this._afterToolCall) {
      try {
        const override = await this._afterToolCall({ toolName, args, result, context });
        return override || {};
      } catch (err) {
        console.error('[ToolPolicy] afterToolCall hook error:', err);
        return {};
      }
    }

    return {};
  }

  // ── Serializable state ───────────────────────────────────────────────────

  toJSON() {
    return {
      capabilityPolicies: this.capabilityPolicies,
      toolOverrides: this.toolOverrides,
    };
  }

  static fromJSON(data) {
    const engine = new ToolPolicyEngine();
    if (data.capabilityPolicies) {
      Object.assign(engine.capabilityPolicies, data.capabilityPolicies);
    }
    if (data.toolOverrides) {
      Object.assign(engine.toolOverrides, data.toolOverrides);
    }
    return engine;
  }
}

// ── Convenience ─────────────────────────────────────────────────────────────

export function getToolRisk(toolName) {
  return TOOL_RISK[toolName] || RiskLevel.SAFE;
}

export function getToolCapability(toolName) {
  return TOOL_CAPABILITY[toolName] || null;
}

export function getCapabilityTools(capability) {
  return CAPABILITIES[capability]?.tools || [];
}

export function getAllCapabilities() {
  return Object.entries(CAPABILITIES).map(([name, cap]) => ({
    name,
    label: cap.label,
    description: cap.description,
    tools: cap.tools,
    policy: 'enabled',
  }));
}

export default ToolPolicyEngine;
