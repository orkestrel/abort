# @orkestrel/abort

> The cancellation primitive: a thin, traceable wrapper over a native `AbortController` that
> carries a trace `id`, exposes a standard `AbortSignal`, and links to a parent signal so one
> cancellation cascades through a tree of handles.

Async work — a fetch, a timeout, a queue task — links into one handle to observe
cancellation: hand `abort.signal` to anything that already accepts an
`AbortSignal`, call `abort()` to cancel, and pass a parent `signal` to cascade one
cancellation across every linked handle. Part of the `@orkestrel` line.

## Install

```sh
npm install @orkestrel/abort
```

## Requirements

- Node.js >= 22.12.0, matching the `engines` field in `package.json`
- ESM and CommonJS entry points, selected by the `exports` field in `package.json`

## Usage

```ts
import { createAbort } from '@orkestrel/abort'

const abort = createAbort()
const work = fetch(url, { signal: abort.signal })
abort.abort() // cancels the fetch through the native signal

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

Construction is a strict JavaScript boundary. `validateAbortOptions` exposes
the same once-read validation as a public helper, returning a fresh normalized
copy without absent optional keys. Malformed or unreadable options, nonstring
ids, and nonnative option signals throw structured `ContractError`s before a
controller or linked signal is created.

## Guide

For the full surface — the `Abort` class, `AbortInterface`, and the
parent-linking contract — see
[`guides/abort.md`](guides/abort.md).

## Package

Published as a single typed entry point per the `exports` field in
`package.json`.

## License

MIT © [Orkestrel](https://github.com/orkestrel) — see [LICENSE](./LICENSE).
