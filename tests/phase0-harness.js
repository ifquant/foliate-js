import { EPUB } from '../epub.js'
import { createBackendController } from '../perf/backend-controller.js'
import { createPhaseTracker } from '../perf/phase-tracker.js'
import { createMemoryEPUBFixture } from './epub-fixture.js'
import { makeBook } from '../view.js'

const formatDuration = event => event.duration?.toFixed(2) ?? '0.00'

const createFixture = () => {
    const fixture = createMemoryEPUBFixture()
    return {
        ...fixture,
        sha1: async data => {
            const hash = await crypto.subtle.digest('SHA-1', data)
            return new Uint8Array(hash)
        },
    }
}

const createText = value => document.createTextNode(value)

const summarize = tracker => {
    const rows = tracker.snapshot()
        .filter(event => event.type === 'measure')
        .map(event => `${event.name}: ${formatDuration(event)}ms (${event.status})`)
    return rows.join('\n')
}

const renderBackendStates = controller => controller.states
    .map(state => `${state.backend} -> ${state.state}`)
    .join('\n')

const openWithBackend = async backend => {
    const tracker = createPhaseTracker({ enabled: true })
    const controller = createBackendController({ tracker })
    const fixture = createFixture()
    const load = async selected => {
        if (selected === 'wasm') throw new Error('Phase 0 uses JS fallback only')
        const book = new EPUB({
            ...fixture,
            perf: { tracker, backend: selected },
        })
        return tracker.time('epub:init', () => book.init(), { backend: selected })
    }
    const book = await controller.run({
        primary: backend,
        fallback: 'js',
        load,
    })
    return { tracker, controller, book }
}

const openFileWithBackend = async (file, backend) => {
    const tracker = createPhaseTracker({ enabled: true })
    const controller = createBackendController({ tracker })
    const load = async selected => {
        if (selected === 'wasm') throw new Error('Phase 0 uses JS fallback only')
        return tracker.time('makeBook', () => makeBook(file, {
            perf: { tracker, backend: selected },
        }), {
            backend: selected,
            name: file.name,
            size: file.size,
        })
    }
    const book = await controller.run({
        primary: backend,
        fallback: 'js',
        load,
    })
    return { tracker, controller, book }
}

const addBlock = (root, title, content) => {
    const section = document.createElement('section')
    const heading = document.createElement('h2')
    heading.textContent = title
    const pre = document.createElement('pre')
    pre.textContent = content
    section.append(heading, pre)
    root.append(section)
}

const renderBookSummary = book => JSON.stringify({
    title: book.metadata?.title,
    sections: book.sections?.length,
    toc: book.toc?.length ?? 0,
    rendition: book.rendition?.layout ?? 'reflowable',
}, null, 2)

const run = async root => {
    root.textContent = ''
    const js = await openWithBackend('js')
    const fallback = await openWithBackend('wasm')
    addBlock(root, 'JS backend phases', summarize(js.tracker))
    addBlock(root, 'JS backend states', renderBackendStates(js.controller))
    addBlock(root, 'WASM fallback phases', summarize(fallback.tracker))
    addBlock(root, 'WASM fallback states', renderBackendStates(fallback.controller))
    addBlock(root, 'EPUB metadata check', renderBookSummary(js.book))
}

const runFile = async (file, root) => {
    root.textContent = ''
    const js = await openFileWithBackend(file, 'js')
    const fallback = await openFileWithBackend(file, 'wasm')
    addBlock(root, `Real file phases (${file.name})`, summarize(js.tracker))
    addBlock(root, `Real file states (${file.name})`, renderBackendStates(js.controller))
    addBlock(root, `Real file fallback phases (${file.name})`, summarize(fallback.tracker))
    addBlock(root, `Real file fallback states (${file.name})`, renderBackendStates(fallback.controller))
    addBlock(root, `Real file summary (${file.name})`, renderBookSummary(js.book))
}

export const mountPhase0Harness = target => {
    const controls = document.createElement('section')
    const button = document.createElement('button')
    button.textContent = 'Run Memory Fixture Harness'
    const fileLabel = document.createElement('label')
    fileLabel.append(createText('Select a real EPUB/PDF for manual perf runs: '))
    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.accept = '.epub,.pdf'
    fileLabel.append(fileInput)
    const hint = document.createElement('p')
    hint.textContent =
        'Suggested manual sample: choose a real EPUB or PDF that exposes a slow path'
    const output = document.createElement('div')
    controls.append(button, fileLabel, hint)
    button.addEventListener('click', () => run(output).catch(error => {
        addBlock(output, 'Error', error instanceof Error ? error.stack : String(error))
    }))
    fileInput.addEventListener('change', () => {
        const [file] = fileInput.files ?? []
        if (!file) return
        runFile(file, output).catch(error => {
            addBlock(output, 'Error', error instanceof Error ? error.stack : String(error))
        })
    })
    target.append(controls, output)
}
