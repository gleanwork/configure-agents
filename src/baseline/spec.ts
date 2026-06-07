export const WORKFLOW_PATH = '.github/workflows/agent-baseline.yml';

export const REQUIRED_FILES = [
  'AGENTS.md',
  'CLAUDE.md',
  'skills/SKILL.md',
  WORKFLOW_PATH,
];

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

export const CLAUDE_MUST_REFERENCE = 'AGENTS.md';
