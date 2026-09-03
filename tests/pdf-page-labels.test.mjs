import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'pdf.js'), 'utf8');
const implementation = source.match(/const makeTOCItem[\s\S]*?\nexport const makePDF[\s\S]*?\n}/)?.[0];

const loadMakePDF = pdf => {
    assert.ok(implementation, 'pdf.js must expose makePDF with its PDF navigation helpers');
    class PDFDataRangeTransport {
        constructor() {}
    }
    const pdfjsLib = {
        PDFDataRangeTransport,
        getDocument: () => ({ promise: pdf }),
    };
    return Function('pdfjsLib', 'pdfjsPath',
        `${implementation.replace('export const makePDF', 'const makePDF')}; return makePDF`)(
        pdfjsLib, path => `/vendor/pdfjs/${path}`);
};

const createPDF = ({ labels, labelsError = false } = {}) => ({
    numPages: 3,
    getPage: async () => ({ getViewport: () => ({ width: 600, height: 800 }) }),
    getMetadata: async () => ({}),
    getOutline: async () => null,
    getPageLabels: labelsError
        ? async () => { throw new Error('missing page labels'); }
        : async () => labels,
    getPageIndex: async () => { throw new Error('numeric page href must not resolve a PDF destination'); },
    getDestination: async () => { throw new Error('numeric page href must not resolve a named destination'); },
    destroy() {},
});

const open = async pdf => loadMakePDF(pdf)({
    size: 0,
    slice: () => ({ arrayBuffer: async () => new ArrayBuffer(0) }),
});

test('makePDF uses only meaningful page labels and tolerates label lookup failures', async () => {
    const meaningful = await open(createPDF({ labels: ['Cover', 'i', '1'] }));
    assert.deepEqual(meaningful.pageList, [
        { label: 'Cover', href: '0', index: 0 },
        { label: 'i', href: '1', index: 1 },
        { label: '1', href: '2', index: 2 },
    ]);

    assert.equal((await open(createPDF({ labels: ['', null, ''] }))).pageList, null);
    assert.equal((await open(createPDF({ labels: ['1', '2', '3'] }))).pageList, null);
    assert.equal((await open(createPDF({ labelsError: true }))).pageList, null);
});

test('makePDF resolves numeric page-list hrefs without treating them as PDF destinations', async () => {
    const book = await open(createPDF({ labels: ['Cover', 'i', '1'] }));

    assert.deepEqual(await book.resolveHref('2'), { index: 2 });
    assert.deepEqual(await book.splitTOCHref('1'), [1, null]);
});
