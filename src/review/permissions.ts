// Repo permission rules for agents, in Claude Code's permission syntax.
//
// There is no cross-agent standard for permission files yet. Claude Code's
// `permissions` block ({ allow, ask, deny } lists of "Tool" or
// "Tool(pattern)" rules in `.claude/settings.json`) is the most widely copied
// format, so the review module uses it as written and adds no keys.
//
// Keep PRESETS and compileCodex in step with
// https://github.com/scalvert/skills/blob/main/shared/scalvert/scripts/permissions.mjs,
// which enforces the same rules at runtime. test/fixtures/presets.json pins
// the shared contract.

export interface Permissions {
  allow: Array<string>;
  ask: Array<string>;
  deny: Array<string>;
}

export const AUTONOMY_LEVELS = [
  'local-only',
  'draft-pr',
  'self-merge',
] as const;

export type Autonomy = (typeof AUTONOMY_LEVELS)[number];

export const DEFAULT_AUTONOMY: Autonomy = 'draft-pr';

// External actions every preset gates. A bare `git push` while on the
// default branch needs a hook, because a rule cannot see the current branch.
const GATED = [
  'Bash(gh pr comment *)',
  'Bash(gh pr review *)',
  'Bash(gh pr close *)',
  'Bash(gh issue create *)',
  'Bash(gh issue comment *)',
  'Bash(gh issue close *)',
  'Bash(gh release *)',
  'Bash(npm publish *)',
  'Bash(pnpm publish *)',
  'Bash(yarn npm publish *)',
  'Bash(git push -f *)',
  'Bash(git push * -f)',
  'Bash(git push * -f *)',
  'Bash(git push *--force*)',
  'Bash(git push * main)',
  'Bash(git push * master)',
  'Bash(git push *:main)',
  'Bash(git push *:master)',
  'mcp__*github*__create_*',
  'mcp__*github*__add_*',
  'mcp__*github*__update_*',
  'mcp__*github*__merge_*',
  'mcp__*github*__submit_*',
  'mcp__*github*__delete_*',
  'mcp__*github*__push_*',
  'mcp__*slack*__*post*',
  'mcp__*slack*__*send*',
];

const MERGE = ['Bash(gh pr merge *)', 'Bash(gh pr ready *)'];

// Feature-branch pushes are allowed; force pushes and pushes to main or
// master are in GATED, and an ask rule beats an allow rule.
const DRAFT = ['Bash(git push *)', 'Bash(gh pr create --draft *)'];

export const PRESETS: Record<Autonomy, Permissions> = {
  'local-only': {
    allow: [],
    ask: [...GATED, ...MERGE, 'Bash(git push *)', 'Bash(gh pr create *)'],
    deny: [],
  },
  'draft-pr': { allow: [...DRAFT], ask: [...GATED, ...MERGE], deny: [] },
  'self-merge': { allow: [...DRAFT, ...MERGE], ask: [...GATED], deny: [] },
};

export function isAutonomy(value: string): value is Autonomy {
  return (AUTONOMY_LEVELS as ReadonlyArray<string>).includes(value);
}

export class PermissionsError extends Error {}

const RULE_PATTERN = /^([^()]+?)(?:\((.*)\))?$/s;

export function parsePermissions(value: unknown): Permissions {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new PermissionsError(
      'permissions must be an object with allow, ask and deny lists',
    );
  }

  const record = value as Record<string, unknown>;
  const result: Permissions = { allow: [], ask: [], deny: [] };

  for (const key of ['allow', 'ask', 'deny'] as const) {
    const list = record[key];

    if (list === undefined) {
      continue;
    }

    if (
      !Array.isArray(list) ||
      list.some((rule) => typeof rule !== 'string' || rule.trim() === '')
    ) {
      throw new PermissionsError(
        `permissions.${key} must be a list of rule strings`,
      );
    }

    for (const rule of list as Array<string>) {
      if (!RULE_PATTERN.test(rule)) {
        throw new PermissionsError(`invalid rule "${rule}"`);
      }
    }

    result[key] = list as Array<string>;
  }

  return result;
}

// The preset these rules equal, if any.
export function matchPreset(permissions: Permissions): Autonomy | undefined {
  const same = (a: Array<string>, b: Array<string>) =>
    a.length === b.length && a.every((rule, i) => rule === b[i]);

  return AUTONOMY_LEVELS.find(
    (level) =>
      same(PRESETS[level].allow, permissions.allow) &&
      same(PRESETS[level].ask, permissions.ask) &&
      same(PRESETS[level].deny, permissions.deny),
  );
}

// Codex execpolicy only matches command prefixes. A rule with one trailing
// wildcard becomes a prefix rule. An exact rule becomes a prefix rule only for
// ask and deny, where matching more is the safe direction. Mid-pattern
// wildcards and MCP rules need a hook.
const CODEX_DECISION = {
  deny: 'forbidden',
  ask: 'prompt',
  allow: 'allow',
} as const;

export const CODEX_RULES_PATH = '.codex/rules/permissions.rules';

export function toCodexPrefix(
  rule: string,
  kind: keyof Permissions,
): Array<string> | null {
  const match = RULE_PATTERN.exec(rule);

  if (!match || match[1].trim() !== 'Bash' || match[2] === undefined) {
    return null;
  }

  const pattern = match[2].endsWith(':*')
    ? `${match[2].slice(0, -2)} *`
    : match[2];
  const stars = (pattern.match(/\*/g) ?? []).length;
  let prefix: string;

  if (stars === 0) {
    if (kind === 'allow') {
      return null;
    }

    prefix = pattern;
  } else if (stars === 1 && pattern.endsWith(' *')) {
    prefix = pattern.slice(0, -2);
  } else {
    return null;
  }

  const tokens = prefix.trim().split(/\s+/);

  return tokens.length > 0 && tokens[0] !== '' ? tokens : null;
}

export function compileCodex(permissions: Permissions): string {
  const lines = [
    '# Generated from .claude/settings.json. Do not edit; regenerate instead.',
    '# Rules that Codex prefix rules cannot express need a PreToolUse hook.',
    '',
  ];

  for (const kind of ['deny', 'ask', 'allow'] as const) {
    for (const rule of permissions[kind]) {
      const tokens = toCodexPrefix(rule, kind);

      if (tokens) {
        lines.push(
          `prefix_rule(pattern=${JSON.stringify(tokens)}, decision="${CODEX_DECISION[kind]}", justification=${JSON.stringify(`repo rule ${kind}: ${rule}`)})`,
        );
      }
    }
  }

  return `${lines.join('\n')}\n`;
}
