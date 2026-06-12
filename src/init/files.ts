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

function readFileIfExists(repoDir: string, name: string): string | undefined {
  const target = path.join(repoDir, name);

  return fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : undefined;
}

function readPackageJsonName(repoDir: string): string | undefined {
  const raw = readFileIfExists(repoDir, 'package.json');

  if (raw === undefined) {
    return undefined;
  }

  try {
    const manifest = JSON.parse(raw);

    return typeof manifest.name === 'string' && manifest.name.length > 0
      ? manifest.name
      : undefined;
  } catch {
    return undefined;
  }
}

// pyproject.toml: prefer PEP 621 `[project].name`, fall back to Poetry's
// `[tool.poetry].name`. A repo can declare both; `[project]` is authoritative.
function readPyprojectName(repoDir: string): string | undefined {
  const raw = readFileIfExists(repoDir, 'pyproject.toml');

  if (raw === undefined) {
    return undefined;
  }

  let table = '';
  let projectName: string | undefined;
  let poetryName: string | undefined;

  for (const line of raw.split('\n').map((entry) => entry.trim())) {
    const header = /^\[([^\]]+)\]$/.exec(line);

    if (header) {
      table = header[1].trim();
      continue;
    }

    const match = /^name\s*=\s*["']([^"']+)["']/.exec(line);

    if (!match) {
      continue;
    }

    if (table === 'project') {
      projectName ??= match[1];
    } else if (table === 'tool.poetry') {
      poetryName ??= match[1];
    }
  }

  return projectName ?? poetryName;
}

// go.mod: the module path's last segment is the conventional package name.
function readGoModuleName(repoDir: string): string | undefined {
  const raw = readFileIfExists(repoDir, 'go.mod');
  const match = raw ? /^module\s+(\S+)/m.exec(raw) : null;
  const segment = match?.[1].split('/').filter(Boolean).pop();

  return segment && segment.length > 0 ? segment : undefined;
}

// Java: Gradle keeps the project name in settings.gradle(.kts) as
// `rootProject.name`; Maven keeps it in the project's own `<artifactId>`
// (skip any inherited `<parent>` block).
function readJavaName(repoDir: string): string | undefined {
  for (const settings of ['settings.gradle', 'settings.gradle.kts']) {
    const raw = readFileIfExists(repoDir, settings);
    const match = raw
      ? /rootProject\.name\s*=\s*["']([^"']+)["']/.exec(raw)
      : null;

    if (match) {
      return match[1];
    }
  }

  const pom = readFileIfExists(repoDir, 'pom.xml');

  if (pom !== undefined) {
    const withoutParent = pom.replace(/<parent>[\s\S]*?<\/parent>/g, '');
    const match = /<artifactId>\s*([^<]+?)\s*<\/artifactId>/.exec(
      withoutParent,
    );

    if (match) {
      return match[1].trim();
    }
  }

  return undefined;
}

function readManifestName(repoDir: string): string | undefined {
  return (
    readPackageJsonName(repoDir) ??
    readPyprojectName(repoDir) ??
    readGoModuleName(repoDir) ??
    readJavaName(repoDir)
  );
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
