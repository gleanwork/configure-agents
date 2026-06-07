import fs from 'node:fs/promises';
import path from 'node:path';
import { REQUIRED_FILES } from '../baseline/spec.js';
import { checkAgents, checkClaude, checkSkill } from './rules.js';
import type { Violation } from '../types/index.js';

export interface CheckOptions {
  repoDir?: string;
  json?: boolean;
}

export interface CheckResult {
  violations: Array<Violation>;
}

async function readFileOrNull(target: string): Promise<string | null> {
  try {
    return await fs.readFile(target, 'utf8');
  } catch {
    return null;
  }
}

export async function checkRepo(
  options: CheckOptions = {},
): Promise<CheckResult> {
  const repoDir = path.resolve(options.repoDir ?? process.cwd());

  const violations: Array<Violation> = [];

  for (const relativePath of REQUIRED_FILES) {
    const content = await readFileOrNull(path.join(repoDir, relativePath));

    if (content === null) {
      violations.push({ file: relativePath, message: 'file is missing' });
      continue;
    }

    if (relativePath === 'AGENTS.md') {
      violations.push(...checkAgents(relativePath, content));
    }

    if (relativePath === 'CLAUDE.md') {
      violations.push(...checkClaude(relativePath, content));
    }

    if (relativePath === 'skills/SKILL.md') {
      violations.push(...checkSkill(relativePath, content));
    }
  }

  return { violations };
}
