import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'pdf.js'), 'utf8');
const helper = source.match(/const getFontScale = doc => \{[\s\S]*?\n\}/)?.[0];

const loadFontScale = () => {
  assert.ok(helper, 'pdf.js must measure WebView text scaling before it renders the text layer');
  return Function(`${helper}; return getFontScale`)();
};

const createProbeDocument = offsetHeight => {
  let appended = null;
  let created = null;
  return {
    body: {
      append(element) {
        appended = element;
      }
    },
    createElement() {
      created = {
        style: { cssText: '' },
        textContent: '',
        offsetHeight,
        remove() {
          appended = null;
        }
      };
      return created;
    },
    get appended() {
      return appended;
    },
    get created() {
      return created;
    }
  };
};

test('PDF font-scale probe converts OS/WebView enlargement into a divisor and leaves 1.0 unchanged', () => {
  const getFontScale = loadFontScale();
  const enlarged = createProbeDocument(125);
  const defaultScale = createProbeDocument(100);
  const unavailable = createProbeDocument(0);

  assert.equal(getFontScale(enlarged), 1.25);
  assert.match(enlarged.created?.style.cssText ?? '', /text-size-adjust:none/);
  assert.equal(getFontScale(defaultScale), 1);
  assert.equal(getFontScale(unavailable), 1);
});

test('PDF text layer applies the measured font-scale divisor only after its async render', () => {
  const afterRender = source.slice(source.indexOf('await textLayer.render()'), source.indexOf('// hide "offscreen"'));

  assert.match(afterRender, /const fontScale = getFontScale\(doc\)/);
  assert.match(afterRender, /if \(fontScale !== 1\) container\.style\.setProperty\('--text-scale-factor'/);
  assert.match(afterRender, /else container\.style\.removeProperty\('--text-scale-factor'\)/);
  assert.match(afterRender, /var\(--total-scale-factor\) \* var\(--min-font-size\) \/ \$\{fontScale\}/);
});
