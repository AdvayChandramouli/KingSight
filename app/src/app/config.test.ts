import { describe, expect, it } from 'vitest'
import { DEFAULT_MAP_ATTRIBUTION, DEFAULT_MAP_STYLE_URL, readConfig } from './config'

describe('map config', () => {
  it('resolves an unset or empty style URL to OpenFreeMap Positron', () => {
    expect(DEFAULT_MAP_STYLE_URL).toBe('https://tiles.openfreemap.org/styles/positron')
    expect(DEFAULT_MAP_STYLE_URL).not.toContain('tile.openstreetmap.org')
    expect(readConfig({}).mapStyleUrl).toBe(DEFAULT_MAP_STYLE_URL)
    expect(readConfig({ VITE_MAP_STYLE_URL: '' }).mapStyleUrl).toBe(DEFAULT_MAP_STYLE_URL)
    expect(readConfig({ VITE_MAP_STYLE_URL: '   ' }).mapStyleUrl).toBe(DEFAULT_MAP_STYLE_URL)
  })

  it('lets a custom style URL override the default', () => {
    const custom = 'https://example.com/styles/light.json'
    expect(readConfig({ VITE_MAP_STYLE_URL: custom }).mapStyleUrl).toBe(custom)
    expect(readConfig({ VITE_MAP_STYLE_URL: `  ${custom}  ` }).mapStyleUrl).toBe(custom)
  })

  it('uses the OSM attribution unless a custom string is set', () => {
    expect(DEFAULT_MAP_ATTRIBUTION).toBe('© OpenStreetMap contributors · OpenFreeMap')
    expect(readConfig({}).mapAttribution).toBe(DEFAULT_MAP_ATTRIBUTION)
    expect(readConfig({ VITE_MAP_ATTRIBUTION: '' }).mapAttribution).toBe(DEFAULT_MAP_ATTRIBUTION)
    expect(readConfig({ VITE_MAP_ATTRIBUTION: 'Custom tiles' }).mapAttribution).toBe('Custom tiles')
  })
})
