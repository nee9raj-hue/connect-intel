import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parsePrometheusText } from './grafanaRemoteWrite.js'

describe('parsePrometheusText', () => {
  it('parses gauge and labeled counter lines', () => {
    const text = `# HELP connectintel_up Connect Intel process is running.
# TYPE connectintel_up gauge
connectintel_up 1
connectintel_search_total{status="ok"} 42
`
    const series = parsePrometheusText(text)
    assert.equal(series.length, 2)
    assert.equal(series[0].labels.__name__, 'connectintel_up')
    assert.equal(series[0].samples[0].value, 1)
    assert.equal(series[1].labels.status, 'ok')
    assert.equal(series[1].samples[0].value, 42)
  })

  it('skips comments and NaN values', () => {
    const series = parsePrometheusText('# comment\nmetric NaN\nvalid 3\n')
    assert.equal(series.length, 1)
    assert.equal(series[0].labels.__name__, 'valid')
  })
})
