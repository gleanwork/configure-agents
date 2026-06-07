import { existsSync } from 'node:fs';
import path from 'node:path';
import type { Language } from '../types/index.js';

interface LanguageProfile {
  language: Language;
  manifests: Array<string>;
  apiPointer: string;
}

const PROFILES: Array<LanguageProfile> = [
  {
    language: 'typescript',
    manifests: ['package.json'],
    apiPointer:
      'The authoritative API is the published TypeScript types. Read the `.d.ts` files referenced by the `types`/`exports` field in `package.json` (commonly under `dist/`). Do not guess signatures — read the types.',
  },
  {
    language: 'python',
    manifests: ['pyproject.toml', 'setup.py'],
    apiPointer:
      'The authoritative API is the package type information. Read the inline type hints in the installed package, any `.pyi` stubs, and the `py.typed` marker. Do not guess signatures — read the types.',
  },
  {
    language: 'go',
    manifests: ['go.mod'],
    apiPointer:
      'The authoritative API is the exported identifiers in the package source. Read the godoc on pkg.go.dev or the exported declarations in the source. Do not guess signatures — read the source.',
  },
  {
    language: 'java',
    manifests: ['pom.xml', 'build.gradle', 'build.gradle.kts'],
    apiPointer:
      'The authoritative API is the public classes and their Javadoc. Read the published Javadoc or the public class declarations. Do not guess signatures — read the Javadoc.',
  },
];

const GENERIC_API_POINTER =
  'The authoritative API is your library public, typed surface that ships with the code. Point the reader at it (type definitions, generated interface docs, or exported source) and tell them to read it rather than guess.';

const POINTER_SEPARATOR = `

`;

const ALIASES: Record<string, Language> = {
  ts: 'typescript',
  typescript: 'typescript',
  js: 'typescript',
  javascript: 'typescript',
  py: 'python',
  python: 'python',
  go: 'go',
  golang: 'go',
  java: 'java',
};

export function detectLanguages(repoDir: string): Array<Language> {
  const detected = PROFILES.filter((profile) =>
    profile.manifests.some((manifest) =>
      existsSync(path.join(repoDir, manifest)),
    ),
  ).map((profile) => profile.language);

  return detected.length > 0 ? detected : ['unknown'];
}

export function normalizeLanguage(value: string): Language {
  return ALIASES[value.toLowerCase()] ?? 'unknown';
}

export function apiPointerFor(language: Language): string {
  const profile = PROFILES.find((entry) => entry.language === language);

  return profile ? profile.apiPointer : GENERIC_API_POINTER;
}

export function apiPointerForLanguages(languages: Array<Language>): string {
  const known = languages.filter((language) => language !== 'unknown');

  return known.length > 0
    ? known.map((language) => apiPointerFor(language)).join(POINTER_SEPARATOR)
    : GENERIC_API_POINTER;
}
