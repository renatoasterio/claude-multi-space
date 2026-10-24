import { describe, expect, it, vi } from 'vitest'
import { ChildProcessRegistry } from '@main/infrastructure/process/ChildProcessRegistry'
import { FakeProcess } from '../../fakes'

describe('ChildProcessRegistry', () => {
  it('remove a entrada e o listener quando o processo termina', () => {
    const registry = new ChildProcessRegistry()
    const onChange = vi.fn()
    registry.onChange(onChange)
    const proc = new FakeProcess()

    registry.track('a', proc)
    expect(registry.isTracked('a')).toBe(true)
    proc.exit()
    expect(registry.isTracked('a')).toBe(false)
    expect(proc.listenerCount()).toBe(0)
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('substituir um processo desinscreve o anterior', () => {
    const registry = new ChildProcessRegistry()
    const first = new FakeProcess()
    const second = new FakeProcess()
    registry.track('a', first)
    registry.track('a', second)
    expect(first.listenerCount()).toBe(0)
    first.exit()
    expect(registry.isTracked('a')).toBe(true)
  })

  it('dispose limpa todos os listeners', () => {
    const registry = new ChildProcessRegistry()
    const proc = new FakeProcess()
    const onChange = vi.fn()
    registry.onChange(onChange)
    registry.track('a', proc)
    registry.dispose()
    expect(proc.listenerCount()).toBe(0)
    proc.exit()
    expect(onChange).toHaveBeenCalledTimes(1)
  })
})
