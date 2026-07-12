import { linkSignal } from '@src/core'
import { describe, expect, it } from 'vitest'
import { createRecorder } from '../../setup.js'

// linkSignal — the pure, testable leaf behind Abort's parent linking (AGENTS §5):
// combines an own AbortSignal with an optional parent via AbortSignal.any.

describe('linkSignal', () => {
	it('returns the own signal unchanged when parent is undefined', () => {
		const controller = new AbortController()

		expect(linkSignal(controller.signal, undefined)).toBe(controller.signal)
	})

	it('a born-aborted parent makes the result immediately aborted, carrying the parent reason', () => {
		const own = new AbortController()
		const parent = new AbortController()
		const reason = new Error('parent already dead')
		parent.abort(reason)

		const linked = linkSignal(own.signal, parent.signal)

		expect(linked.aborted).toBe(true)
		expect(linked.reason).toBe(reason)
	})

	it('the parent aborting later fires the linked result', () => {
		const own = new AbortController()
		const parent = new AbortController()
		const linked = linkSignal(own.signal, parent.signal)
		const fired = createRecorder<readonly []>()
		linked.addEventListener('abort', fired.handler)

		expect(linked.aborted).toBe(false)

		const reason = new Error('parent cancelled')
		parent.abort(reason)

		expect(linked.aborted).toBe(true)
		expect(linked.reason).toBe(reason)
		expect(fired.count).toBe(1)
	})

	it('the own signal aborting fires the linked result without touching the parent', () => {
		const own = new AbortController()
		const parent = new AbortController()
		const linked = linkSignal(own.signal, parent.signal)
		const fired = createRecorder<readonly []>()
		linked.addEventListener('abort', fired.handler)

		const reason = new Error('own cancelled')
		own.abort(reason)

		expect(linked.aborted).toBe(true)
		expect(linked.reason).toBe(reason)
		expect(fired.count).toBe(1)
		expect(parent.signal.aborted).toBe(false)
	})
})
