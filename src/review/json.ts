// Formats JSON the way Prettier does with its defaults (print width 80, two
// spaces), so a generated `.claude/settings.json` passes a repo's
// `prettier --check` without a formatting commit. Objects always break across
// lines; an array of scalars stays on one line when the whole line fits.

const PRINT_WIDTH = 80;

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

type Scalar = null | boolean | number | string;

function isScalar(value: Json): value is Scalar {
  return value === null || typeof value !== 'object';
}

function format(
  value: Json,
  indent: string,
  prefix: string,
  suffix: string,
): string {
  if (isScalar(value)) {
    return `${indent}${prefix}${JSON.stringify(value)}${suffix}`;
  }

  const inner = `${indent}  `;

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return `${indent}${prefix}[]${suffix}`;
    }

    if (value.every(isScalar)) {
      const inline = `${indent}${prefix}[${value.map((v) => JSON.stringify(v)).join(', ')}]${suffix}`;

      if (inline.length <= PRINT_WIDTH) {
        return inline;
      }
    }

    const items = value.map((item, i) =>
      format(item, inner, '', i < value.length - 1 ? ',' : ''),
    );

    return [`${indent}${prefix}[`, ...items, `${indent}]${suffix}`].join('\n');
  }

  const entries = Object.entries(value);

  if (entries.length === 0) {
    return `${indent}${prefix}{}${suffix}`;
  }

  const lines = entries.map(([key, item], i) =>
    format(
      item,
      inner,
      `${JSON.stringify(key)}: `,
      i < entries.length - 1 ? ',' : '',
    ),
  );

  return [`${indent}${prefix}{`, ...lines, `${indent}}${suffix}`].join('\n');
}

export function formatJson(value: unknown): string {
  return `${format(value as Json, '', '', '')}\n`;
}
