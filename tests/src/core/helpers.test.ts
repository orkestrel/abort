import type { AbortOptions } from '@src/core'
import { isContractError, preview } from '@orkestrel/contract'
import { linkSignal, validateAbortOptions } from '@src/core'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { createRecorder } from '../../setup.js'

let reads: PropertyKey[] = []

const handler: ProxyHandler<AbortOptions> = {
	get(target, property, receiver) {
		reads.push(property)
		return Reflect.get(target, property, receiver)
	},
}

describe('validateAbortOptions', () => {
	it('normalizes omitted options to a fresh empty object', () => {
		const first = validateAbortOptions()
		const second = validateAbortOptions()

		expect(first).toEqual({})
		expect(second).toEqual({})
		expect(first).not.toBe(second)
	})

	it('returns a fresh copy and omits absent optional keys', () => {
		const input: AbortOptions = {}
		const output = validateAbortOptions(input)

		expect(output).not.toBe(input)
		expect(output).toEqual({})
		expect(Object.keys(output)).toEqual([])
	})

	it('preserves present optional keys in a fresh copy', () => {
		const signal = new AbortController().signal
		const input: AbortOptions = { id: '', signal }
		const output = validateAbortOptions(input)

		expect(output).not.toBe(input)
		expect(output).toEqual(input)
		expect(Object.keys(output)).toEqual(['id', 'signal'])
	})

	it('reads each declared property exactly once', () => {
		reads = []
		const input = new Proxy<AbortOptions>(
			{ id: 'request', signal: new AbortController().signal },
			handler,
		)

		const output = validateAbortOptions(input)

		expect(output.id).toBe('request')
		expect(reads).toEqual(['id', 'signal'])
	})

	it('contains a hostile getter and preserves its cause', () => {
		const descriptor = Object.getOwnPropertyDescriptor(AbortSignal.prototype, 'aborted')
		if (descriptor === undefined) throw new Error('Expected the native aborted descriptor')
		const input = {}
		Object.defineProperty(input, 'id', descriptor)
		let error: unknown

		try {
			Reflect.apply(validateAbortOptions, undefined, [input])
		} catch (caught) {
			error = caught
		}

		expect(isContractError(error)).toBe(true)
		if (!isContractError(error)) throw new Error('Expected a ContractError')
		expect(error.code).toBe('bound')
		expect(error.context).toEqual({
			path: ['options'],
			limit: 'readable plain record',
			received: 'object',
		})
		expect(error.cause instanceof TypeError).toBe(true)
	})

	it.each([
		['options', null, 'bound', ['options'], 'plain record or undefined', preview(null)],
		['id', { id: 7 }, 'literal', ['options', 'id'], 'string or undefined', '7'],
		[
			'signal',
			{ signal: { aborted: false } },
			'placement',
			['options', 'signal'],
			'native AbortSignal or undefined',
			'object',
		],
	])(
		'rejects invalid %s with exact contract context',
		(_field, input, code, path, limit, received) => {
			let error: unknown
			try {
				Reflect.apply(validateAbortOptions, undefined, [input])
			} catch (caught) {
				error = caught
			}

			expect(isContractError(error)).toBe(true)
			if (!isContractError(error)) throw new Error('Expected a ContractError')
			expect(error.code).toBe(code)
			expect(error.context).toEqual({ path, limit, received })
		},
	)

	it('preserves the public options type', () => {
		expectTypeOf(validateAbortOptions).returns.toEqualTypeOf<AbortOptions>()
	})
})

describe('linkSignal', () => {
	it('returns the own signal unchanged when parent is undefined', () => {
		const controller = new AbortController()

		expect(linkSignal(controller.signal, undefined)).toBe(controller.signal)
	})

	it('a born-aborted parent makes the result immediately aborted with its reason', () => {
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

		const reason = new Error('parent cancelled')
		parent.abort(reason)

		expect(linked.aborted).toBe(true)
		expect(linked.reason).toBe(reason)
		expect(fired.count).toBe(1)
	})

	it('the own signal aborting fires the result without touching the parent', () => {
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

	it('rejects a non-native own signal with exact placement context', () => {
		const own = { aborted: false }
		let error: unknown
		try {
			Reflect.apply(linkSignal, undefined, [own, undefined])
		} catch (caught) {
			error = caught
		}

		expect(isContractError(error)).toBe(true)
		if (!isContractError(error)) throw new Error('Expected a ContractError')
		expect(error.code).toBe('placement')
		expect(error.context).toEqual({
			path: ['own'],
			limit: 'native AbortSignal',
			received: preview(own),
		})
	})

	it('rejects a non-native parent signal with exact placement context', () => {
		const own = new AbortController()
		const parent = { aborted: false }
		let error: unknown
		try {
			Reflect.apply(linkSignal, undefined, [own.signal, parent])
		} catch (caught) {
			error = caught
		}

		expect(isContractError(error)).toBe(true)
		if (!isContractError(error)) throw new Error('Expected a ContractError')
		expect(error.code).toBe('placement')
		expect(error.context).toEqual({
			path: ['parent'],
			limit: 'native AbortSignal or undefined',
			received: preview(parent),
		})
	})
})
