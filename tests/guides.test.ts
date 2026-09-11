// The consumer-side guides-parity entry runs `@orkestrel/guide` against this
// repository's own `guides/README.md` manifest. The constants that follow are this
// package's own, as is the executed section that closes the file.

import { GuideCommand } from '@orkestrel/guide/server'
import { readInventory } from '@orkestrel/test/server'
import { createVitest } from 'vitest/node'

/** Every fence language this package's guides are allowed to use. */
const FENCE_LANGUAGES = Object.freeze(['ts'])
/** The fence language whose blocks count as worked examples. */
const EXAMPLE_LANGUAGE = 'ts'
/** The one guide this package sources, whose tagline the README pitch equals. */
const GUIDE_SPEC = 'guides/abort.md'
/** The package identity that binds its manifest, module map, and README pitch. */
const PACKAGE_NAME = '@orkestrel/abort'
/** Each import specifier this package's own guides may resolve against. */
const MODULES = Object.freeze({ [PACKAGE_NAME]: 'src/core', '@src/core': 'src/core' })
/**
 * Declarations deliberately kept out of the barrel, as `computeSymbolKey` strings.
 *
 * A class that one-class-per-file evicted from its single consumer cannot become a
 * local, so it stays exported without being public. Naming it here is what makes that
 * intentional rather than forgotten, and the assertion that follows it fails when a name
 * here stops being stranded, so the list cannot rot.
 */
const INTERNAL: readonly string[] = Object.freeze([])

