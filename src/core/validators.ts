/**
 * Determines whether a value is a native `AbortSignal`.
 *
 * @remarks
 * The platform `AbortSignal.prototype.aborted` getter performs the native brand
 * check. Calling it through `Reflect.apply` rejects structural spoofs while
 * the contained boundary keeps the guard total for hostile or revoked proxies.
 *
 * @param value - The value to inspect.
 * @returns True if the platform getter accepts `value` as an
 *   `AbortSignal`; false otherwise.
 *
 * @example
 * ```ts
 * import { isAbortSignal } from '@orkestrel/abort'
 *
 * isAbortSignal(new AbortController().signal) // true
 * isAbortSignal({ aborted: false }) // false
 * ```
 */
export function isAbortSignal(value: unknown): value is AbortSignal {
	try {
		const getter = Object.getOwnPropertyDescriptor(AbortSignal.prototype, 'aborted')?.get
		if (getter === undefined) return false
		Reflect.apply(getter, value, [])
		return true
	} catch {
		return false
	}
}
