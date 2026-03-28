import http from 'node:http'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { createReadStream, existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn, execFile as execFileCallback } from 'node:child_process'
import { promisify } from 'node:util'

const execFile = promisify(execFileCallback)

const repoRoot = process.cwd()
const workspaceRoot = path.dirname(repoRoot)
const constructStyleSheetsPolyfillPath = [
    path.join(repoRoot,
        'node_modules/construct-style-sheets-polyfill/dist/adoptedStyleSheets.js'),
    path.join(workspaceRoot,
        'readest/packages/foliate-js/node_modules/construct-style-sheets-polyfill/dist/adoptedStyleSheets.js'),
].find(candidate => existsSync(candidate))

const mimeTypes = new Map([
    ['.html', 'text/html; charset=utf-8'],
    ['.js', 'text/javascript; charset=utf-8'],
    ['.css', 'text/css; charset=utf-8'],
    ['.json', 'application/json; charset=utf-8'],
    ['.epub', 'application/epub+zip'],
    ['.pdf', 'application/pdf'],
    ['.mjs', 'text/javascript; charset=utf-8'],
])

const chromeCandidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chrome.app/Contents/MacOS/Chrome',
]

const benchmarkPath = '/tests/phase0-auto-benchmark.html'
const caseConfigs = [
    { key: 'js', backend: 'js', fallback: 'js' },
    { key: 'wasmFallback', backend: 'wasm', fallback: 'js' },
]
const builtInScenarios = {
    'open-index': {
        name: 'open-index',
        steps: [],
    },
    'continuous-reading': {
        name: 'continuous-reading',
        viewport: { width: 1200, height: 1600 },
        steps: [
            { action: 'openView' },
            { action: 'initView', showTextStart: true },
            { action: 'next', count: 3 },
            { action: 'prev', count: 1 },
            { action: 'jumpPrimary', offset: 1 },
        ],
    },
    'outline-heavy': {
        name: 'outline-heavy',
        viewport: { width: 1200, height: 1600 },
        steps: [
            { action: 'openView' },
            { action: 'initView', showTextStart: true },
            { action: 'jumpOutline', index: 0 },
            { action: 'next', count: 1 },
            { action: 'jumpSecondary' },
            { action: 'returnContext' },
        ],
    },
    'jump-and-return': {
        name: 'jump-and-return',
        viewport: { width: 1200, height: 1600 },
        steps: [
            { action: 'openView' },
            { action: 'initView', showTextStart: true },
            { action: 'jumpPrimary', offset: 1 },
            { action: 'returnContext' },
            { action: 'jumpSecondary' },
            { action: 'returnContext' },
        ],
    },
}
const scenarioDslLegend = {
    a: { action: 'openView' },
    b: { action: 'initView', showTextStart: true },
    c: { action: 'next' },
    d: { action: 'prev' },
    e: { action: 'jumpPrimary', offset: 1 },
    f: { action: 'jumpPrimary', offset: -1 },
    g: { action: 'jumpOutline', index: 0 },
    h: { action: 'jumpSecondary' },
    i: { action: 'returnContext' },
    j: { action: 'firstSectionDocument' },
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

const usage = () => {
    console.error([
        'Usage:',
        '  node scripts/run-phase0-benchmark.mjs <absolute-or-relative-file-path> [...]',
        '  node scripts/run-phase0-benchmark.mjs --samples perf/phase0-samples.local.json [--warmup 2] [--runs 10] [--trim 1] [--cases js,wasmFallback] [--turn-settle legacy|frame] [--flow scrolled] [--animated] [--eink] [--output perf/results/phase0-latest.json] [--baseline perf/results/phase0-baseline.json] [--threshold 0.15] [--max-cv 0.12] [--max-range 0.25]',
        'Scenarios:',
        '  open-index | continuous-reading | outline-heavy | jump-and-return',
    ].join('\n'))
}

const parseArgs = argv => {
    const options = {
        paths: [],
        runs: 10,
        warmupRuns: 2,
        trimCount: 1,
        threshold: 0.15,
        maxCv: 0.12,
        maxRange: 0.25,
        outputPath: null,
        baselinePath: null,
        samplesPath: null,
        scenario: 'continuous-reading',
        scenarioFile: null,
        caseKeys: caseConfigs.map(config => config.key),
        turnSettle: 'legacy',
        flow: null,
        animated: false,
        eink: false,
    }
    for (let index = 0; index < argv.length; index++) {
        const value = argv[index]
        if (value === '--samples') options.samplesPath = argv[++index] ?? null
        else if (value === '--runs') options.runs = Number.parseInt(argv[++index] ?? '', 10)
        else if (value === '--warmup') options.warmupRuns = Number.parseInt(argv[++index] ?? '', 10)
        else if (value === '--trim') options.trimCount = Number.parseInt(argv[++index] ?? '', 10)
        else if (value === '--output') options.outputPath = argv[++index] ?? null
        else if (value === '--baseline') options.baselinePath = argv[++index] ?? null
        else if (value === '--threshold') options.threshold = Number.parseFloat(argv[++index] ?? '')
        else if (value === '--max-cv') options.maxCv = Number.parseFloat(argv[++index] ?? '')
        else if (value === '--max-range') options.maxRange = Number.parseFloat(argv[++index] ?? '')
        else if (value === '--scenario') options.scenario = argv[++index] ?? null
        else if (value === '--scenario-file') options.scenarioFile = argv[++index] ?? null
        else if (value === '--turn-settle') options.turnSettle = argv[++index] ?? null
        else if (value === '--flow') options.flow = argv[++index] ?? null
        else if (value === '--animated') options.animated = true
        else if (value === '--eink') options.eink = true
        else if (value === '--cases') {
            options.caseKeys = (argv[++index] ?? '')
                .split(',')
                .map(token => token.trim())
                .filter(Boolean)
        }
        else options.paths.push(value)
    }
    return options
}

const options = parseArgs(process.argv.slice(2))
if ((!options.paths.length && !options.samplesPath)
    || !Number.isFinite(options.runs) || options.runs < 1
    || !Number.isFinite(options.warmupRuns) || options.warmupRuns < 0
    || !Number.isFinite(options.trimCount) || options.trimCount < 0
    || !Number.isFinite(options.maxCv) || options.maxCv <= 0
    || !Number.isFinite(options.maxRange) || options.maxRange <= 0
    || !['legacy', 'frame'].includes(options.turnSettle)
    || (options.flow != null && !['scrolled'].includes(options.flow))
    || !options.caseKeys.length) {
    usage()
    process.exit(1)
}

const activeCaseConfigs = options.caseKeys.map(key => {
    const matched = caseConfigs.find(config => config.key === key)
    if (!matched) {
        console.error(`Unknown benchmark case: ${key}`)
        process.exit(1)
    }
    return matched
})

const chromePath = chromeCandidates.find(candidate => existsSync(candidate))
if (!chromePath) {
    console.error('Could not find a supported Chrome binary in /Applications')
    process.exit(1)
}

if (!constructStyleSheetsPolyfillPath) {
    console.error('Could not resolve construct-style-sheets-polyfill for benchmark harness')
    process.exit(1)
}

const resolveFromRepo = candidate => path.isAbsolute(candidate)
    ? candidate
    : path.resolve(repoRoot, candidate)

const loadTargets = async () => {
    const targets = [...options.paths]
    if (options.samplesPath) {
        const configPath = resolveFromRepo(options.samplesPath)
        const parsed = JSON.parse(await readFile(configPath, 'utf8'))
        for (const entry of parsed.targets ?? []) targets.push(entry)
    }
    const deduped = [...new Set(targets.map(resolveFromRepo))]
    if (!deduped.length) {
        throw new Error('No benchmark targets resolved from CLI arguments or sample config')
    }
    return deduped
}

const loadScenario = async () => {
    const scenarios = { ...builtInScenarios }
    if (options.scenarioFile) {
        const scenarioPath = resolveFromRepo(options.scenarioFile)
        const parsed = JSON.parse(await readFile(scenarioPath, 'utf8'))
        Object.assign(scenarios, parsed)
    }
    const builtIn = scenarios[options.scenario]
    if (builtIn) return builtIn

    const dsl = options.scenario
        ?.split(',')
        .map(token => token.trim())
        .filter(Boolean)
        .join('')
        .toLowerCase()
    if (!dsl) throw new Error(`Unknown benchmark scenario: ${options.scenario}`)

    const steps = []
    for (const symbol of dsl) {
        const mapped = scenarioDslLegend[symbol]
        if (!mapped) throw new Error(`Unknown scenario symbol: ${symbol}`)
        steps.push({ ...mapped })
    }
    return {
        name: `dsl:${dsl}`,
        dsl,
        viewport: { width: 1200, height: 1600 },
        steps,
    }
}

let pendingResolve
let pendingReject
let pendingTimer

const sendFile = async (filePath, req, res) => {
    const type = mimeTypes.get(path.extname(filePath).toLowerCase()) ?? 'application/octet-stream'
    const info = await stat(filePath)
    const range = req.headers.range
    if (range) {
        const match = /^bytes=(\d+)-(\d*)$/.exec(range)
        if (!match) {
            res.writeHead(416).end()
            return
        }
        const start = Number.parseInt(match[1], 10)
        const end = match[2] ? Number.parseInt(match[2], 10) : info.size - 1
        if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || end >= info.size) {
            res.writeHead(416).end()
            return
        }
        res.writeHead(206, {
            'content-type': type,
            'content-length': end - start + 1,
            'content-range': `bytes ${start}-${end}/${info.size}`,
            'accept-ranges': 'bytes',
            'cache-control': 'no-store',
        })
        if (req.method === 'HEAD') {
            res.end()
            return
        }
        createReadStream(filePath, { start, end }).pipe(res)
        return
    }
    res.writeHead(200, {
        'content-type': type,
        'content-length': info.size,
        'accept-ranges': 'bytes',
        'cache-control': 'no-store',
    })
    if (req.method === 'HEAD') {
        res.end()
        return
    }
    createReadStream(filePath).pipe(res)
}

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1')
    if (req.method === 'POST' && url.pathname === '/__result__') {
        const chunks = []
        req.on('data', chunk => chunks.push(chunk))
        req.on('end', () => {
            try {
                const body = Buffer.concat(chunks).toString('utf8')
                const parsed = JSON.parse(body)
                clearTimeout(pendingTimer)
                pendingResolve?.(parsed)
            } catch (error) {
                pendingReject?.(error)
            }
            res.writeHead(204).end()
        })
        return
    }

    if (url.pathname === '/__sample__') {
        const samplePath = url.searchParams.get('path')
        if (!samplePath) {
            res.writeHead(400).end('missing sample path')
            return
        }
        await sendFile(samplePath, req, res)
        return
    }

    if (url.pathname === '/__deps__/construct-style-sheets-polyfill.js') {
        await sendFile(constructStyleSheetsPolyfillPath, req, res)
        return
    }

    const requested = path.join(repoRoot, url.pathname.replace(/^\/+/, ''))
    if (!requested.startsWith(repoRoot)) {
        res.writeHead(403).end('forbidden')
        return
    }
    try {
        await sendFile(requested, req, res)
    } catch {
        res.writeHead(404).end('not found')
    }
})

