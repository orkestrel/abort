import type { AbortInterface, AbortOptions } from './types.js'

/**
 * A cancellation handle — a thin, traceable wrapper over a native
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
 * - **Event-free.** A pure functional primitive — no Emitter, no events.
 *
 * @example
 * ```ts
 * const abort = new Abort()
 * abort.signal.addEventListener('abort', () => stop(), { once: true })
 * abort.abort('cancelled') // flips `aborted`, fires `signal` with the reason
 * ```
 */
export class Abort implements AbortInterface {
	readonly id: string
	readonly signal: AbortSignal
	readonly #controller = new AbortController()

	constructor(options?: AbortOptions) {
		this.id = options?.id ?? crypto.randomUUID()
		const parent = options?.signal
		this.signal =
			parent === undefined
				? this.#controller.signal
				: AbortSignal.any([this.#controller.signal, parent])
	}

	get aborted(): boolean {
		return this.signal.aborted
	}

	abort(reason?: unknown): void {
		this.#controller.abort(reason)
	}
}
