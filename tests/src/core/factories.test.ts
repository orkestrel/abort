import { createAbort } from '@src/core'
import { describe, expect, it } from 'vitest'
import { createRecorder } from '../../setup.js'

// The abort factory — that `createAbort` returns a working AbortInterface. Full
// behavior (parent linking, reason propagation) lives in Abort.test.ts; here we
// only assert the factory hands back a usable handle and honors id / parent signal.

describe('createAbort', () => {
	it('returns a working AbortInterface (abort → aborted + signal)', () => {
		const abort = createAbort()
		const fired = createRecorder<readonly []>()
		abort.signal.addEventListener('abort', fired.handler)

		expect(abort.aborted).toBe(false)

		abort.abort()

		expect(abort.aborted).toBe(true)
		expect(fired.count).toBe(1)
	})

	it('honors the id option', () => {
		const abort = createAbort({ id: 'task-7' })

		expect(abort.id).toBe('task-7')
	})

	it('honors a parent signal', () => {
		const parent = new AbortController()
		const abort = createAbort({ signal: parent.signal })

		parent.abort()

		expect(abort.aborted).toBe(true)
	})
})