const waitForResult = (timeoutMs = 120000) => new Promise((resolve, reject) => {
    pendingResolve = value => {
        clearTimeout(pendingTimer)
        pendingResolve = null
        pendingReject = null
        pendingTimer = null
        resolve(value)
    }
    pendingReject = error => {
        clearTimeout(pendingTimer)
        pendingResolve = null
        pendingReject = null
        pendingTimer = null
        reject(error)
    }
    pendingTimer = setTimeout(() => {
        pendingReject?.(new Error('Benchmark timed out'))
    }, timeoutMs)
})

const waitForDevToolsPort = async (profileDir, timeoutMs = 10000) => {
    const activePortPath = path.join(profileDir, 'DevToolsActivePort')
    const deadline = Date.now() + timeoutMs
    let lastError
    while (Date.now() < deadline) {
        try {
            const contents = await readFile(activePortPath, 'utf8')
            const [portLine] = contents.trim().split('\n')
            const port = Number.parseInt(portLine ?? '', 10)
            if (Number.isFinite(port) && port > 0) return port
        } catch (error) {
            lastError = error
        }
        await sleep(100)
    }
    throw new Error(`Timed out waiting for DevToolsActivePort (${lastError?.message ?? 'unknown error'})`)
}

const waitForPageTarget = async (port, targetUrl, timeoutMs = 10000) => {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
        const response = await fetch(`http://127.0.0.1:${port}/json/list`)
        if (response.ok) {
            const targets = await response.json()
            const matched = targets.find(candidate =>
                candidate.type === 'page' && candidate.url === targetUrl)
            if (matched?.webSocketDebuggerUrl) return matched.webSocketDebuggerUrl
        }
        await sleep(100)
    }
    throw new Error('Timed out waiting for benchmark page target')
}

