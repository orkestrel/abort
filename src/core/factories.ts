import type { AbortInterface, AbortOptions } from './types.js'
import { Abort } from './Abort.js'

/**
 * Creates a cancellation handle from validated options and returns it as an
 * {@link AbortInterface} — a resolved trace `id` and a `signal` already linked to any
 * parent given, so a caller holds the published contract rather than the `Abort` class.
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
 * @example Create and abort
 * ```ts
 * import { createAbort } from '@orkestrel/abort'
 *
 * const abort = createAbort()
 * const stream = openStream({ signal: abort.signal })
 * // later, to cancel:
 * abort.abort('user navigated away') // signal.reason carries the value
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
