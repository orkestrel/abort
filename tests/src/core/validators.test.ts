import { isAbortSignal } from '@src/core'
import { describe, expect, it } from 'vitest'

describe('isAbortSignal', () => {
	it('accepts a native AbortSignal', () => {
		expect(isAbortSignal(new AbortController().signal)).toBe(true)
	})

	it('rejects a structural spoof', () => {
		expect(isAbortSignal({ aborted: false, reason: undefined })).toBe(false)
	})

	it('returns false for a revoked proxy without throwing', () => {
		const revocable = Proxy.revocable(new AbortController().signal, {})
		revocable.revoke()

		expect(isAbortSignal(revocable.proxy)).toBe(false)
	})
})
