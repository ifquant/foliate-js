import './epubcfi-tests.js'
import { mountPhase0Harness } from './phase0-harness.js'

const root = document.createElement('main')
document.body.append(root)
mountPhase0Harness(root)
