import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Violation } from '../types/index.js';
import {
  CODEX_RULES_PATH,
  DEFAULT_AUTONOMY,
  PRESETS,
  PermissionsError,
  compileCodex,
  isAutonomy,
  parsePermissions,
  type Autonomy,
  type Permissions,
} from './permissions.js';
import {
  GUIDELINES_HEADING,
  REVIEW_FILE,
  applyReviewSections,
  extractReviewBlock,
  hasHeading,
  renderReviewBlock,
} from './agents-block.js';

export const SETTINGS_PATH = '.claude/settings.json';

const TEMPLATE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'init',
  'templates',
  'files',
  'REVIEW.md.tmpl',
);

export interface ReviewOptions {
  repoDir?: string;
  autonomy?: string;
  dryRun?: boolean;
}

async function readOrNull(target: string): Promise<string | null> {
  try {
    return await fs.readFile(target, 'utf8');
  } catch {
    return null;
  }
}

// "Created X" reads as done; a dry run lists what would happen.
function toPlanned(action: string): string {
  return action.replace(
    /^(Created|Updated|Added|Keeping|Skipping)\b/,
    (verb) =>
      ({
        Created: 'Create',
        Updated: 'Update',
        Added: 'Add',
        Keeping: 'Keep',
        Skipping: 'Skip',
      })[verb] ?? verb,
  );
}

async function write(target: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, 'utf8');
}

interface Settings {
  raw: Record<string, unknown> | null;
  permissions: Permissions | undefined;
}

async function readSettings(repoDir: string): Promise<Settings> {
  const text = await readOrNull(path.join(repoDir, SETTINGS_PATH));

  if (text === null) {
    return { raw: null, permissions: undefined };
  }

  let raw: unknown;

  try {
    raw = JSON.parse(text);
  } catch (error: any) {
    throw new PermissionsError(
      `${SETTINGS_PATH} is not valid JSON (${error.message})`,
    );
  }

  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new PermissionsError(`${SETTINGS_PATH} must be a JSON object`);
  }

  const record = raw as Record<string, unknown>;

  return {
    raw: record,
    permissions:
      record.permissions === undefined
        ? undefined
        : parsePermissions(record.permissions),
  };
}

// Writes the review module: permission rules, the AGENTS.md sections generated
// from them, REVIEW.md, and the compiled Codex rules. Existing permission rules
// and an existing REVIEW.md are kept as they are.
export async function reviewRepo(options: ReviewOptions = {}): Promise<void> {
  const repoDir = path.resolve(options.repoDir ?? process.cwd());
  const requested = options.autonomy ?? DEFAULT_AUTONOMY;

  if (!isAutonomy(requested)) {
    throw new Error(
      `unknown autonomy "${requested}"; expected local-only, draft-pr or self-merge`,
    );
  }

  const settings = await readSettings(repoDir);
  const keepExisting = settings.permissions !== undefined;
  const permissions = settings.permissions ?? PRESETS[requested as Autonomy];
  const actions: Array<string> = [];

  if (keepExisting) {
    actions.push(
      options.autonomy
        ? `Keeping existing permissions in ${SETTINGS_PATH} (not applying ${requested}; edit the file to change them)`
        : `Keeping existing permissions in ${SETTINGS_PATH}`,
    );
  } else {
    const next = { ...(settings.raw ?? {}), permissions };

    actions.push(
      `${settings.raw ? 'Updated' : 'Created'} ${SETTINGS_PATH} (${requested} permissions)`,
    );

    if (!options.dryRun) {
      await write(
        path.join(repoDir, SETTINGS_PATH),
        `${JSON.stringify(next, null, 2)}\n`,
      );
    }
  }

  const agentsPath = path.join(repoDir, 'AGENTS.md');
  const agents = (await readOrNull(agentsPath)) ?? '# AGENTS.md\n';
  const sections = applyReviewSections(agents, permissions);

  if (sections.status === 'unchanged') {
    actions.push('Skipping AGENTS.md (review sections up to date)');
  } else {
    actions.push(
      `${sections.status === 'created' ? 'Added' : 'Updated'} review sections in AGENTS.md`,
    );

    if (!options.dryRun) {
      await write(agentsPath, sections.content);
    }
  }

  const reviewPath = path.join(repoDir, REVIEW_FILE);

  if ((await readOrNull(reviewPath)) !== null) {
    actions.push(`Skipping ${REVIEW_FILE} (already exists)`);
  } else {
    actions.push(`Created ${REVIEW_FILE}`);

    if (!options.dryRun) {
      await write(reviewPath, await fs.readFile(TEMPLATE, 'utf8'));
    }
  }

  const codexPath = path.join(repoDir, CODEX_RULES_PATH);
  const codex = compileCodex(permissions);
  const currentCodex = await readOrNull(codexPath);

  if (currentCodex === codex) {
    actions.push(`Skipping ${CODEX_RULES_PATH} (up to date)`);
  } else {
    actions.push(
      `${currentCodex === null ? 'Created' : 'Updated'} ${CODEX_RULES_PATH}`,
    );

    if (!options.dryRun) {
      await write(codexPath, codex);
    }
  }

  if (options.dryRun) {
    console.log('Planned changes:');

    for (const action of actions) {
      console.log(`  ${toPlanned(action)}`);
    }

    return;
  }

  for (const action of actions) {
    console.log(action);
  }
}

