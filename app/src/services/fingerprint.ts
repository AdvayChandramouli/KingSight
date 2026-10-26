import type { PredictInput, PredictRequest, PropertyAttributes } from './types'

/** Deterministic JSON with sorted keys, so equal snapshots serialize equally. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`
}

/** 32-bit FNV-1a, hex encoded. Fast and stable; not a security primitive. */
export function fnv1a(text: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function attributesFingerprint(attributes: PropertyAttributes): string {
  return fnv1a(stableStringify(attributes))
}

/** Fingerprint of the full input snapshot, including model selection. */
export function inputFingerprint(input: PredictInput): string {
  const normalized = { ...input, model_ids: [...input.model_ids].sort() }
  return fnv1a(stableStringify(normalized))
}

/** Attach a stable client request id derived from the snapshot itself. */
export function toPredictRequest(input: PredictInput): PredictRequest {
  return { ...input, client_request_id: `req-${inputFingerprint(input)}` }
}

export function attributesEqual(a: PropertyAttributes, b: PropertyAttributes): boolean {
  return stableStringify(a) === stableStringify(b)
}