class CDPSession {
    constructor(wsUrl) {
        this.wsUrl = wsUrl
        this.ws = null
        this.nextId = 1
        this.pending = new Map()
    }

    async open() {
        if (typeof WebSocket !== 'function')
            throw new Error('Global WebSocket is unavailable in this Node runtime')
        await new Promise((resolve, reject) => {
            const ws = new WebSocket(this.wsUrl)
            this.ws = ws
            ws.addEventListener('open', () => resolve(), { once: true })
            ws.addEventListener('error', event => reject(event.error ?? new Error('CDP websocket open failed')), { once: true })
            ws.addEventListener('message', event => {
                try {
                    const message = JSON.parse(event.data)
                    if (!message.id) return
                    const pending = this.pending.get(message.id)
                    if (!pending) return
                    this.pending.delete(message.id)
                    if (message.error) pending.reject(new Error(message.error.message ?? 'CDP error'))
                    else pending.resolve(message.result)
                } catch (error) {
                    for (const { reject } of this.pending.values()) reject(error)
                    this.pending.clear()
                }
            })
            ws.addEventListener('close', () => {
                for (const { reject } of this.pending.values())
                    reject(new Error('CDP websocket closed'))
                this.pending.clear()
            })
        })
    }

    send(method, params = {}) {
        const id = this.nextId++
        const ws = this.ws
        if (!ws || ws.readyState !== WebSocket.OPEN)
            return Promise.reject(new Error('CDP websocket is not open'))
        ws.send(JSON.stringify({ id, method, params }))
        return new Promise((resolve, reject) => {
            this.pending.set(id, { resolve, reject })
        })
    }

