import type { AbortOptions } from './types.js'
import { ContractError, isRecord, isString, preview } from '@orkestrel/contract'
import { isAbortSignal } from './validators.js'

/**
 * Validate and normalize abort construction options.
 *
 * @remarks
 * Omitted options normalize to a fresh empty object. Otherwise each property is
 * read exactly once before validation. The returned object is a fresh copy and
 * omits absent optional properties. No controller or signal composition begins
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
	if (!isRecord(options)) {
		throw new ContractError('Abort: options must be a plain record when defined', {
			code: 'bound',
			context: {
				path: ['options'],
				limit: 'plain record or undefined',
				received: preview(options),
			},
		})
	}

	const input: AbortOptions = options
	let id: AbortOptions['id']
	let signal: AbortOptions['signal']
	try {
		id = input.id
		signal = input.signal
	} catch (cause) {
		throw new ContractError('Abort: options could not be read', {
			code: 'bound',
			context: {
				path: ['options'],
				limit: 'readable plain record',
				received: preview(options),
			},
			cause,
		})
	}

	if (id !== undefined && !isString(id)) {
		throw new ContractError('Abort: id must be a string when defined', {
			code: 'literal',
			context: {
				path: ['options', 'id'],
				limit: 'string or undefined',
				received: preview(id),
			},
		})
	}
	if (signal !== undefined && !isAbortSignal(signal)) {
		throw new ContractError('Abort: signal must be a native AbortSignal when defined', {
			code: 'placement',
			context: {
				path: ['options', 'signal'],
				limit: 'native AbortSignal or undefined',
				received: preview(signal),
			},
		})
	}

	if (id !== undefined && signal !== undefined) return { id, signal }
	if (id !== undefined) return { id }
	if (signal !== undefined) return { signal }
	return {}
}

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
	if (!isAbortSignal(own)) {
		throw new ContractError('linkSignal own value must be an AbortSignal', {
			code: 'placement',
			context: {
				path: ['own'],
				limit: 'native AbortSignal',
				received: preview(own),
			},
		})
	}
	if (parent !== undefined && !isAbortSignal(parent)) {
		throw new ContractError('linkSignal parent value must be an AbortSignal', {
			code: 'placement',
			context: {
				path: ['parent'],
				limit: 'native AbortSignal or undefined',
				received: preview(parent),
			},
		})
	}

	return parent === undefined ? own : AbortSignal.any([own, parent])
}
