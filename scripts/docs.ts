// ============================================================================
// scripts/docs.ts - the documentation-parity seed, run as `npm run docs`.
// ----------------------------------------------------------------------------
// With no flag it reads the guide index, compares every guide against the source
// it documents, and prints one line per disagreement. With `--to guide` or
// `--to source` it rewrites the named side through the readers and replacers
// `@orkestrel/guide` ships. The seed writes files and nothing else: it starts no
// process, formats nothing, and reads no network, so run `npm run format` after
// a write.
//
// `tests/guides.test.ts` reports the same disagreements and never writes.
// Converge the two sides here, never by weakening that gate.
//
// This entry is self-contained and imports no sibling: a target receives the
// file alone, so a module-scope declaration here has no centralized file to sit
// in. `.claude/rules/architecture.md` § Declaration placement is what permits
// that, and every declaration below stays local for the same reason.
// ============================================================================
import type { Drift, GuideInterface, GuideModule, SourceExample } from '@orkestrel/guide'
import {
	collectExamples,
	collectKeys,
	collectTitles,
	computeSymbolKey,
	createGuide,
	createSource,
	extractSourceLines,
	findDrift,
	locateComment,
	normalizeComment,
	parseManifest,
	replaceCell,
	replaceExample,
	replaceSummary,
	selectModuleKeys,
	spliceSpan,
} from '@orkestrel/guide'
import { existsSync, globSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'

/** Names the one option the seed accepts, with the two values it takes. */
const USAGE = 'usage: npm run docs [-- --to guide|--to source]'

/** Matches the files the guide readers reflect over, the same set the gate inventories. */
const INVENTORY: readonly string[] = ['src/**/*.ts', 'tests/**/*.ts', 'guides/*.md', '*.md']

/** Names the package manifest whose bare name selects this workspace's own guide. */
const MANIFEST_FILE = 'package.json'

/** Names the concept index every guide row is read from. */
const INDEX_FILE = 'guides/README.md'

/** Names the file whose blockquote pitch equals this workspace's own guide tagline. */
const README_FILE = 'README.md'

/** Names the compared pair the pitch reports under. */
const PITCH_KEY = 'pitch'

/** Pairs one indexed guide with the source it documents and the disagreements between them. */
interface Row {
	readonly spec: string
	readonly module: GuideModule
	readonly guide: GuideInterface
	readonly drift: readonly Drift[]
	readonly titles: ReadonlyMap<string, SourceExample>
	readonly summaries: ReadonlySet<string>
}

/** Holds what one direction did with one row: the lines to print and the values to tally. */
interface Outcome {
	readonly lines: readonly string[]
	readonly written: number
	readonly left: number
	readonly files: readonly string[]
}

/**
 * Reads the inventory the guide readers reflect over.
 *
 * @param root - The workspace root to read from.
 * @returns Root-relative forward-slash keys mapped to file text.
 */
function readInventory(root: string): Record<string, string> {
	const files: Record<string, string> = {}
	for (const key of globSync([...INVENTORY], { cwd: root })) {
		files[key.replaceAll('\\', '/')] = readFileSync(resolve(root, key), 'utf8')
	}
	return files
}

/**
 * Reads the workspace's own bare package name.
 *
 * @param root - The workspace root to read from.
 * @returns The name after the scope, or `undefined` when the manifest declares none.
 */
function readShortName(root: string): string | undefined {
	const path = resolve(root, MANIFEST_FILE)
	if (!existsSync(path)) return undefined
	let manifest: unknown
	try {
		manifest = JSON.parse(readFileSync(path, 'utf8'))
	} catch {
		return undefined
	}
	if (typeof manifest !== 'object' || manifest === null) return undefined
	const name: unknown = Object.getOwnPropertyDescriptor(manifest, 'name')?.value
	if (typeof name !== 'string' || name.length === 0) return undefined
	return name.slice(name.lastIndexOf('/') + 1)
}

/**
 * Renders one side of a compared pair.
 *
 * @param text - The text that side carries, or `undefined` when it carries none.
 * @returns The text as a quoted single-line literal, or `absent`.
 */
function formatSide(text: string | undefined): string {
	return text === undefined ? 'absent' : JSON.stringify(text)
}

/**
 * Renders one disagreement as a single line.
 *
 * @param spec - The guide the disagreement was found in.
 * @param drift - The disagreement, with the text each side carries.
 * @returns The spec, the key, and each side's text or `absent`.
 */
function formatDrift(spec: string, drift: Drift): string {
	return `${spec} ${drift.key}: guide ${formatSide(drift.guide)} source ${formatSide(drift.source)}`
}

/**
 * Renders one disagreement a write left standing, with why it stands.
 *
 * @param spec - The guide the disagreement was found in.
 * @param drift - The disagreement, with the text each side carries.
 * @param reason - What stopped the write.
 * @returns The disagreement's line with the reason after it.
 */
function formatLeft(spec: string, drift: Drift, reason: string): string {
	return `${formatDrift(spec, drift)}; ${reason}`
}

/**
 * Renders the pitch pair as a single line.
 *
 * @param spec - The guide whose tagline the pitch is compared with.
 * @param pitch - The README's blockquote pitch, or `undefined` when it carries none.
 * @param tagline - The guide's blockquote tagline, or `undefined` when it carries none.
 * @returns The spec, the key, and each side's text or `absent`.
 */
function formatPitch(spec: string, pitch: string | undefined, tagline: string | undefined): string {
	return `${spec} ${PITCH_KEY}: readme ${formatSide(pitch)} tagline ${formatSide(tagline)}`
}

/**
 * Collects the compared keys a guide's Surface and Methods tables carry.
 *
 * @param guide - The parsed guide.
 * @returns One key per documented symbol and per documented member.
 */
function buildSummaries(guide: GuideInterface): ReadonlySet<string> {
	const keys = new Set<string>()
	for (const symbol of guide.surface()) keys.add(computeSymbolKey(symbol))
	for (const group of guide.methods()) {
		for (const entry of group.methods) keys.add(`${group.interface}.${entry.name}`)
	}
	return keys
}

/**
 * Indexes every compared key a module's files carry to the file carrying it.
 *
 * @param files - The workspace inventory the readers reflect over.
 * @param module - The source directories the guide documents.
 * @returns Each key mapped to the first file declaring it.
 */
function buildIndex(
	files: Readonly<Record<string, string>>,
	module: GuideModule,
): ReadonlyMap<string, string> {
	const index = new Map<string, string>()
	for (const file of selectModuleKeys(files, module)) {
		const text = files[file]
		if (text === undefined) continue
		for (const key of collectKeys(extractSourceLines(text)).values()) {
			if (!index.has(key)) index.set(key, file)
		}
	}
	return index
}

/**
 * Splits a compared example text into the block a replacer writes.
 *
 * @param name - The declaration or member whose doc block carries the block.
 * @param title - The heading text the fence and the tag pair on.
 * @param text - The compared text: the language on the first line, the body beneath.
 * @returns The block, carrying no language when the first line is empty.
 */
function splitExample(name: string, title: string, text: string): SourceExample {
	const at = text.indexOf('\n')
	const language = at === -1 ? text : text.slice(0, at)
	const code = at === -1 ? '' : text.slice(at + 1)
	return language.length === 0 ? { name, title, code } : { name, title, code, language }
}

/**
 * Finds the compared key of the doc block carrying one titled example.
 *
 * @param texts - The current text of every file, keyed root-relative.
 * @param index - Each compared key mapped to the file declaring it.
 * @param name - The declaration or member the block belongs to.
 * @param title - The heading text the tag carries.
 * @returns The key `locateComment` reaches the block by, or `undefined` when none does.
 */
function findExample(
	texts: ReadonlyMap<string, string>,
	index: ReadonlyMap<string, string>,
	name: string,
	title: string,
): string | undefined {
	for (const [key, file] of index) {
		if (key !== name && !key.endsWith(` ${name}`) && !key.endsWith(`.${name}`)) continue
		const text = texts.get(file)
		if (text === undefined) continue
		const span = locateComment(text, key)
		if (span === undefined) continue
		const block = text.slice(span.start, span.end)
		if (collectExamples(normalizeComment(block), name).some((one) => one.title === title)) {
			return key
		}
	}
	return undefined
}

/**
 * Reports every disagreement one row carries, writing nothing.
 *
 * @param row - The indexed guide and its disagreements.
 * @returns One line per disagreement, each left standing.
 */
function reportRow(row: Row): Outcome {
	return {
		lines: row.drift.map((drift) => formatDrift(row.spec, drift)),
		written: 0,
		left: row.drift.length,
		files: [],
	}
}

/**
 * Carries every summary disagreement of one row across to its guide.
 *
 * @param root - The workspace root to write into.
 * @param row - The indexed guide and its disagreements.
 * @param files - The workspace inventory the readers reflect over.
 * @returns The lines left standing, the values to tally, and the file written.
 */
function writeGuide(root: string, row: Row, files: Readonly<Record<string, string>>): Outcome {
	const lines: string[] = []
	const start = files[row.spec]
	if (start === undefined) {
		return {
			lines: row.drift.map((drift) => formatDrift(row.spec, drift)),
			written: 0,
			left: row.drift.length,
			files: [],
		}
	}
	let text = start
	let written = 0
	for (const drift of row.drift) {
		if (!row.summaries.has(drift.key)) {
			lines.push(formatLeft(row.spec, drift, 'the guide fence owns an example'))
			continue
		}
		if (drift.source === undefined) {
			lines.push(formatLeft(row.spec, drift, 'the source side carries no text'))
			continue
		}
		const replaced = replaceCell(text, drift.key, drift.source)
		if (replaced === undefined) {
			lines.push(formatLeft(row.spec, drift, 'no Summary cell carries the key'))
			continue
		}
		text = replaced
		written += 1
	}
	if (text === start) return { lines, written, left: lines.length, files: [] }
	writeFileSync(resolve(root, row.spec), text)
	return { lines, written, left: lines.length, files: [row.spec] }
}

/**
 * Carries every disagreement of one row across to the source it documents.
 *
 * @param root - The workspace root to write into.
 * @param row - The indexed guide and its disagreements.
 * @param files - The workspace inventory the readers reflect over.
 * @returns The lines left standing, the values to tally, and the files written.
 */
function writeSource(root: string, row: Row, files: Readonly<Record<string, string>>): Outcome {
	const index = buildIndex(files, row.module)
	const texts = new Map<string, string>()
	for (const file of index.values()) {
		const text = files[file]
		if (text !== undefined && !texts.has(file)) texts.set(file, text)
	}
	const lines: string[] = []
	const touched = new Set<string>()
	let written = 0
	for (const drift of row.drift) {
		if (drift.guide === undefined) {
			lines.push(formatLeft(row.spec, drift, 'the guide side carries no text'))
			continue
		}
		const summary = row.summaries.has(drift.key)
		const example = row.titles.get(drift.key)
		const key = summary
			? drift.key
			: example === undefined
				? undefined
				: findExample(texts, index, example.name, drift.key)
		const file = key === undefined ? undefined : index.get(key)
		const text = file === undefined ? undefined : texts.get(file)
		if (key === undefined || file === undefined || text === undefined) {
			lines.push(formatLeft(row.spec, drift, 'no doc block carries the key'))
			continue
		}
		const span = locateComment(text, key)
		if (span === undefined) {
			lines.push(formatLeft(row.spec, drift, 'no doc block carries the key'))
			continue
		}
		const block = text.slice(span.start, span.end)
		const rewritten =
			example === undefined || summary
				? replaceSummary(block, drift.guide)
				: replaceExample(block, splitExample(example.name, drift.key, drift.guide))
		if (rewritten === undefined) {
			lines.push(formatLeft(row.spec, drift, 'the doc block refused the rewrite'))
			continue
		}
		texts.set(file, spliceSpan(text, span, rewritten))
		touched.add(file)
		written += 1
	}
	const changed: string[] = []
	for (const file of [...touched].sort()) {
		const text = texts.get(file)
		if (text === undefined || text === files[file]) continue
		writeFileSync(resolve(root, file), text)
		changed.push(file)
	}
	return { lines, written, left: lines.length, files: changed }
}

const args = process.argv.slice(2)
const direction =
	args.length === 2 && args[0] === '--to' && (args[1] === 'guide' || args[1] === 'source')
		? args[1]
		: undefined
if (direction === undefined && args.length > 0) {
	process.stdout.write(`${USAGE}\n`)
	process.exitCode = 2
} else {
	const root = process.cwd()
	const files = readInventory(root)
	const index = files[INDEX_FILE]
	if (index === undefined) throw new Error(`The workspace carries no ${INDEX_FILE} to index from`)
	const rows: Row[] = []
	for (const entry of parseManifest(index, 'guides')) {
		const markdown = files[entry.spec]
		if (markdown === undefined) {
			throw new Error(`The concept index names ${entry.spec}, which the workspace does not carry`)
		}
		const guide = createGuide(markdown)
		const source = createSource({ files, module: entry.source })
		rows.push({
			spec: entry.spec,
			module: entry.source,
			guide,
			drift: findDrift(guide, source),
			titles: collectTitles(guide, source),
			summaries: buildSummaries(guide),
		})
	}

	const lines: string[] = []
	const changed: string[] = []
	let found = 0
	let written = 0
	let left = 0
	for (const row of rows) {
		found += row.drift.length
		const outcome =
			direction === undefined
				? reportRow(row)
				: direction === 'guide'
					? writeGuide(root, row, files)
					: writeSource(root, row, files)
		lines.push(...outcome.lines)
		changed.push(...outcome.files)
		written += outcome.written
		left += outcome.left
	}

	const name = readShortName(root)
	const readme = files[README_FILE]
	const own = name === undefined ? undefined : rows.find((row) => row.spec === `guides/${name}.md`)
	if (own !== undefined && readme !== undefined) {
		const pitch = createGuide(readme).tagline()
		const tagline = own.guide.tagline()
		if (pitch !== tagline) {
			found += 1
			left += 1
			lines.push(
				direction === undefined
					? formatPitch(own.spec, pitch, tagline)
					: `${formatPitch(own.spec, pitch, tagline)}; the README pitch is authored by hand`,
			)
		}
	}

	for (const file of changed) process.stdout.write(`wrote ${file}\n`)
	for (const line of lines) process.stdout.write(`${line}\n`)
	process.stdout.write(
		direction === undefined
			? `rows read: ${rows.length}, disagreements found: ${found}\n`
			: `rows read: ${rows.length}, disagreements found: ${found}, written: ${written}, reported: ${left}\n`,
	)
	if (changed.length > 0) process.stdout.write('run npm run format\n')
	process.exitCode = left > 0 ? 1 : 0
}
