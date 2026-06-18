export const WORKFLOW_PATH = '.github/workflows/agent-baseline.yml';

export const README_PATH = 'README.md';

export const SKILLS_BLOCK_START = '<!-- configure-agents:skills start -->';

export const SKILLS_BLOCK_END = '<!-- configure-agents:skills end -->';

export const REQUIRED_FILES = [
  'AGENTS.md',
  'CLAUDE.md',
  README_PATH,
  WORKFLOW_PATH,
];

// A skill lives in its own directory: skills/<skill-name>/SKILL.md
export const SKILLS_DIR = 'skills';

export const SKILL_FILE = 'SKILL.md';

// Skill names: lowercase letters, numbers, and hyphens; no scope, no reserved words.
export const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const SKILL_NAME_MAX_LENGTH = 64;

export const RESERVED_SKILL_NAME_WORDS = ['anthropic', 'claude'];

export const SKILL_REQUIRED_FRONTMATTER = ['name', 'description'];

export const SKILL_REQUIRED_SECTIONS = [
  'When to use',
  'Install & import',
  'Authoritative API',
  'Usage patterns',
  'Common mistakes',
  'Version notes',
];

export const AGENTS_REQUIRED_SECTIONS = ['Development', 'Skills'];

export const CLAUDE_POINTER_DIRECTIVE = '@AGENTS.md';
