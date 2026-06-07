#!/usr/bin/env node

import { Command } from 'commander';
import { VERSION } from './common/version.js';
import { initializeRepo } from './init/index.js';
import { checkRepo } from './check/index.js';

const STRUCTURAL_NOTICE =
  'Structural checks only; this does not validate skill correctness or freshness.';

interface InitCliOptions {
  lang?: string;
  package?: string;
  dryRun?: boolean;
}

interface CheckCliOptions {
  json?: boolean;
}

async function runCheck(options: CheckCliOptions): Promise<void> {
  const { violations } = await checkRepo({ json: Boolean(options.json) });

  if (options.json) {
    console.log(JSON.stringify({ violations }, null, 2));
  } else {
    for (const violation of violations) {
      console.log(`${violation.file}: ${violation.message}`);
    }

    console.log('');
    console.log(STRUCTURAL_NOTICE);

    console.log(
      violations.length === 0
        ? 'Baseline OK.'
        : `Found ${violations.length} baseline violation(s).`,
    );
  }

  if (violations.length > 0) {
    process.exitCode = 1;
  }
}

async function main(): Promise<void> {
  const program = new Command();

  program
    .name('configure-agents')
    .description(
      'Scaffold and drift-check the gleanwork agent baseline (AGENTS.md, CLAUDE.md, skills/)',
    )
    .version(VERSION, '-v, --version', 'Output the current version');

  program
    .command('init')
    .description('Scaffold the agent baseline into a repository (idempotent)')
    .option(
      '--lang <lang>',
      'Override language detection (ts, python, go, java)',
    )
    .option(
      '--package <name>',
      'Package name to use in templates (defaults to the detected manifest name)',
    )
    .option('--dryRun', 'Show what would be created without writing anything')
    .action(async (options: InitCliOptions) => {
      try {
        await initializeRepo({
          lang: options.lang,
          packageName: options.package,
          dryRun: Boolean(options.dryRun),
        });
      } catch (error: any) {
        console.error(`init failed: ${error.message}`);
        process.exit(1);
      }
    });

  program
    .command('check')
    .description('Verify the agent baseline structure (exit 1 on violations)')
    .option('--json', 'Output violations as JSON')
    .action(async (options: CheckCliOptions) => {
      try {
        await runCheck(options);
      } catch (error: any) {
        console.error(`check failed: ${error.message}`);
        process.exit(1);
      }
    });

  await program.parseAsync(process.argv);

  if (process.argv.slice(2).length === 0) {
    program.help();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
