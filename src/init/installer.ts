import fs from 'node:fs/promises';
import path from 'node:path';
import { buildInitFiles } from './files.js';

export interface InitOptions {
  repoDir?: string;
  lang?: string;
  packageName?: string;
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

export async function initializeRepo(options: InitOptions = {}): Promise<void> {
  const repoDir = path.resolve(options.repoDir ?? process.cwd());

  const files = await buildInitFiles({
    repoDir,
    lang: options.lang,
    packageName: options.packageName,
  });

  if (options.dryRun) {
    console.log('Files that would be created:');

    for (const file of files) {
      console.log(`  ${file.path}`);
    }

    return;
  }

  let created = 0;
  let skipped = 0;

  for (const file of files) {
    const fullPath = path.join(repoDir, file.path);

    if (await fileExists(fullPath)) {
      console.log(`Skipping ${file.path} (already exists)`);
      skipped += 1;
      continue;
    }

    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, file.content, 'utf8');

    console.log(`Created ${file.path}`);
    created += 1;
  }

  console.log('');
  console.log('Initialization complete:');
  console.log(`  Created: ${created}`);
  console.log(`  Skipped: ${skipped} (already exist)`);
}
