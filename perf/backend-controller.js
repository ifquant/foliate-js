const validStates = new Set([
    'selected',
    'loading',
    'active',
    'failed',
    'fallback',
])

const freeze = value => Object.freeze({ ...value })

export class BackendController {
    #states = []
    #active
    constructor({ tracker } = {}) {
        this.tracker = tracker
    }
    transition(backend, state, detail = {}) {
        if (!validStates.has(state)) throw new Error(`Invalid backend state: ${state}`)
        const record = freeze({
            backend,
            state,
            detail,
            at: globalThis.performance?.now?.() ?? Date.now(),
        })
        this.#states.push(record)
        this.#active = record
        this.tracker?.mark(`backend:${state}`, record)
        return record
    }
    get active() {
        return this.#active
    }
    get states() {
        return this.#states.slice()
    }
    async run({ primary, fallback, load }) {
        this.transition(primary, 'selected')
        this.transition(primary, 'loading')
        try {
            const value = await load(primary)
            this.transition(primary, 'active')
            return value
        } catch (error) {
            this.transition(primary, 'failed', {
                error: error instanceof Error ? error.message : String(error),
            })
            if (!fallback) throw error
            this.transition(fallback, 'fallback', { from: primary })
            this.transition(fallback, 'loading')
            const value = await load(fallback)
            this.transition(fallback, 'active')
            return value
        }
    }
}

export const createBackendController = options => new BackendController(options)
