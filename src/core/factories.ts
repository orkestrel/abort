import type { AbortInterface, AbortOptions } from './types.js'
import { Abort } from './Abort.js'

/**
 * Creates a cancellation handle — a thin, traceable wrapper over a native
 * `AbortController` whose `signal` can be linked to a parent signal.
 *
 * @remarks
 * The created handle's `signal` fires when its own `abort()` is called; when
 * `options.signal` is given, it ALSO fires when that parent signal aborts (linked
 * through `AbortSignal.any`). Pass `options.id` to label the handle for tracing.
 * Default: a random UUID for `id`, and no parent link when `signal` is omitted.
 *
 * @param options - Optional trace id and native parent signal
 * @returns A working {@link AbortInterface}
 * @throws {@link import('@orkestrel/contract').ContractError} When provided
 *   options are not a plain record, a defined `id` is not a string, or a
 *   defined `signal` is not a native `AbortSignal`.
 *
 * @example
 * ```ts
 * import { createAbort } from '@orkestrel/abort'
 *
 * const abort = createAbort()
 * const work = fetch(url, { signal: abort.signal })
 * abort.abort() // cancels the fetch through the linked native signal
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