    close() {
        try {
            this.ws?.close()
        } catch {}
    }
}

const parsePerformanceMetrics = metrics => {
    const values = new Map((metrics ?? []).map(entry => [entry.name, entry.value]))
    return {
        jsHeapUsedSize: values.get('JSHeapUsedSize') ?? null,
        jsHeapTotalSize: values.get('JSHeapTotalSize') ?? null,
        nodes: values.get('Nodes') ?? null,
        documents: values.get('Documents') ?? null,
        jsEventListeners: values.get('JSEventListeners') ?? null,
    }
}

const sampleProcessTreeRss = async rootPid => {
    const { stdout } = await execFile('ps', ['-axo', 'pid=,ppid=,rss='])
    const nodes = stdout
        .trim()
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => {
            const [pidText, ppidText, rssText] = line.split(/\s+/)
            return {
                pid: Number.parseInt(pidText ?? '', 10),
                ppid: Number.parseInt(ppidText ?? '', 10),
                rssKb: Number.parseInt(rssText ?? '', 10),
            }
        })
        .filter(entry => Number.isFinite(entry.pid) && Number.isFinite(entry.ppid) && Number.isFinite(entry.rssKb))
    const children = new Map()
    for (const entry of nodes) {
        const bucket = children.get(entry.ppid) ?? []
        bucket.push(entry)
        children.set(entry.ppid, bucket)
    }
    let totalRssKb = 0
    const stack = [rootPid]
    const seen = new Set()
    while (stack.length) {
        const pid = stack.pop()
        if (!Number.isFinite(pid) || seen.has(pid)) continue
        seen.add(pid)
        const current = nodes.find(entry => entry.pid === pid)
        if (current) totalRssKb += current.rssKb
        for (const child of children.get(pid) ?? []) stack.push(child.pid)
    }
    return {
        pidCount: seen.size,
        rssBytes: totalRssKb * 1024,
    }
}

