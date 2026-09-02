import type { AbortInterface, AbortOptions } from './types.js'
import { linkSignal, validateAbortOptions } from './helpers.js'

/**
 * Represents a cancellation handle — a thin, traceable wrapper over a native
 * `AbortController` whose exposed `signal` can be linked to a parent signal.
 *
 * @remarks
 * - **Own controller.** The instance owns a private `AbortController`; `abort`
 *   aborts it, and `aborted` reads the exposed signal. `abort(reason)` keeps any
 *   DEFINED reason verbatim (including a falsy `null` / `0` / `''` / `false`);
 *   `abort()` / `abort(undefined)` defaults `signal.reason` to an `AbortError`
 *   `DOMException`. Aborting is idempotent — the first reason sticks.
 * - **Parent linking.** When `options.signal` is given, the exposed `signal` is
 *   `AbortSignal.any([own, parent])`, so it fires on EITHER the own `abort()` or
 *   the parent aborting — without re-implementing listener wiring. A parent that
 *   has ALREADY aborted makes the handle born aborted (carrying the parent's reason).
 * - **Traceable.** Each handle carries an `id` (caller-supplied or a random UUID)
 *   for correlating cancellations across the system.
 * - **Native observation.** The standard `AbortSignal` is the complete
 *   interoperable observation surface.
 *
 * @example
 * ```ts
 * const abort = new Abort()
 * abort.signal.addEventListener('abort', () => stop(), { once: true })
 * abort.abort('cancelled') // flips `aborted`, fires `signal` with the reason
 * ```
 */
export class Abort implements AbortInterface {
	readonly #controller: AbortController
	readonly id: string
	readonly signal: AbortSignal

	/**
	 * Creates a cancellation handle.
	 *
	 * @param options - Optional trace id and native parent signal.
	 * @throws {@link import('@orkestrel/contract').ContractError} When provided options are not a plain record, a
	 *   defined `id` is not a string, or a defined `signal` is not a native
	 *   `AbortSignal`.
	 */
	constructor(options?: AbortOptions) {
		const input = validateAbortOptions(options)
		this.#controller = new AbortController()
		this.id = input.id ?? crypto.randomUUID()
		this.signal = linkSignal(this.#controller.signal, input.signal)
	}

	get aborted(): boolean {
		return this.signal.aborted
	}

	abort(reason?: unknown): void {
		this.#controller.abort(reason)
	}
}
