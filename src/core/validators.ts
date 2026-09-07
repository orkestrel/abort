/**
 * Determines whether a value is a native `AbortSignal`, staying total for structural spoofs
 * and for hostile or revoked proxies.
 *
 * @remarks
 * The platform `AbortSignal.prototype.aborted` getter performs the native brand
 * check, and `Reflect.apply` calls it inside a contained boundary.
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
