import { matchPreset, type Permissions } from './permissions.js';

export const REVIEW_BLOCK_START = '<!-- configure-agents:review start -->';

export const REVIEW_BLOCK_END = '<!-- configure-agents:review end -->';

export const GUIDELINES_HEADING = 'Commit and PR guidelines';

export const REVIEW_FILE = 'REVIEW.md';

function bullets(rules: Array<string>, empty: string): Array<string> {
  return rules.length === 0 ? [empty] : rules.map((rule) => `- \`${rule}\``);
}

// The AGENTS.md block is generated from the repo's permission rules, so the
// plain-language "Ask first" and "Never" sections cannot drift from what the
// hosts enforce. Agents that do not read .claude/settings.json, such as Tau,
// still see the same rules here.
export function renderReviewBlock(permissions: Permissions): string {
  const preset = matchPreset(permissions);
  const source = preset
    ? `\`.claude/settings.json\` (the \`${preset}\` preset)`
    : '`.claude/settings.json`';

  return [
    REVIEW_BLOCK_START,
    '',
    '## Ask first',
    '',
    `Agents ask a person in the current conversation before running these commands or tools in this repository. The rules live in ${source}; edit them there and run \`configure-agents review\` to update this section.`,
    '',
    ...bullets(
      permissions.ask,
      '- Nothing needs approval beyond the host defaults.',
    ),
    '',
    '## Never',
    '',
    'Agents never run these in this repository:',
    '',
    ...bullets(permissions.deny, '- Nothing is denied outright.'),
    '',
    '## Code review',
    '',
    `Follow [${REVIEW_FILE}](${REVIEW_FILE}) when reviewing changes in this repository.`,
    '',
    REVIEW_BLOCK_END,
  ].join('\n');
}

export const GUIDELINES_SECTION = [
  `## ${GUIDELINES_HEADING}`,
  '',
  "Replace each line with this repository's convention.",
  '',
  '- Branch names: <for example, a short description with no tool prefixes>.',
  '- Commits: <for example, Conventional Commits>.',
  '- Merge method: <squash, merge or rebase>.',
  '- Releases: <the release tool, and who runs it>.',
].join('\n');

export type BlockStatus = 'created' | 'updated' | 'unchanged';

export function extractReviewBlock(content: string): string | undefined {
  const start = content.indexOf(REVIEW_BLOCK_START);
  const end = content.indexOf(REVIEW_BLOCK_END);

  return start !== -1 && end > start
    ? content.slice(start, end + REVIEW_BLOCK_END.length)
    : undefined;
}

export function hasHeading(content: string, heading: string): boolean {
  const needle = heading.toLowerCase();

  return content
    .split('\n')
    .some(
      (line) => /^#{1,6}\s/.test(line) && line.toLowerCase().includes(needle),
    );
}

export function applyReviewSections(
  existing: string,
  permissions: Permissions,
): { content: string; status: BlockStatus } {
  const block = renderReviewBlock(permissions);
  const current = extractReviewBlock(existing);
  let content = current
    ? existing.replace(current, block)
    : `${existing.replace(/\s+$/, '')}\n\n${block}\n`;

  if (!hasHeading(content, GUIDELINES_HEADING)) {
    content = `${content.replace(/\s+$/, '')}\n\n${GUIDELINES_SECTION}\n`;
  }

  if (content === existing) {
    return { content, status: 'unchanged' };
  }

  return { content, status: current ? 'updated' : 'created' };
}
