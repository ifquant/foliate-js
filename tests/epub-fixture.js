const encoder = new TextEncoder()

const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OPS/package.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`

const packageOpf = `<?xml version="1.0" encoding="UTF-8"?>
<package version="3.0" unique-identifier="bookid"
    xmlns="http://www.idpf.org/2007/opf">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">fixture-book</dc:identifier>
    <dc:title>Fixture Book</dc:title>
    <dc:language>en</dc:language>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="chapter1" href="chapter.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="chapter1"/>
  </spine>
</package>`

const navDocument = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"
    xmlns:epub="http://www.idpf.org/2007/ops">
  <head><title>Nav</title></head>
  <body>
    <nav epub:type="toc">
      <h1>Contents</h1>
      <ol>
        <li><a href="chapter.xhtml">Chapter 1</a></li>
      </ol>
    </nav>
  </body>
</html>`

const chapterDocument = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head><title>Chapter 1</title></head>
  <body>
    <section id="start">
      <h1>Chapter 1</h1>
      <p>Alpha &nbsp; beta &mdash; gamma.</p>
    </section>
  </body>
</html>`

export const createMemoryEPUBFixture = () => {
    const files = new Map([
        ['META-INF/container.xml', containerXml],
        ['OPS/package.opf', packageOpf],
        ['OPS/nav.xhtml', navDocument],
        ['OPS/chapter.xhtml', chapterDocument],
    ])
    const loadText = async path => files.get(path) ?? null
    const loadBlob = async path => {
        const value = files.get(path)
        return value == null ? null : new Blob([encoder.encode(value)], {
            type: path.endsWith('.opf') || path.endsWith('.xml')
                ? 'application/xml'
                : 'application/xhtml+xml',
        })
    }
    const getSize = path => {
        const value = files.get(path)
        return value == null ? 0 : encoder.encode(value).byteLength
    }
    const entries = Array.from(files.keys(), filename => ({ filename }))
    return { entries, loadText, loadBlob, getSize }
}