// A repo opts into the review module by having REVIEW.md or the generated
// AGENTS.md block. Repos that have neither are not checked.
export async function isReviewEnabled(repoDir: string): Promise<boolean> {
  const agents = await readOrNull(path.join(repoDir, 'AGENTS.md'));

  return (
    (await readOrNull(path.join(repoDir, REVIEW_FILE))) !== null ||
    (agents !== null && extractReviewBlock(agents) !== undefined)
  );
}

export async function checkReview(repoDir: string): Promise<Array<Violation>> {
  const violations: Array<Violation> = [];
  const fix = 'run: configure-agents review';

  let settings: Settings;

  try {
    settings = await readSettings(repoDir);
  } catch (error: any) {
    return [{ file: SETTINGS_PATH, message: error.message }];
  }

  if (settings.permissions === undefined) {
    violations.push({
      file: SETTINGS_PATH,
      message: `no permissions block; agents fall back to the ${DEFAULT_AUTONOMY} preset at runtime, but nothing records it (${fix})`,
    });
  }

  const permissions = settings.permissions ?? PRESETS[DEFAULT_AUTONOMY];
  const agents = await readOrNull(path.join(repoDir, 'AGENTS.md'));

  if (agents === null) {
    violations.push({ file: 'AGENTS.md', message: 'file is missing' });
  } else {
    const block = extractReviewBlock(agents);

    if (block === undefined) {
      violations.push({
        file: 'AGENTS.md',
        message: `missing the generated review sections (${fix})`,
      });
    } else if (block !== renderReviewBlock(permissions)) {
      violations.push({
        file: 'AGENTS.md',
        message: `review sections do not match the rules in ${SETTINGS_PATH} (${fix})`,
      });
    }

    if (!hasHeading(agents, GUIDELINES_HEADING)) {
      violations.push({
        file: 'AGENTS.md',
        message: `missing a "${GUIDELINES_HEADING}" section`,
      });
    }
  }

  if ((await readOrNull(path.join(repoDir, REVIEW_FILE))) === null) {
    violations.push({ file: REVIEW_FILE, message: 'file is missing' });
  }

  const codex = await readOrNull(path.join(repoDir, CODEX_RULES_PATH));

  if (codex === null) {
    violations.push({
      file: CODEX_RULES_PATH,
      message: `file is missing (${fix})`,
    });
  } else if (codex !== compileCodex(permissions)) {
    violations.push({
      file: CODEX_RULES_PATH,
      message: `out of date with ${SETTINGS_PATH} (${fix})`,
    });
  }

  return violations;
}
