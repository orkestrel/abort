/** Options for `createAbort`. */
export interface AbortOptions {
	readonly id?: string
	/** A parent signal — the created abort's `signal` also fires when this aborts. */
	readonly signal?: AbortSignal
}

/**
 * A cancellation handle — a thin, traceable wrapper over a native
 * `AbortController` whose `signal` can be linked to a parent signal.
 */
export interface AbortInterface {
	readonly id: string
	readonly signal: AbortSignal
	readonly aborted: boolean
	abort(reason?: unknown): void
}
