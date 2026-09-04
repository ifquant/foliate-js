import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { BlobWriter, TextReader, ZipWriter } from '@zip.js/zip.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = fs.readFileSync(path.join(root, 'view.js'), 'utf8')
const implementation = source.match(/const makeZipLoader = async file => \{[\s\S]*?\n\}/)?.[0]

const makeZipLoader = () => {
    assert.ok(implementation, 'view.js must retain its ZIP loader')
    return Function('loadZip', `${implementation.replace(
        "await import('./vendor/zip.js')", 'await loadZip()')}; return makeZipLoader`)(
        () => import('../vendor/zip.js'))
}

const makeZipFile = async (entries, name = 'fixture.cbz') => {
    const writer = new ZipWriter(new BlobWriter())
    for (const [filename, contents] of entries)
        await writer.add(filename, new TextReader(contents))
    return new File([await writer.close()], name, {
        type: 'application/vnd.comicbook+zip',
    })
}

const corruptLocalHeaderType = async file => {
    const bytes = new Uint8Array(await file.arrayBuffer())
    assert.deepEqual(Array.from(bytes.slice(0, 3)), [0x50, 0x4b, 0x03])
    bytes[3] = 0x02
    return new File([bytes], file.name, { type: file.type })
}

globalThis.NodeFilter ??= { SHOW_ELEMENT: 1, SHOW_TEXT: 4 }
globalThis.HTMLElement ??= class {}
globalThis.customElements ??= { define() {} }
const { makeBook, UnsupportedTypeError } = await import('../view.js')

test('makeBook reads a ZIP entry behind a malformed local-header type byte', async () => {
    const file = await corruptLocalHeaderType(await makeZipFile([
        ['page.jpg', 'image'],
    ]))

    const book = await makeBook(file)
    const page = await book.sections[0].load()
    assert.match(page, /^blob:/)
    book.destroy()
})

test('makeBook rejects ordinary non-ZIP input', async () => {
    await assert.rejects(
        makeBook(new File([new Uint8Array([0, 1, 2, 3])], 'not-a-book.cbz', {
            type: 'application/vnd.comicbook+zip',
        })),
        UnsupportedTypeError)
})

test('ZIP loader preserves an exact-case entry when case-fold alternatives exist', async () => {
    const loader = makeZipLoader()
    const exact = await loader(await makeZipFile([
        ['OPS/Chapter.xhtml', 'exact'],
        ['ops/chapter.xhtml', 'fallback'],
    ]))
    assert.equal(await exact.loadText('OPS/Chapter.xhtml'), 'exact')
})

test('ZIP loader falls back to a unique case-insensitive entry', async () => {
    const loader = makeZipLoader()
    const unique = await loader(await makeZipFile([
        ['OPS/Chapter.xhtml', 'unique'],
    ]))
    assert.equal(await unique.loadText('ops/chapter.xhtml'), 'unique')
})

test('ZIP loader does not choose an arbitrary case-fold collision', async () => {
    const loader = makeZipLoader()
    const collision = await loader(await makeZipFile([
        ['OPS/Chapter.xhtml', 'first'],
        ['ops/chapter.xhtml', 'second'],
    ]))
    assert.equal(await collision.loadText('oPs/cHAPTER.xhtml'), null)
})

test('ZIP loader returns null for a missing lookup key', async () => {
    const loader = makeZipLoader()
    const zip = await loader(await makeZipFile([
        ['OPS/Chapter.xhtml', 'chapter'],
    ]))
    assert.equal(await zip.loadText(undefined), null)
})
