/**
 * Link an own `AbortSignal` to an optional parent signal.
 *
 * @remarks
 * When `parent` is `undefined`, the own signal is returned unchanged. When a
 * parent is given, the result is `AbortSignal.any([own, parent])`, which fires
 * on EITHER the own signal aborting or the parent aborting — without
 * re-implementing listener wiring. A parent that has ALREADY aborted makes the
 * combined signal born aborted (carrying the parent's reason).
 *
 * @param own - The instance's own signal.
 * @param parent - An optional parent signal to link against.
 * @returns `own` unchanged when `parent` is `undefined`, otherwise
 *   `AbortSignal.any([own, parent])`.
 *
 * @example
 * ```ts
 * import { linkSignal } from '@src/core'
 *
 * const controller = new AbortController()
 * const linked = linkSignal(controller.signal, undefined) // controller.signal
 * ```
 */
export function linkSignal(own: AbortSignal, parent: AbortSignal | undefined): AbortSignal {
	return parent === undefined ? own : AbortSignal.any([own, parent])
}
