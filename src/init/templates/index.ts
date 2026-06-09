import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

const FILES_DIR = path.join(currentDir, 'files');

export type TemplateName =
  | 'AGENTS.md'
  | 'CLAUDE.md'
  | 'SKILL.md'
  | 'workflow.yml';

export interface TemplateVariables {
  packageName: string;
  apiPointer: string;
}

const cache = new Map<TemplateName, string>();

async function loadRawTemplate(name: TemplateName): Promise<string> {
  const cached = cache.get(name);

  if (cached !== undefined) {
    return cached;
  }

  const raw = await fs.readFile(path.join(FILES_DIR, `${name}.tmpl`), 'utf8');

  cache.set(name, raw);

  return raw;
}

function substitute(content: string, variables: TemplateVariables): string {
  return content
    .replaceAll('{{PACKAGE_NAME}}', variables.packageName)
    .replaceAll('{{API_POINTER}}', variables.apiPointer);
}

export async function loadTemplate(
  name: TemplateName,
  variables: TemplateVariables,
): Promise<string> {
  const raw = await loadRawTemplate(name);

  return substitute(raw, variables);
}