const summarizeCdpSamples = (samples, failureReason = null) => {
    if (!samples.length) return {
        supported: false,
        reason: failureReason ?? 'No CDP samples collected',
        sampleCount: 0,
    }
    const first = samples[0]
    const last = samples[samples.length - 1]
    const peakJSHeapUsedSize = Math.max(...samples.map(sample => sample.jsHeapUsedSize ?? 0))
    const peakJSHeapTotalSize = Math.max(...samples.map(sample => sample.jsHeapTotalSize ?? 0))
    const peakNodes = Math.max(...samples.map(sample => sample.nodes ?? 0))
    const peakDocuments = Math.max(...samples.map(sample => sample.documents ?? 0))
    const peakJSEventListeners = Math.max(...samples.map(sample => sample.jsEventListeners ?? 0))
    return {
        supported: true,
        sampleCount: samples.length,
        start: first,
        end: last,
        startJSHeapUsedSize: first.jsHeapUsedSize ?? null,
        endJSHeapUsedSize: last.jsHeapUsedSize ?? null,
        jsHeapUsedDelta: Number.isFinite(first.jsHeapUsedSize) && Number.isFinite(last.jsHeapUsedSize)
            ? last.jsHeapUsedSize - first.jsHeapUsedSize
            : null,
        peakJSHeapUsedSize,
        peakJSHeapTotalSize,
        peakNodes,
        peakDocuments,
        peakJSEventListeners,
    }
}

const summarizeProcessTreeWindow = samples => {
    if (!samples.length) return null
    const first = samples[0]
    const last = samples[samples.length - 1]
    const peakRssBytes = Math.max(...samples.map(sample => sample.rssBytes ?? 0))
    const peakPidCount = Math.max(...samples.map(sample => sample.pidCount ?? 0))
    return {
        sampleCount: samples.length,
        start: first,
        end: last,
        startRssBytes: first.rssBytes ?? null,
        endRssBytes: last.rssBytes ?? null,
        rssDeltaBytes: Number.isFinite(first.rssBytes) && Number.isFinite(last.rssBytes)
            ? last.rssBytes - first.rssBytes
            : null,
        peakRssBytes,
        peakPidCount,
    }
}

const summarizeProcessTreeSamples = (
    samples,
    failureReason = null,
    steadyStateStartAt = null,
) => {
    if (!samples.length) return {
        supported: false,
        reason: failureReason ?? 'No process tree samples collected',
        sampleCount: 0,
    }
    const overall = summarizeProcessTreeWindow(samples)
    const steadySamples = Number.isFinite(steadyStateStartAt)
        ? samples.filter(sample => sample.at >= steadyStateStartAt)
        : samples
    const steadyState = summarizeProcessTreeWindow(steadySamples)
    const startup = Number.isFinite(steadyStateStartAt)
        ? summarizeProcessTreeWindow(samples.filter(sample => sample.at < steadyStateStartAt))
        : null
    return {
        supported: true,
        sampleCount: overall.sampleCount,
        steadyStateStartAt: Number.isFinite(steadyStateStartAt) ? steadyStateStartAt : null,
        start: overall.start,
        end: overall.end,
        startRssBytes: overall.startRssBytes,
        endRssBytes: overall.endRssBytes,
        rssDeltaBytes: overall.rssDeltaBytes,
        peakRssBytes: overall.peakRssBytes,
        peakPidCount: overall.peakPidCount,
        startup,
        steadyState,
    }
}

const startBrowserMonitoring = async ({ profileDir, browserPid, targetUrl }) => {
    let cdpSession = null
    let cdpTimer = null
    let rssTimer = null
    let cdpFailureReason = null
    let rssFailureReason = null
    let cdpBusy = false
    let rssBusy = false
    let stopped = false
    let stoppedResult = null
    let steadyStateStartAt = null
    const cdpSamples = []
    const rssSamples = []

    const collectRss = async () => {
        if (rssBusy) return
        rssBusy = true
        try {
            const sample = await sampleProcessTreeRss(browserPid)
            rssSamples.push({ at: Date.now(), ...sample })
        } catch (error) {
            rssFailureReason ??= error instanceof Error ? error.message : String(error)
        } finally {
            rssBusy = false
        }
    }

    const collectCdp = async () => {
        if (cdpBusy || !cdpSession) return
        cdpBusy = true
        try {
            const [performanceResult, domCounters] = await Promise.all([
                cdpSession.send('Performance.getMetrics'),
                cdpSession.send('Memory.getDOMCounters'),
            ])
            cdpSamples.push({
                at: Date.now(),
                ...parsePerformanceMetrics(performanceResult.metrics),
                documents: domCounters.documents ?? null,
                nodes: domCounters.nodes ?? null,
                jsEventListeners: domCounters.jsEventListeners ?? null,
            })
        } catch (error) {
            cdpFailureReason ??= error instanceof Error ? error.message : String(error)
        } finally {
            cdpBusy = false
        }
    }

    await collectRss()
    rssTimer = setInterval(() => {
        void collectRss()
    }, 100)

    try {
        const port = await waitForDevToolsPort(profileDir)
        const wsUrl = await waitForPageTarget(port, targetUrl)
        cdpSession = new CDPSession(wsUrl)
        await cdpSession.open()
        await cdpSession.send('Performance.enable')
        steadyStateStartAt = Date.now()
        await collectRss()
        await collectCdp()
        cdpTimer = setInterval(() => {
            void collectCdp()
        }, 100)
    } catch (error) {
        cdpFailureReason = error instanceof Error ? error.message : String(error)
    }

    return {
        async stop() {
            if (stopped) return stoppedResult
            stopped = true
            if (cdpTimer) clearInterval(cdpTimer)
            if (rssTimer) clearInterval(rssTimer)
            await collectCdp()
            await collectRss()
            cdpSession?.close()
            stoppedResult = {
                cdp: summarizeCdpSamples(cdpSamples, cdpFailureReason),
                processTree: summarizeProcessTreeSamples(
                    rssSamples,
                    rssFailureReason,
                    steadyStateStartAt,
                ),
            }
            return stoppedResult
        },
    }
}

