import fs from 'node:fs/promises';
import path from 'node:path';
import { CLAUDE_POINTER_DIRECTIVE, README_PATH } from '../baseline/spec.js';
import { buildInitFiles } from './files.js';
import { applySkillsBlock, resolveRepoSlug } from './readme.js';

export interface InitOptions {
  repoDir?: string;
  lang?: string;
  packageName?: string;
  repo?: string;
  dryRun?: boolean;
}

async function fileExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);

    return true;
  } catch {
    return false;
  }
}

const MIGRATION_HINT =
  'existing CLAUDE.md needs migration (run: configure-agents migrate)';

export async function initializeRepo(options: InitOptions = {}): Promise<void> {
  const repoDir = path.resolve(options.repoDir ?? process.cwd());

  const files = await buildInitFiles({
    repoDir,
    lang: options.lang,
    packageName: options.packageName,
  });

  const claudePath = path.join(repoDir, 'CLAUDE.md');
  const existingClaude = (await fileExists(claudePath))
    ? await fs.readFile(claudePath, 'utf8')
    : null;
  const agentsExists = await fileExists(path.join(repoDir, 'AGENTS.md'));
  const needsMigration =
    existingClaude !== null &&
    !existingClaude.includes(CLAUDE_POINTER_DIRECTIVE) &&
    !agentsExists;

  const slug = resolveRepoSlug(repoDir, options.repo);
  const readmePath = path.join(repoDir, README_PATH);
  const existingReadme = (await fileExists(readmePath))
    ? await fs.readFile(readmePath, 'utf8')
    : null;
  const readme = applySkillsBlock(existingReadme, slug);

  if (options.dryRun) {
    console.log('Planned changes:');

    for (const file of files) {
      if (needsMigration && file.path === 'AGENTS.md') {
        console.log(`  AGENTS.md (skip — ${MIGRATION_HINT})`);
        continue;
      }

      const present = await fileExists(path.join(repoDir, file.path));
      console.log(`  ${file.path} (${present ? 'skip, exists' : 'create'})`);
    }

    console.log(`  ${README_PATH} (skills block: ${readme.status})`);

    return;
  }

  for (const file of files) {
    if (needsMigration && file.path === 'AGENTS.md') {
      console.log(`Skipping AGENTS.md — ${MIGRATION_HINT}`);
      continue;
    }

    const fullPath = path.join(repoDir, file.path);

    if (await fileExists(fullPath)) {
      console.log(`Skipping ${file.path} (already exists)`);
      continue;
    }

    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, file.content, 'utf8');
    console.log(`Created ${file.path}`);
  }

  if (readme.status === 'unchanged') {
    console.log(`Skipping ${README_PATH} (skills block up to date)`);
  } else {
    await fs.writeFile(readmePath, readme.content, 'utf8');
    const verb = readme.status === 'created' ? 'Created' : 'Updated';
    console.log(`${verb} ${README_PATH} (skills block)`);
  }
}
