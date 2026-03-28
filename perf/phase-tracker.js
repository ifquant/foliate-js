const now = () => globalThis.performance?.now?.() ?? Date.now()

const cloneDetail = detail => detail == null ? null : globalThis.structuredClone
    ? globalThis.structuredClone(detail)
    : JSON.parse(JSON.stringify(detail))

export class PhaseTracker {
    #enabled
    #events = []
    constructor({ enabled = false } = {}) {
        this.#enabled = enabled
    }
    get enabled() {
        return this.#enabled
    }
    mark(name, detail) {
        if (!this.#enabled) return
        this.#events.push({
            type: 'mark',
            name,
            at: now(),
            detail: cloneDetail(detail),
        })
    }
    async time(name, fn, detail) {
        if (!this.#enabled) return fn()
        const start = now()
        try {
            const value = await fn()
            const end = now()
            this.#events.push({
                type: 'measure',
                name,
                start,
                end,
                duration: end - start,
                detail: cloneDetail(detail),
                status: 'ok',
            })
            return value
        } catch (error) {
            const end = now()
            this.#events.push({
                type: 'measure',
                name,
                start,
                end,
                duration: end - start,
                detail: cloneDetail(detail),
                status: 'error',
                error: error instanceof Error ? error.message : String(error),
            })
            throw error
        }
    }
    snapshot() {
        return this.#events.map(event => ({ ...event }))
    }
}

export const createPhaseTracker = options => new PhaseTracker(options)
