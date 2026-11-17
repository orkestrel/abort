import type { AbortOptions } from './types.js'
import { isRecord, isString, preview, readValue, refuseValue } from '@orkestrel/contract'
import { isAbortSignal } from './validators.js'

/**
 * Validates once-read abort construction options and returns a fresh normalized copy
 * omitting absent optional keys.
 *
 * @remarks
 * Omitted options normalize to a fresh empty object. Otherwise each property is
 * read exactly once before validation. No controller or signal composition begins
 * at this boundary.
 *
 * @param options - Potentially untrusted abort options
 * @returns A fresh validated `AbortOptions` object
 * @throws {@link import('@orkestrel/contract').ContractError} When the input
 *   does not satisfy `AbortOptions`
 *
 * @example
 * ```ts
 * const options = validateAbortOptions({ id: 'request' })
 * ```
 */
export function validateAbortOptions(options?: AbortOptions): AbortOptions {
	if (options === undefined) return {}
	refuseValue(options, isRecord, 'Abort', {
		path: ['options'],
		limit: 'plain record or undefined',
	})

	const input: AbortOptions = options
	const { id, signal } = readValue(() => ({ id: input.id, signal: input.signal }), 'Abort', {
		subject: 'options',
		code: 'bound',
		context: {
			path: ['options'],
			limit: 'readable plain record',
			received: preview(options),
		},
	})

	refuseValue(id, (value) => value === undefined || isString(value), 'Abort', {
		path: ['options', 'id'],
		limit: 'string or undefined',
		code: 'literal',
	})
	refuseValue(signal, (value) => value === undefined || isAbortSignal(value), 'Abort', {
		path: ['options', 'signal'],
		limit: 'native AbortSignal or undefined',
		code: 'placement',
	})

	if (id !== undefined && signal !== undefined) return { id, signal }
	if (id !== undefined) return { id }
	if (signal !== undefined) return { signal }
	return {}
}

/**
 * Links an own `AbortSignal` to an optional parent signal, returning
 * `AbortSignal.any([own, parent])` when a parent is given.
 *
 * @remarks
 * When `parent` is `undefined`, the own signal is returned unchanged. The combined
 * signal fires on EITHER the own signal aborting or the parent aborting — without
 * re-implementing listener wiring. A parent that has ALREADY aborted makes the
 * combined signal born aborted (carrying the parent's reason).
 *
 * @param own - The instance's own signal.
 * @param parent - An optional parent signal to link against.
 * @returns `own` unchanged when `parent` is `undefined`, otherwise
 *   `AbortSignal.any([own, parent])`.
 * @throws {@link import('@orkestrel/contract').ContractError} When `own` or a
 *   defined `parent` is not a native `AbortSignal`.
 *
 * @example
 * ```ts
 * import { linkSignal } from '@orkestrel/abort'
 *
 * const controller = new AbortController()
 * const linked = linkSignal(controller.signal, undefined) // controller.signal
 * ```
 */
export function linkSignal(own: AbortSignal, parent: AbortSignal | undefined): AbortSignal {
	refuseValue(own, isAbortSignal, 'linkSignal', {
		path: ['own'],
		limit: 'native AbortSignal',
		code: 'placement',
	})
	refuseValue(parent, (value) => value === undefined || isAbortSignal(value), 'linkSignal', {
		path: ['parent'],
		limit: 'native AbortSignal or undefined',
		code: 'placement',
	})

	return parent === undefined ? own : AbortSignal.any([own, parent])
}
