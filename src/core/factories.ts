import type { AbortInterface, AbortOptions } from './types.js'
import { Abort } from './Abort.js'

/**
 * Create a cancellation handle — a thin, traceable wrapper over a native
 * `AbortController` whose `signal` can be linked to a parent signal.
 *
 * @remarks
 * The created handle's `signal` fires when its own `abort()` is called; when
 * `options.signal` is given, it ALSO fires when that parent signal aborts (linked
 * via `AbortSignal.any`). Pass `options.id` to label the handle for tracing, or
 * let it default to a random UUID.
 *
 * @param options - Optional `id` (a trace label; defaults to a random UUID) and
 *   `signal` (a parent signal whose abort also fires the created handle's signal)
 * @returns A working {@link AbortInterface}
 *
 * @example
 * ```ts
 * import { createAbort } from '@src/core'
 *
 * const abort = createAbort()
 * const work = fetch(url, { signal: abort.signal })
 * abort.abort() // cancels the fetch via the linked native signal
 * ```
 *
 * @example
 * ```ts
 * // Link to a parent so a parent cancellation also aborts the child.
 * const parent = createAbort()
 * const child = createAbort({ signal: parent.signal })
 * parent.abort() // child.aborted is now true
 * ```
 */
export function createAbort(options?: AbortOptions): AbortInterface {
	return new Abort(options)
}