await new GuideCommand({
	root: new URL('../', import.meta.url),
	patterns: ['src/**/*.ts', 'tests/**/*.ts', 'guides/*.md', '*.md', 'package.json'],
	modules: MODULES,
	languages: FENCE_LANGUAGES,
	language: EXAMPLE_LANGUAGE,
	reader: readInventory,
	runner: createVitest,
}).execute(async ({ files, report, rows }) => {
	const { isRecord, parseJSON } = await import('@orkestrel/contract')
	const { computeSymbolKey, findMissingSymbols } = await import('@orkestrel/guide')
	const { createRecorder, requireValue } = await import('@orkestrel/test')
	const barrel = await import('@src/core')
	const { Abort, createAbort } = barrel
	const { describe, expect, it } = await import('vitest')
	const own = requireValue(
		rows.find((row) => row.entry.spec === GUIDE_SPEC),
		`Missing manifest row: ${GUIDE_SPEC}`,
	)
	const manifest = parseJSON(requireValue(files['package.json'], 'Missing inventory: package.json'))
	if (!isRecord(manifest)) throw new Error('Invalid package manifest: package.json')

	it('manifest lists at least one guide', () => {
		expect(report.input).toEqual([])
		expect(rows.length).toBeGreaterThan(0)
		expect(rows.map((row) => row.entry.spec)).toContain(GUIDE_SPEC)
	})

	// The example half of the equality case is silent over an empty population: with no
	// title on either side, the comparison has no pair. This pins the population this
	// repository's own guide contributes.
	it('pairs at least one example title across the guide and the source', () => {
		expect(report.examples.titles.filter((finding) => finding.spec === GUIDE_SPEC)).toEqual([])
	})

	it('opens the README with the guide tagline', () => {
		expect(manifest.name).toBe(PACKAGE_NAME)
		expect(report.pitch).toEqual([])
	})

	for (const { entry, guide, source } of rows) {
		describe(`${entry.concept}`, () => {
			it('uses only listed fence languages', () => {
				expect(report.fences.filter((finding) => finding.spec === entry.spec)).toEqual([])
			})

			it('extracts a non-empty documented surface', () => {
				expect(guide.surface().length).toBeGreaterThan(0)
			})

			it('carries a summary for every documented and declared symbol', () => {
				expect(guide.surface().filter((symbol) => symbol.summary === undefined)).toEqual([])
				expect(source.surface().filter((symbol) => symbol.summary === undefined)).toEqual([])
			})

			it('re-exports every direct declaration that is not named internal', () => {
				const stranded = findMissingSymbols(source.exports(), source.surface())
				expect(stranded.filter((key) => !INTERNAL.includes(key))).toEqual([])
			})

			it('names no symbol internal that the barrel already exports', () => {
				const stranded = findMissingSymbols(source.exports(), source.surface())
				expect(INTERNAL.filter((key) => !stranded.includes(key))).toEqual([])
			})

			it('re-exports only direct declarations', () => {
				expect(findMissingSymbols(source.surface(), source.exports())).toEqual([])
			})

			it('documents every barrel export', () => {
				expect(findMissingSymbols(source.surface(), guide.surface())).toEqual([])
			})

			it('documents only barrel exports', () => {
				expect(findMissingSymbols(guide.surface(), source.surface())).toEqual([])
			})

			it('exposes no hidden module-scope declarations', () => {
				expect(source.hidden().map(computeSymbolKey)).toEqual([])
			})

			it('documents a populated method group', () => {
				expect(report.sections.filter((finding) => finding.spec === entry.spec)).toEqual([])
			})

			it('keeps behavioral interfaces and implementing classes in parity', () => {
				expect(report.methods.filter((finding) => finding.spec === entry.spec)).toEqual([])
				expect(report.declarations.filter((finding) => finding.spec === entry.spec)).toEqual([])
			})

			it('keeps every compared summary and example equal to its source', () => {
				expect(report.drift.filter((finding) => finding.spec === entry.spec)).toEqual([])
			})

			it('documents an example for every Surface function', () => {
				expect(report.examples.fences.filter((finding) => finding.spec === entry.spec)).toEqual([])
				expect(report.examples.functions.filter((finding) => finding.spec === entry.spec)).toEqual(
					[],
				)
			})

			it('documents an example for every method', () => {
				expect(report.examples.methods.filter((finding) => finding.spec === entry.spec)).toEqual([])
			})

			it('imports only real exports in every ```ts fence', () => {
				expect(report.imports.filter((finding) => finding.spec === entry.spec)).toEqual([])
			})

			it('resolves every relative link', () => {
				expect(report.links.filter((finding) => finding.spec === entry.spec)).toEqual([])
			})

			it('links only to test files that exist', () => {
				expect(report.tests.filter((finding) => finding.spec === entry.spec)).toEqual([])
			})
		})
	}

	describe('runtime parity', () => {
		it('publishes only the documented implementation class', () => {
			const classes: string[] = []
			for (const [name, value] of Object.entries(barrel)) {
				if (typeof value === 'function' && /^[A-Z]/.test(name)) classes.push(name)
			}
			expect(classes.sort()).toEqual(['Abort'])
			expect(own.guide.surface().some((symbol) => symbol.name === 'Abort')).toBe(true)
		})

		it('carries exactly the method its interface documents', () => {
			const names = Object.getOwnPropertyNames(Abort.prototype)
			const methods = names.filter((name) => {
				const descriptor = Object.getOwnPropertyDescriptor(Abort.prototype, name)
				return (
					name !== 'constructor' &&
					descriptor !== undefined &&
					typeof descriptor.value === 'function'
				)
			})
			const group = requireValue(
				own.guide.methods().find((entry) => entry.interface === 'AbortInterface'),
				'Missing method group: AbortInterface',
			)

			expect(methods).toEqual(group.methods.map((method) => method.name))
		})

		it('documents every prototype accessor and hides every symbol member', () => {
			const accessors = Object.getOwnPropertyNames(Abort.prototype).filter((name) => {
				const descriptor = Object.getOwnPropertyDescriptor(Abort.prototype, name)
				return descriptor !== undefined && typeof descriptor.get === 'function'
			})
			const guideText = requireValue(files[GUIDE_SPEC], `Missing file: ${GUIDE_SPEC}`)

			for (const accessor of accessors) expect(guideText).toContain(`\`${accessor}\``)
			expect(Object.getOwnPropertySymbols(Abort.prototype)).toEqual([])
		})
	})

	// The EXECUTED half. Every preceding check reads a name from guide or source text.
	// These cases run the flagship fences and assert the values their comments claim.
	describe('flagship fences', () => {
		const guideText = requireValue(files[GUIDE_SPEC], `Missing file: ${GUIDE_SPEC}`)

		it('cascades a parent abort into the child, flipping aborted and firing the signal', () => {
			const parent = createAbort({ id: 'request' })
			const child = createAbort({ id: 'sub-task', signal: parent.signal })
			const fired = createRecorder<readonly []>()
			child.signal.addEventListener('abort', fired.handler)

			parent.abort()

			expect(child.aborted).toBe(true)
			expect(fired.count).toBe(1)
		})

		it('keeps the abort reason the create-and-abort fence claims', () => {
			const abort = createAbort()

			abort.abort('user navigated away')

			expect(abort.signal.reason).toBe('user navigated away')
		})

		it('flips aborted on the handle the quick-start fence creates', () => {
			const abort = createAbort({ id: 'fetch-user' })

			abort.abort()

			expect(abort.aborted).toBe(true)
		})

		it('carries the fence lines the transcriptions copy', () => {
			expect(guideText).toContain(
				"const child = createAbort({ id: 'sub-task', signal: parent.signal })",
			)
			expect(guideText).toContain(
				'parent.abort() // child.aborted is now true; child.signal has fired',
			)
			expect(guideText).toContain(
				"abort.abort('user navigated away') // signal.reason carries the value",
			)
			expect(guideText).toContain(
				'abort.abort() // cancels the in-flight fetch through the native signal; `aborted` flips true',
			)
		})
	})
})
