import fs from 'node:fs/promises';
import path from 'node:path';
import {
  README_PATH,
  REQUIRED_FILES,
  SKILLS_DIR,
  SKILL_FILE,
} from '../baseline/spec.js';
import { checkAgents, checkClaude, checkReadme, checkSkill } from './rules.js';
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

async function findSkillFiles(repoDir: string): Promise<Array<string>> {
  let entries;

  try {
    entries = await fs.readdir(path.join(repoDir, SKILLS_DIR), {
      withFileTypes: true,
    });
  } catch {
    return [];
  }

  const files: Array<string> = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const relativePath = `${SKILLS_DIR}/${entry.name}/${SKILL_FILE}`;

    if ((await readFileOrNull(path.join(repoDir, relativePath))) !== null) {
      files.push(relativePath);
    }
  }

  return files;
}

async function checkSkillsLayout(repoDir: string): Promise<Array<Violation>> {
  const violations: Array<Violation> = [];

  const flatPath = `${SKILLS_DIR}/${SKILL_FILE}`;
  const flatExists =
    (await readFileOrNull(path.join(repoDir, flatPath))) !== null;
  const skillFiles = await findSkillFiles(repoDir);

  if (flatExists) {
    violations.push({
      file: flatPath,
      message: `skill must live in a named directory: ${SKILLS_DIR}/<name>/${SKILL_FILE}`,
    });
  }

  if (skillFiles.length === 0 && !flatExists) {
    violations.push({
      file: `${SKILLS_DIR}/`,
      message: `no skill found (expected ${SKILLS_DIR}/<name>/${SKILL_FILE})`,
    });
  }

  for (const relativePath of skillFiles) {
    const content = await readFileOrNull(path.join(repoDir, relativePath));
    const dirName = relativePath.split('/')[1];

    if (content !== null) {
      violations.push(...checkSkill(relativePath, content, dirName));
    }
  }

  return violations;
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

    if (relativePath === README_PATH) {
      violations.push(...checkReadme(relativePath, content));
    }
  }

  violations.push(...(await checkSkillsLayout(repoDir)));

  return { violations };
}