const runCase = async ({
    targetPath,
    label,
    caseConfig,
    iterations = options.runs,
    warmup = options.warmupRuns,
    scenario,
}) => {
    const tempProfile = path.join(os.tmpdir(), `foliate-bench-${Date.now()}-${Math.random().toString(16).slice(2)}`)
    const sampleUrl = `/__sample__?path=${encodeURIComponent(targetPath)}`
    const stepCount = scenario.steps?.length ?? 0
    const totalIterations = iterations + warmup
    const timeoutMs = Math.max(120000, 30000 + totalIterations * (20000 + stepCount * 5000))
    const url = `http://127.0.0.1:${server.address().port}${benchmarkPath}?target=${encodeURIComponent(sampleUrl)}&label=${encodeURIComponent(label)}&backend=${caseConfig.backend}&fallback=${caseConfig.fallback}&turnSettle=${encodeURIComponent(options.turnSettle)}&flow=${encodeURIComponent(options.flow ?? '')}&animated=${options.animated ? '1' : '0'}&eink=${options.eink ? '1' : '0'}&iterations=${iterations}&warmup=${warmup}&scenario=${encodeURIComponent(JSON.stringify(scenario))}`
    const browser = spawn(chromePath, [
        '--headless=new',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--remote-debugging-port=0',
        `--user-data-dir=${tempProfile}`,
        url,
    ], {
        stdio: 'ignore',
    })
    const resultPromise = waitForResult(timeoutMs)
    const monitor = await startBrowserMonitoring({
        profileDir: tempProfile,
        browserPid: browser.pid,
        targetUrl: url,
    })
    try {
        const result = await resultPromise
        const monitoring = await monitor.stop()
        return {
            ...result,
            monitoring,
        }
    } finally {
        try {
            await monitor.stop()
        } catch {}
        browser.kill('SIGKILL')
    }
}

