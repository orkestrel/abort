/**
 * Options for `createAbort` and `Abort` construction.
 *
 * @remarks
 * `id` labels the handle for tracing; when omitted or `undefined`, a UUID is
 * generated. `signal` links a native parent signal to the handle's own signal.
 * Provided options, ids, and signals are validated at the JavaScript boundary.
 */
export interface AbortOptions {
	readonly id?: string
	/** A parent signal — the created abort's `signal` also fires when this aborts. */
	readonly signal?: AbortSignal
}

/**
 * A cancellation handle — a thin, traceable wrapper over a native
 * `AbortController` whose `signal` can be linked to a parent signal.
 *
 * @remarks
 * The native `signal` is the complete interoperable observation surface.
 */
export interface AbortInterface {
	/** The trace label for this handle — caller-supplied, or a generated UUID. */
	readonly id: string
	/** The observable signal — the handle's own, or one linked to a parent signal. */
	readonly signal: AbortSignal
	/** Whether `signal` has aborted. */
	readonly aborted: boolean
	/**
	 * Aborts the handle, firing `signal`. Aborting is idempotent — the first reason sticks.
	 *
	 * @param reason - The abort reason. A defined reason is kept verbatim (including a falsy
	 *   `null`, `0`, `''`, or `false`); `undefined` defaults `signal.reason` to an `AbortError`
	 *   `DOMException`.
	 */
	abort(reason?: unknown): void
}
