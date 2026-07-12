import type { AbortInterface, AbortOptions } from './types.js'
import { isString } from '@orkestrel/contract'
import { linkSignal } from './helpers.js'

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
	readonly #controller = new AbortController()
	readonly id: string
	readonly signal: AbortSignal

	// Construction is the defensive JS-boundary (AGENTS §14): `options?.id` is guarded
	// with `isString` here so a malformed options bag falls back to a fresh id rather
	// than adopting a non-string value. `abort(reason)` stays dependency-free and
	// forwards any reason verbatim — a documented invariant, never guarded.
	constructor(options?: AbortOptions) {
		this.id = isString(options?.id) ? options.id : crypto.randomUUID()
		this.signal = linkSignal(this.#controller.signal, options?.signal)
	}

	get aborted(): boolean {
		return this.signal.aborted
	}

	abort(reason?: unknown): void {
		this.#controller.abort(reason)
	}
}
