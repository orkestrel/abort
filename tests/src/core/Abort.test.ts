import type { AbortInterface } from '@src/core'
import { Abort, createAbort } from '@src/core'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { createRecorder } from '../../setup.js'

// Abort — a thin traceable wrapper over a native AbortController, with optional
// parent-signal linking. Real signals, no mocks (AGENTS §16); aborting is
// synchronous so no timers are needed here.

describe('Abort', () => {
	it('a fresh abort is not aborted', () => {
		const abort = new Abort()

		expect(abort.aborted).toBe(false)
		expect(abort.signal.aborted).toBe(false)
	})

	it('abort() flips aborted and fires signal', () => {
		const abort = new Abort()
		const fired = createRecorder<readonly []>()
		abort.signal.addEventListener('abort', fired.handler)

		abort.abort()

		expect(abort.aborted).toBe(true)
		expect(abort.signal.aborted).toBe(true)
		expect(fired.count).toBe(1)
	})

	it('abort(reason) propagates the reason on the signal', () => {
		const abort = new Abort()
		const reason = new Error('cancelled')

		abort.abort(reason)

		expect(abort.signal.reason).toBe(reason)
	})

	it('abort() is idempotent — a second abort(reason2) is a no-op', () => {
		const abort = new Abort()
		const first = new Error('first')
		const second = new Error('second')
		const fired = createRecorder<readonly []>()
		abort.signal.addEventListener('abort', fired.handler)

		abort.abort(first)
		abort.abort(second)

		// Already aborted — the second call neither re-fires nor overwrites the reason.
		expect(abort.signal.reason).toBe(first)
		expect(fired.count).toBe(1)
	})

	it('links a parent signal — a parent that aborts first propagates the parent reason', () => {
		const parent = new AbortController()
		const abort = new Abort({ signal: parent.signal })
		const parentReason = new Error('parent cancelled')

		parent.abort(parentReason)

		// AbortSignal.any carries the reason of whichever source fired it — here the
		// parent, so the linked handle's signal.reason is the parent's reason.
		expect(abort.aborted).toBe(true)
		expect(abort.signal.reason).toBe(parentReason)
	})

	it('links a parent signal — the abort fires when the PARENT aborts', () => {
		const parent = new AbortController()
		const abort = new Abort({ signal: parent.signal })
		const fired = createRecorder<readonly []>()
		abort.signal.addEventListener('abort', fired.handler)

		expect(abort.aborted).toBe(false)

		parent.abort()

		expect(abort.aborted).toBe(true)
		expect(fired.count).toBe(1)
	})

	it('links a parent signal — the abort still fires on its OWN abort()', () => {
		const parent = new AbortController()
		const abort = new Abort({ signal: parent.signal })

		abort.abort()

		expect(abort.aborted).toBe(true)
		expect(parent.signal.aborted).toBe(false)
	})

	it('id is honored when supplied', () => {
		const abort = new Abort({ id: 'job-1' })

		expect(abort.id).toBe('job-1')
	})

	it('id is stable across reads and unique across instances', () => {
		const abort = new Abort()
		const other = new Abort()

		expect(abort.id).toBe(abort.id)
		expect(abort.id).not.toBe(other.id)
	})

	it('default ids are unique across many instances', () => {
		// A UUID collision would silently alias two unrelated cancellations — assert
		// the default `id` is distinct across a large batch, not just a pair.
		const ids = new Set<string>()
		for (let index = 0; index < 1_000; index += 1) ids.add(new Abort().id)

		expect(ids.size).toBe(1_000)
	})

	// ── Reason-type variety on abort() ───────────────────────────────────────
	//
	// AbortController stores the reason verbatim for any DEFINED value (including
	// falsy ones), but substitutes a default `AbortError` DOMException when the
	// reason is `undefined` (or omitted). A consumer reading `signal.reason` must
	// know which case it is in — these pin every shape the task calls out.

	it('abort() with no reason yields a default AbortError DOMException, not undefined', () => {
		const abort = new Abort()

		abort.abort()

		// The platform substitutes a default reason when none is given — it is never
		// left `undefined`, so cancelled work always has something to inspect.
		expect(abort.signal.reason instanceof DOMException).toBe(true)
		expect(abort.signal.reason.name).toBe('AbortError')
	})

	it('abort(undefined) is treated as no reason — also the default AbortError', () => {
		const abort = new Abort()

		abort.abort(undefined)

		expect(abort.signal.reason instanceof DOMException).toBe(true)
		expect(abort.signal.reason.name).toBe('AbortError')
	})

	it('abort(reason) preserves a string reason by identity', () => {
		const abort = new Abort()

		abort.abort('user navigated away')

		expect(abort.signal.reason).toBe('user navigated away')
	})

	it('abort(reason) preserves an object reason by identity', () => {
		const abort = new Abort()
		const reason = { code: 'CANCELLED', detail: 'tab closed' }

		abort.abort(reason)

		expect(abort.signal.reason).toBe(reason)
	})

	it('abort(reason) preserves defined falsy reasons (null, 0, empty string, false) verbatim', () => {
		// Each DEFINED falsy value is a real reason — a naive `if (reason)` guard
		// would wrongly drop these. Object.is proves the exact value survived.
		for (const reason of [null, 0, '', false]) {
			const abort = new Abort()

			abort.abort(reason)

			expect(abort.aborted).toBe(true)
			expect(Object.is(abort.signal.reason, reason)).toBe(true)
		}
	})

	it('abort(reason) preserves NaN as the reason by identity', () => {
		const abort = new Abort()

		abort.abort(Number.NaN)

		// Object.is is the only correct identity check for NaN (=== would be false).
		expect(Object.is(abort.signal.reason, Number.NaN)).toBe(true)
	})

	it('the FIRST reason sticks even when it is a falsy 0 and a later abort passes a truthy reason', () => {
		const abort = new Abort()

		abort.abort(0)
		abort.abort('too late')

		// Idempotency must not be `if (reason)`-gated: the falsy first reason wins.
		expect(Object.is(abort.signal.reason, 0)).toBe(true)
	})

	it('triple abort() fires the signal exactly once and keeps the first reason', () => {
		const abort = new Abort()
		const first = new Error('first')
		const fired = createRecorder<readonly []>()
		abort.signal.addEventListener('abort', fired.handler)

		abort.abort(first)
		abort.abort(new Error('second'))
		abort.abort(new Error('third'))

		expect(fired.count).toBe(1)
		expect(abort.signal.reason).toBe(first)
	})

	// ── Already-aborted parent at construction ───────────────────────────────
	//
	// A child linked to a parent that has ALREADY aborted is born aborted: the
	// `AbortSignal.any` composite fires synchronously. A real production case —
	// spawning a sub-task under a request whose deadline already blew.

	it('a parent that is already aborted at construction makes the handle born aborted, carrying the parent reason', () => {
		const parent = new AbortController()
		const parentReason = new Error('parent already dead')
		parent.abort(parentReason)

		const abort = new Abort({ signal: parent.signal })

		// Born aborted — no event will ever fire (it aborted before any listener),
		// but `aborted` and `reason` already reflect the parent.
		expect(abort.aborted).toBe(true)
		expect(abort.signal.aborted).toBe(true)
		expect(abort.signal.reason).toBe(parentReason)
	})

	it('calling abort() on a handle born aborted from its parent is a safe no-op (reason unchanged)', () => {
		const parent = new AbortController()
		const parentReason = new Error('parent dead')
		parent.abort(parentReason)
		const abort = new Abort({ signal: parent.signal })

		abort.abort(new Error('own, too late'))

		// The composite already fired from the parent; the own controller's later
		// abort cannot re-fire it or overwrite the reason.
		expect(abort.aborted).toBe(true)
		expect(abort.signal.reason).toBe(parentReason)
		expect(parent.signal.aborted).toBe(true)
	})

	// ── Chained aborts (Abort whose parent is another Abort's signal) ─────────
	//
	// The real composition shape: link Aborts into a tree by passing one's `signal`
	// as another's parent. Aborting an ancestor must fan through every descendant,
	// and the ancestor's reason must propagate down the whole chain.

	it('chains two levels — aborting the grandparent fans through to the grandchild with the grandparent reason', () => {
		const grandparent = new Abort({ id: 'gp' })
		const parent = new Abort({ id: 'p', signal: grandparent.signal })
		const child = new Abort({ id: 'c', signal: parent.signal })
		const firedParent = createRecorder<readonly []>()
		const firedChild = createRecorder<readonly []>()
		parent.signal.addEventListener('abort', firedParent.handler)
		child.signal.addEventListener('abort', firedChild.handler)

		expect(child.aborted).toBe(false)
		const reason = new Error('grandparent cancelled')

		grandparent.abort(reason)

		// One abort at the root cascades through both linked levels, reason intact.
		expect(parent.aborted).toBe(true)
		expect(child.aborted).toBe(true)
		expect(parent.signal.reason).toBe(reason)
		expect(child.signal.reason).toBe(reason)
		expect(firedParent.count).toBe(1)
		expect(firedChild.count).toBe(1)
	})

	it('chains three levels — a mid-chain own abort fans down but never up', () => {
		const grandparent = new Abort()
		const parent = new Abort({ signal: grandparent.signal })
		const child = new Abort({ signal: parent.signal })

		// Abort the MIDDLE node on its own — the child (downstream) fires, the
		// grandparent (upstream) is untouched: cancellation flows down, not up.
		parent.abort('mid')

		expect(grandparent.aborted).toBe(false)
		expect(parent.aborted).toBe(true)
		expect(child.aborted).toBe(true)
		expect(child.signal.reason).toBe('mid')
	})

	it('a chained child still fires on its OWN abort without disturbing its ancestors', () => {
		const grandparent = new Abort()
		const parent = new Abort({ signal: grandparent.signal })
		const child = new Abort({ signal: parent.signal })

		child.abort('leaf cancelled')

		expect(child.aborted).toBe(true)
		expect(parent.aborted).toBe(false)
		expect(grandparent.aborted).toBe(false)
		expect(child.signal.reason).toBe('leaf cancelled')
	})

	// ── new Abort ↔ createAbort parity ───────────────────────────────────────

	it('new Abort and createAbort behave identically for parent linking and reason propagation', () => {
		const parentA = new AbortController()
		const parentB = new AbortController()
		const constructed = new Abort({ id: 'x', signal: parentA.signal })
		const created = createAbort({ id: 'x', signal: parentB.signal })

		const reason = new Error('cascade')
		parentA.abort(reason)
		parentB.abort(reason)

		expect(constructed.id).toBe(created.id)
		expect(constructed.aborted).toBe(created.aborted)
		expect(constructed.signal.reason).toBe(created.signal.reason)
	})

	// ── id guard regression (isString(options?.id)) ──────────────────────────
	//
	// The constructor guards `options?.id` with `isString`: a non-string value
	// falls back to `crypto.randomUUID()`, while an empty string IS a string and
	// is preserved verbatim (it is not "falsy therefore absent").

	it('a non-string id falls back to a generated non-empty id', () => {
		const abort = new Abort({ id: undefined })

		expect(typeof abort.id).toBe('string')
		expect(abort.id.length > 0).toBe(true)
	})

	it('an empty-string id is preserved verbatim, not replaced by a generated id', () => {
		const abort = new Abort({ id: '' })

		expect(abort.id).toBe('')
	})
})

// ── Type-level shape (positive assertions only) ────────────────────────────

describe('Abort types', () => {
	it('AbortInterface exposes id, signal, aborted, and abort()', () => {
		expectTypeOf<AbortInterface>().toHaveProperty('id').toEqualTypeOf<string>()
		expectTypeOf<AbortInterface>().toHaveProperty('signal').toEqualTypeOf<AbortSignal>()
		expectTypeOf<AbortInterface>().toHaveProperty('aborted').toEqualTypeOf<boolean>()
		expectTypeOf<AbortInterface['abort']>().toBeFunction()
	})

	it('createAbort returns an AbortInterface', () => {
		expectTypeOf(createAbort()).toEqualTypeOf<AbortInterface>()
	})
})
