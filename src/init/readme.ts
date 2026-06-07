import { execFileSync } from 'node:child_process';
import { SKILLS_BLOCK_START, SKILLS_BLOCK_END } from '../baseline/spec.js';

export type ReadmeStatus = 'created' | 'updated' | 'unchanged';

const PLACEHOLDER_SLUG = '<owner>/<repo>';

export function parseGitHubSlug(remoteUrl: string): string | undefined {
  const match = /github\.com[:/]([^/]+)\/(.+?)(?:\.git)?\/?$/.exec(
    remoteUrl.trim(),
  );

  return match ? `${match[1]}/${match[2]}` : undefined;
}

export function detectRepoSlug(repoDir: string): string | undefined {
  try {
    const url = execFileSync('git', ['config', '--get', 'remote.origin.url'], {
      cwd: repoDir,
      encoding: 'utf8',
    }).trim();

    return url.length > 0 ? parseGitHubSlug(url) : undefined;
  } catch {
    return undefined;
  }
}

export function resolveRepoSlug(repoDir: string, override?: string): string {
  return override ?? detectRepoSlug(repoDir) ?? PLACEHOLDER_SLUG;
}

export function renderSkillsBlock(slug: string): string {
  return [
    SKILLS_BLOCK_START,
    '',
    '## Agent skills',
    '',
    'This repository ships agent skill(s) under `skills/`. Install them into your',
    'AI agent with [`npx skills`](https://github.com/agentskills/agentskills):',
    '',
    '```sh',
    `npx skills add -g ${slug}   # global — available in every repo`,
    `npx skills add ${slug}      # or scoped to the current repo`,
    '```',
    '',
    SKILLS_BLOCK_END,
  ].join('\n');
}

export function applySkillsBlock(
  existing: string | null,
  slug: string,
): { content: string; status: ReadmeStatus } {
  const block = renderSkillsBlock(slug);

  if (existing === null) {
    const repoName = slug.split('/')[1] ?? 'project';

    return { content: `# ${repoName}\n\n${block}\n`, status: 'created' };
  }

  const start = existing.indexOf(SKILLS_BLOCK_START);
  const end = existing.indexOf(SKILLS_BLOCK_END);

  if (start !== -1 && end !== -1 && end > start) {
    const before = existing.slice(0, start);
    const after = existing.slice(end + SKILLS_BLOCK_END.length);
    const content = `${before}${block}${after}`;

    return { content, status: content === existing ? 'unchanged' : 'updated' };
  }

  const trimmed = existing.replace(/\s+$/, '');

  return { content: `${trimmed}\n\n${block}\n`, status: 'updated' };
}
