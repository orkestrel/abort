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
	readonly id: string
	readonly signal: AbortSignal
	readonly aborted: boolean
	abort(reason?: unknown): void
}
