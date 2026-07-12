# @orkestrel/abort

A typed **`AbortController`** wrapper — the foundational cancellation
primitive that async work (a fetch, a timeout, a queue task) links into to
observe cancellation. Deliberately small: a stable, traceable `id`, a
`signal` that can be linked to a parent signal via `AbortSignal.any` (so a
parent's abort propagates without re-implementing listener wiring), and
idempotent `abort()` that preserves whichever reason arrives first. Part of
the `@orkestrel` line.

## Install

```sh
npm install @orkestrel/abort
```

## Requirements

- Node.js >= 24
- ESM-only (no CommonJS build)

## Usage

```ts
import { createAbort } from '@orkestrel/abort'

const abort = createAbort()
const work = fetch(url, { signal: abort.signal })
abort.abort() // cancels the fetch via the native signal

// Link to a parent so a parent cancellation also aborts the child.
const parent = createAbort()
const child = createAbort({ signal: parent.signal })
parent.abort() // child.aborted is now true
```

`createAbort(options)` (or `new Abort(options)`) returns an
`AbortInterface`. Pass `options.id` to label the handle for tracing, or let
it default to a random UUID; pass `options.signal` to link the handle's
`signal` to a parent so the parent's abort also fires the child's `signal`.
Aborting is idempotent — the first reason sticks, and `abort()` with no
reason defaults to an `AbortError` `DOMException`.

## Guide

For the full surface — the `Abort` class, `AbortInterface`, and the
parent-linking contract — see
[`guides/src/abort.md`](guides/src/abort.md).

## Package

Published as a single typed entry point per the `exports` field in
`package.json`.

## License

MIT © [Orkestrel](https://github.com/orkestrel) — see [LICENSE](./LICENSE).
