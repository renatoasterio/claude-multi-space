import { describe, expect, it } from 'vitest'
import { buildDesktopLink, findDeepLinkInArgs, parseDeepLink } from '@shared/contracts/deepLink'
import { escapeXml, shortcutFileName } from '@main/infrastructure/shortcuts/shortcutNames'

const id = '11111111-1111-4111-8111-111111111111'

describe('deep links', () => {
  it('ida e volta do link de abrir o Desktop', () => {
    expect(parseDeepLink(buildDesktopLink(id))).toEqual({ action: 'open-desktop', profileId: id })
  })

  it('rejeita qualquer variação fora do formato exato', () => {
    for (const bad of [
      `claude-multispace://desktop/${id}/extra`,
      `claude-multispace://other/${id}`,
      'claude-multispace://desktop/../../etc',
      `http://desktop/${id}`,
      `claude-multispace://desktop/${id}?x=1`,
    ]) {
      expect(parseDeepLink(bad)).toBeNull()
    }
  })

  it('encontra o link entre os argumentos do processo', () => {
    expect(findDeepLinkInArgs(['C:\\app.exe', '--flag', buildDesktopLink(id)])?.profileId).toBe(id)
    expect(findDeepLinkInArgs(['C:\\app.exe'])).toBeNull()
  })
})

describe('nomes dos atalhos', () => {
  it('remove caracteres proibidos e pontos finais', () => {
    expect(shortcutFileName('Cliente / X: "beta"?')).toBe('Claude - Cliente X beta')
    expect(shortcutFileName('Work...')).toBe('Claude - Work')
    expect(shortcutFileName('***')).toBe('Claude - Profile')
  })

  it('escapa XML do Info.plist', () => {
    expect(escapeXml(`A & <B> "c" 'd'`)).toBe('A &amp; &lt;B&gt; &quot;c&quot; &apos;d&apos;')
  })
})