const summarizeDurations = runs => {
    const successful = runs.filter(result => result.ok && Number.isFinite(result.totalDuration))
    const failed = runs.length - successful.length
    if (!successful.length) return {
        okRuns: 0,
        failedRuns: failed,
    }
    const ordered = successful
        .slice()
        .sort((left, right) => left.totalDuration - right.totalDuration)
    const durations = ordered.map(result => result.totalDuration)
    const effectiveTrim = Math.min(options.trimCount, Math.max(0, Math.floor((durations.length - 1) / 2)))
    const trimmedRuns = effectiveTrim > 0
        ? ordered.slice(effectiveTrim, ordered.length - effectiveTrim)
        : ordered
    const trimmedDurations = trimmedRuns.map(result => result.totalDuration)
    const sum = trimmedDurations.reduce((total, value) => total + value, 0)
    const average = sum / trimmedDurations.length
    const variance = trimmedDurations.reduce((total, value) => total + ((value - average) ** 2), 0) / trimmedDurations.length
    const standardDeviation = Math.sqrt(variance)
    const middle = Math.floor(trimmedDurations.length / 2)
    const median = trimmedDurations.length % 2
        ? trimmedDurations[middle]
        : (trimmedDurations[middle - 1] + trimmedDurations[middle]) / 2
    const medianRun = trimmedRuns.find(result => result.totalDuration === median)
        ?? trimmedRuns[Math.min(middle, trimmedRuns.length - 1)]
    const coefficientOfVariation = average > 0 ? standardDeviation / average : 0
    const rangeRatio = average > 0 ? (trimmedDurations[trimmedDurations.length - 1] - trimmedDurations[0]) / average : 0
    const stabilityFailures = []
    if (coefficientOfVariation > options.maxCv) stabilityFailures.push(`cv>${options.maxCv}`)
    if (rangeRatio > options.maxRange) stabilityFailures.push(`range>${options.maxRange}`)
    const memoryMetricMedian = selector => {
        const values = trimmedRuns
            .map(run => selector(run?.memory))
            .filter(Number.isFinite)
            .sort((left, right) => left - right)
        if (!values.length) return null
        const middleIndex = Math.floor(values.length / 2)
        return values.length % 2
            ? values[middleIndex]
            : (values[middleIndex - 1] + values[middleIndex]) / 2
    }
    const memorySupportedRuns = trimmedRuns.filter(run => run?.memory?.supported).length
    const uaMemorySupportedRuns = trimmedRuns.filter(
        run => run?.memory?.userAgentSpecific?.supported,
    ).length
    return {
        okRuns: successful.length,
        failedRuns: failed,
        min: durations[0],
        median,
        max: durations[durations.length - 1],
        average,
        standardDeviation,
        coefficientOfVariation,
        rangeRatio,
        trimCount: effectiveTrim,
        rawMin: durations[0],
        rawMax: durations[durations.length - 1],
        rawAverage: durations.reduce((total, value) => total + value, 0) / durations.length,
        sampleCount: durations.length,
        trimmedSampleCount: trimmedDurations.length,
        stable: stabilityFailures.length === 0,
        stabilityFailures,
        summary: medianRun?.summary ?? null,
        backendStates: medianRun?.backendStates ?? [],
        phases: medianRun?.phases ?? [],
        memory: {
            supportedRuns: memorySupportedRuns,
            medianPeakUsedJSHeapSize: memoryMetricMedian(memory => memory?.peakUsedJSHeapSize),
            medianHeapDeltaUsedJSHeapSize: memoryMetricMedian(memory => memory?.heapDeltaUsedJSHeapSize),
            medianPostDestroyDeltaUsedJSHeapSize: memoryMetricMedian(memory => memory?.postDestroyDeltaUsedJSHeapSize),
            userAgentSpecific: {
                supportedRuns: uaMemorySupportedRuns,
                medianBytesDelta: memoryMetricMedian(memory => memory?.userAgentSpecific?.bytesDelta),
                medianPostDestroyBytesDelta: memoryMetricMedian(
                    memory => memory?.userAgentSpecific?.postDestroyBytesDelta,
                ),
                snapshot: medianRun?.memory?.userAgentSpecific ?? null,
            },
            snapshot: medianRun?.memory ?? null,
        },
    }
}

const compactRun = result => {
    if (!result.ok) return result
    return {
        ok: result.ok,
        iteration: result.iteration,
        totalDuration: result.totalDuration,
        actions: result.actions,
        summary: result.summary,
        backendStates: result.backendStates,
        memory: result.memory,
    }
}

const normalizeCaseResult = result => {
    if (Array.isArray(result?.runs)) return {
        runs: result.runs.map(compactRun),
        topLevelError: null,
        stats: summarizeDurations(result.runs ?? []),
        monitoring: result.monitoring ?? null,
    }
    return {
        runs: [],
        topLevelError: result?.error ?? (result?.ok === false ? result : null),
        stats: {
            okRuns: 0,
            failedRuns: 1,
        },
        monitoring: result?.monitoring ?? null,
    }
}

const benchmarkTarget = async (targetPath, scenario) => {
    const label = path.basename(targetPath)
    const ext = path.extname(targetPath).toLowerCase()
    const caseResults = {}
    for (const caseConfig of activeCaseConfigs)
        caseResults[caseConfig.key] = await runCase({ targetPath, label, caseConfig, scenario })
    return {
        target: targetPath,
        type: ext,
        label,
        measurementMode: 'batched-page',
        scenario: scenario.name,
        turnSettle: options.turnSettle,
        flow: options.flow,
        animated: options.animated,
        eink: options.eink,
        cases: Object.fromEntries(activeCaseConfigs.map(config => [config.key,
            normalizeCaseResult(caseResults[config.key]) ])),
    }
}

