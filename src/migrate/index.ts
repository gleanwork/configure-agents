import fs from 'node:fs/promises';
import path from 'node:path';
import {
  AGENTS_REQUIRED_SECTIONS,
  CLAUDE_POINTER_DIRECTIVE,
} from '../baseline/spec.js';
import { loadTemplate } from '../init/templates/index.js';

export type MigrateStatus =
  | 'migrated'
  | 'already-pointer'
  | 'no-claude'
  | 'agents-exists';

export interface MigrateOptions {
  repoDir?: string;
  dryRun?: boolean;
}

function hasHeading(markdown: string, section: string): boolean {
  const needle = section.toLowerCase();

  return markdown.split('\n').some((line) => {
    const match = /^#{1,6}\s+(.*)$/.exec(line.trim());

    return match ? match[1].trim().toLowerCase().includes(needle) : false;
  });
}

function sectionStub(section: string): string {
  return section === 'Skills'
    ? 'This repository ships an agent skill under `skills/` (one directory per skill: `skills/<name>/SKILL.md`). Keep it accurate as the public API changes.'
    : 'TODO describe how to build, test, run, and lint this project locally.';
}

function retitleClaudeHeading(markdown: string): string {
  return markdown.replace(/^(#{1,6})[ \t]+CLAUDE\.md[ \t]*$/im, '$1 AGENTS.md');
}

function promoteToAgents(claude: string): string {
  let result = retitleClaudeHeading(claude.replace(/\s+$/, ''));

  for (const section of AGENTS_REQUIRED_SECTIONS) {
    if (!hasHeading(result, section)) {
      result = `${result}\n\n## ${section}\n\n${sectionStub(section)}`;
    }
  }

  return `${result}\n`;
}

async function exists(target: string): Promise<boolean> {
  try {
    await fs.access(target);

    return true;
  } catch {
    return false;
  }
}

export async function migrateRepo(
  options: MigrateOptions = {},
): Promise<MigrateStatus> {
  const repoDir = path.resolve(options.repoDir ?? process.cwd());
  const claudePath = path.join(repoDir, 'CLAUDE.md');
  const agentsPath = path.join(repoDir, 'AGENTS.md');

  if (!(await exists(claudePath))) {
    console.log('No CLAUDE.md to migrate.');

    return 'no-claude';
  }

  const claude = await fs.readFile(claudePath, 'utf8');

  if (claude.includes(CLAUDE_POINTER_DIRECTIVE)) {
    console.log('CLAUDE.md already points to AGENTS.md; nothing to migrate.');

    return 'already-pointer';
  }

  if (await exists(agentsPath)) {
    console.error(
      'AGENTS.md already exists. Reconcile it with CLAUDE.md by hand, then run check.',
    );

    return 'agents-exists';
  }

  if (options.dryRun) {
    console.log('Planned migration:');
    console.log(
      '  CLAUDE.md -> AGENTS.md (promote existing instructions; ensure required sections)',
    );
    console.log('  CLAUDE.md (rewrite as a pointer to AGENTS.md)');

    return 'migrated';
  }

  const pointer = await loadTemplate('CLAUDE.md', {
    packageName: '',
    skillName: '',
    apiPointer: '',
  });

  await fs.writeFile(agentsPath, promoteToAgents(claude), 'utf8');
  await fs.writeFile(claudePath, pointer, 'utf8');

  console.log(
    'Migrated CLAUDE.md -> AGENTS.md (existing instructions promoted).',
  );
  console.log('Rewrote CLAUDE.md as a pointer to AGENTS.md.');
  console.log('Review AGENTS.md, then run: configure-agents check');

  return 'migrated';
}
