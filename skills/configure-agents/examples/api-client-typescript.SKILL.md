---
name: glean-api-client
description: Use the Glean API TypeScript SDK (@gleanwork/api-client-typescript) to call Glean's REST API — search, chat, documents, indexing, and admin. Load when writing TypeScript that talks to the Glean API or when @gleanwork/api-client-typescript is imported.
---

# @gleanwork/api-client-typescript

The official TypeScript SDK for the Glean API. It is generated from Glean's OpenAPI spec, so it is fully typed and the types are the source of truth.

> This file is a worked example for the authoring rubric. It demonstrates the pattern — point at the generated types, then carry only judgment — not a maintained skill.

## When to use

Load this skill when writing TypeScript or JavaScript that calls the Glean API — search, chat/assistant, document retrieval, indexing, or admin endpoints — or whenever `@gleanwork/api-client-typescript` appears in the code.

## Install & import

```fish
npm install @gleanwork/api-client-typescript
```

```ts
import { Glean } from '@gleanwork/api-client-typescript';
```

## Authoritative API

The API surface is generated and fully typed. Read the bundled type definitions for exact method names, parameters, request/response shapes, and enums — do not guess them:

- the `.d.ts` files referenced by the `types`/`exports` field in `node_modules/@gleanwork/api-client-typescript/package.json` (under `dist/`).

Operations hang off the client instance; the exact namespaces and signatures live in the types. Let editor autocomplete and the `.d.ts` drive the call shape rather than memorized examples.

## Usage patterns

- **Construct once, reuse.** Create a single `Glean` client configured with your API token and instance / server URL, and pass it around. Don't build one per request.
- **Authentication.** Supply the API token and the Glean instance (or full server URL) at construction. Read the constructor's options type for the exact field names.
- **Pagination.** List endpoints are cursor-based: pass the cursor from the previous response on the next call and stop when none is returned. Don't assume offset paging.
- **Errors.** Failures throw typed errors. Catch them and inspect the typed fields instead of parsing message strings.

## Common mistakes

- **Guessing method names or parameter shapes.** They are generated — read the `.d.ts`. Hallucinated method names are the most common failure.
- **Scattering the instance / server URL** across the codebase instead of centralizing it in client construction.
- **Ignoring pagination cursors** and treating the first page as the full result set.
- **Catch-and-stringify error handling** instead of using the typed error fields.

## Version notes

Check the installed version with `npm ls @gleanwork/api-client-typescript` or by reading `package.json`. The SDK is generated and tracks the Glean API; after an upgrade, re-read the types for changed signatures rather than trusting older examples, and consult the repo's CHANGELOG for breaking changes.