const compareToBaseline = async targets => {
    if (!options.baselinePath) return null
    const baselinePath = resolveFromRepo(options.baselinePath)
    const baseline = JSON.parse(await readFile(baselinePath, 'utf8'))
    const baselineTargets = new Map((baseline.targets ?? []).map(target => [target.target, target]))
    const regressions = []
    const comparisons = []
    for (const target of targets) {
        const previous = baselineTargets.get(target.target)
        if (!previous) continue
        for (const config of activeCaseConfigs) {
            const currentMedian = target.cases[config.key]?.stats?.median
            const baselineMedian = previous.cases?.[config.key]?.stats?.median
            if (!Number.isFinite(currentMedian) || !Number.isFinite(baselineMedian) || baselineMedian <= 0) continue
            const delta = currentMedian - baselineMedian
            const ratio = delta / baselineMedian
            const stable = Boolean(target.cases[config.key]?.stats?.stable)
            const comparison = {
                target: target.target,
                case: config.key,
                baselineMedian,
                currentMedian,
                delta,
                ratio,
                stable,
                regressed: stable && ratio > options.threshold,
            }
            comparisons.push(comparison)
            if (comparison.regressed) regressions.push(comparison)
        }
    }
    return {
        baselinePath,
        threshold: options.threshold,
        comparisons,
        regressions,
    }
}

const buildSummary = targets => targets.map(target => ({
    target: target.target,
    label: target.label,
    type: target.type,
    measurementMode: target.measurementMode,
    scenario: target.scenario,
    turnSettle: target.turnSettle,
    flow: target.flow,
    animated: target.animated,
    eink: target.eink,
    cases: Object.fromEntries(activeCaseConfigs.map(config => {
        const stats = target.cases[config.key]?.stats ?? {}
        return [config.key, {
            okRuns: stats.okRuns ?? 0,
            failedRuns: stats.failedRuns ?? 0,
            median: stats.median ?? null,
            min: stats.min ?? null,
            max: stats.max ?? null,
            trimCount: stats.trimCount ?? null,
            sampleCount: stats.sampleCount ?? null,
            trimmedSampleCount: stats.trimmedSampleCount ?? null,
            coefficientOfVariation: stats.coefficientOfVariation ?? null,
            rangeRatio: stats.rangeRatio ?? null,
            stable: stats.stable ?? null,
            stabilityFailures: stats.stabilityFailures ?? [],
            memory: stats.memory ?? null,
            monitoring: target.cases[config.key]?.monitoring ?? null,
        }]
    })),
}))

server.listen(0, '127.0.0.1', async () => {
    try {
        const targets = await loadTargets()
        const scenario = await loadScenario()
        const results = []
        for (const targetPath of targets) results.push(await benchmarkTarget(targetPath, scenario))
        const comparison = await compareToBaseline(results)
        const payload = {
            generatedAt: new Date().toISOString(),
            workspaceRoot,
            repoRoot,
            chromePath,
            scenario: scenario.name,
            turnSettle: options.turnSettle,
            flow: options.flow,
            animated: options.animated,
            eink: options.eink,
            cases: activeCaseConfigs.map(config => config.key),
            runsPerCase: options.runs,
            warmupRunsPerCase: options.warmupRuns,
            trimCount: options.trimCount,
            stabilityGate: {
                maxCv: options.maxCv,
                maxRange: options.maxRange,
            },
            summary: buildSummary(results),
            targets: results,
            comparison,
        }

        if (options.outputPath) {
            const outputPath = resolveFromRepo(options.outputPath)
            await mkdir(path.dirname(outputPath), { recursive: true })
            await writeFile(outputPath, JSON.stringify(payload, null, 2))
        }

        console.log(JSON.stringify(payload, null, 2))
        server.close(() => {
            if (comparison?.regressions?.length) process.exit(2)
        })
    } catch (error) {
        console.error(error instanceof Error ? error.stack : String(error))
        server.close(() => process.exit(1))
    }
})
