import fs from 'node:fs';
import path from 'node:path';
import { WORKFLOW_PATH } from '../baseline/spec.js';
import {
  apiPointerForLanguages,
  detectLanguages,
  normalizeLanguage,
} from '../baseline/languages.js';
import type { Language } from '../types/index.js';
import { loadTemplate } from './templates/index.js';

export interface InitFile {
  path: string;
  content: string;
}

export interface BuildOptions {
  repoDir: string;
  lang?: string;
  packageName?: string;
}

function resolveLanguages(options: BuildOptions): Array<Language> {
  return options.lang
    ? [normalizeLanguage(options.lang)]
    : detectLanguages(options.repoDir);
}

function readManifestName(repoDir: string): string | undefined {
  const manifestPath = path.join(repoDir, 'package.json');

  if (!fs.existsSync(manifestPath)) {
    return undefined;
  }

  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    return typeof manifest.name === 'string' && manifest.name.length > 0
      ? manifest.name
      : undefined;
  } catch {
    return undefined;
  }
}

function resolvePackageName(options: BuildOptions): string {
  if (options.packageName) {
    return options.packageName;
  }

  return (
    readManifestName(options.repoDir) ??
    path.basename(path.resolve(options.repoDir))
  );
}

export async function buildInitFiles(
  options: BuildOptions,
): Promise<Array<InitFile>> {
  const languages = resolveLanguages(options);

  const variables = {
    packageName: resolvePackageName(options),
    apiPointer: apiPointerForLanguages(languages),
  };

  const agents = await loadTemplate('AGENTS.md', variables);
  const claude = await loadTemplate('CLAUDE.md', variables);
  const skill = await loadTemplate('SKILL.md', variables);
  const workflow = await loadTemplate('workflow.yml', variables);

  return [
    { path: 'AGENTS.md', content: agents },
    { path: 'CLAUDE.md', content: claude },
    { path: 'skills/SKILL.md', content: skill },
    { path: WORKFLOW_PATH, content: workflow },
  ];
}
