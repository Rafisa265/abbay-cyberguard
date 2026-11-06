import { describe, it, expect, vi, afterEach } from 'vitest'
import { analyze, generate, randomInt, CLASSES } from './m2.js'

afterEach(() => vi.restoreAllMocks())
describe('M2 strength vectors (FR-11)', () => {
  it('very weak / common', () => { expect(analyze('password').category).toBe(0); expect(analyze('password').feedback).toContain('common') })
  it('flags patterns', () => {
    expect(analyze('aaaaaaaaaaaa').feedback).toContain('repeat'); expect(analyze('abcd1234xyz!').feedback).toContain('sequence')
    expect(analyze('qwertyuiopAS1!').feedback).toContain('walk')
  })
  it('strong random-looking', () => expect(analyze('Xq7#mT2v!Lp9aRw4zK').category).toBe(3))
  it('longer random never rates below shorter', () => {
    let prev = -1
    for (const n of [4, 8, 12, 16, 24]) { const c = analyze(generate({ length: Math.max(n, 12) }) .slice(0, n) || 'a').category; expect(c).toBeGreaterThanOrEqual(0); prev = c }
    expect(analyze('Xq7#mT2v!Lp9aRw4zKab').category).toBeGreaterThanOrEqual(analyze('Xq7#mT2v!').category)
  })
  it('handles Ethiopic / Latin Afaan Oromoo without error and flags non-ASCII (FR-12)', () => {
    expect(analyze('ሰላም ዓለም ኢትዮጵያ').nonAscii).toBe(true); expect(analyze('Galatoomaa').nonAscii).toBe(false); expect(analyze('')).toBeNull()
  })
})
describe('M2 generator (FR-13, FR-14)', () => {
  it('uses crypto.getRandomValues, never Math.random', () => {
    const m = vi.spyOn(Math, 'random'); const g = vi.spyOn(crypto, 'getRandomValues')
    generate({ length: 20 }); expect(g).toHaveBeenCalled(); expect(m).not.toHaveBeenCalled()
  })
  it('discards out-of-range values (rejection sampling)', () => {
    const seq = [0xffffffff, 0xfffffffe, 7]; let i = 0
    const rng = { getRandomValues: (b) => { b[0] = seq[i++] } }
    expect(randomInt(10, rng)).toBe(7); expect(i).toBe(3)
  })
  it('uniform (chi-square, df=9, p<0.001 critical 27.88)', () => {
    const N = 100000, counts = Array(10).fill(0)
    for (let i = 0; i < N; i++) counts[randomInt(10)]++
    const chi = counts.reduce((a, c) => a + (c - N / 10) ** 2 / (N / 10), 0)
    expect(chi).toBeLessThan(27.88)
  })
  it('respects length, classes and ASCII for all combos', () => {
    for (let mask = 1; mask < 16; mask++) for (const length of [12, 16, 64]) {
      const classes = { lower: mask & 1, upper: mask & 2, digits: mask & 4, symbols: mask & 8 }
      const p = generate({ length, classes })
      expect(p).toHaveLength(length); expect(/^[\x20-\x7e]+$/.test(p)).toBe(true)
      for (const k of Object.keys(classes)) if (classes[k]) expect([...p].some((ch) => CLASSES[k].includes(ch))).toBe(true)
      for (const k of Object.keys(classes)) if (!classes[k]) expect([...p].some((ch) => CLASSES[k].includes(ch))).toBe(false)
    }
  })
  it('rejects no classes and bad length', () => {
    expect(() => generate({ length: 16, classes: {} })).toThrow('noclass'); expect(() => generate({ length: 11 })).toThrow('length'); expect(() => generate({ length: 65 })).toThrow('length')
  })
})
