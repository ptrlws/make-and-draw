import type { Sound } from '../types'

/**
 * Procedural WebAudio foley — no audio files. Every voice is layered from
 * two building blocks (shaped tones + filtered-noise bursts) so interactions
 * sound like paper, water and ink rather than a bare oscillator. A master
 * compressor keeps stacked plays from clipping. Created lazily on the first
 * gesture so we respect browser autoplay policies.
 *
 * Haptics ride along with the sounds (navigator.vibrate where supported):
 * muting the audio keeps the taps tactile; calm mode stills them.
 */

const HAPTIC: Partial<Record<Sound, number | number[]>> = {
  drip: 10,
  pop: 8,
  page: 12,
  wrong: [24, 60, 24],
  fw: [18, 50, 14, 40, 10],
  chime: 18,
  gather: 12,
  lift: 14,
  fold: 15,
  press: [12, 80, 20],
  peel: 12,
  climax: [24, 40, 18, 40, 14, 90, 60],
  step: 8,
}

export class Foley {
  private ctx: AudioContext | null = null
  private master: DynamicsCompressorNode | null = null
  private noiseBuf: AudioBuffer | null = null

  ensure(): void {
    if (this.ctx) return
    try {
      const Ctor: typeof AudioContext | undefined =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext
      if (!Ctor) return
      this.ctx = new Ctor()
      this.master = this.ctx.createDynamicsCompressor()
      this.master.threshold.value = -18
      this.master.knee.value = 24
      this.master.ratio.value = 6
      this.master.connect(this.ctx.destination)
      // 1s of white noise, reused by every noise voice
      const len = this.ctx.sampleRate
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
      const d = this.noiseBuf.getChannelData(0)
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    } catch {
      /* audio unavailable — the app stays silent */
    }
  }

  /** Nudge a suspended context back to life (autoplay unlock on gesture). */
  resume(): void {
    void this.ctx?.resume?.()
  }

  play(type: Sound, muted: boolean, calm: boolean, pitch = 1): void {
    // haptics are their own channel: they survive mute, calm stills them
    if (!calm && HAPTIC[type]) {
      try {
        navigator.vibrate?.(HAPTIC[type]!)
      } catch {
        /* unsupported */
      }
    }
    if (muted || !this.ctx || !this.master) return
    const ctx = this.ctx
    const master = this.master
    const noiseBuf = this.noiseBuf
    const now = ctx.currentTime
    const vol = calm ? 0.06 : 0.12

    const tone = (
      f: number,
      f2: number | null,
      dur: number,
      wave: OscillatorType = 'sine',
      v: number = vol,
      delay = 0,
    ) => {
      const t0 = now + delay
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = wave
      o.frequency.setValueAtTime(Math.max(30, f * pitch), t0)
      if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(30, f2 * pitch), t0 + dur)
      g.gain.setValueAtTime(v, t0)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
      o.connect(g).connect(master)
      o.start(t0)
      o.stop(t0 + dur)
    }

    /** Filtered noise burst — the paper/water/ink half of the palette. */
    const noise = (
      dur: number,
      f0: number,
      f1: number | null,
      v: number = vol,
      delay = 0,
      kind: BiquadFilterType = 'bandpass',
      q = 1,
    ) => {
      if (!noiseBuf) return
      const t0 = now + delay
      const src = ctx.createBufferSource()
      src.buffer = noiseBuf
      src.loop = true
      src.playbackRate.value = 0.9 + Math.random() * 0.2
      const flt = ctx.createBiquadFilter()
      flt.type = kind
      flt.Q.value = q
      flt.frequency.setValueAtTime(Math.max(40, f0 * pitch), t0)
      if (f1) flt.frequency.exponentialRampToValueAtTime(Math.max(40, f1 * pitch), t0 + dur)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t0)
      g.gain.exponentialRampToValueAtTime(v, t0 + Math.min(0.015, dur * 0.2))
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
      src.connect(flt).connect(g).connect(master)
      src.start(t0, Math.random() * 0.4)
      src.stop(t0 + dur + 0.02)
    }

    switch (type) {
      case 'drip':
        // water plop: pitch-drop blip + splash + low body
        tone(620, 160, 0.14, 'sine', vol)
        noise(0.08, 1800, 700, vol * 0.5, 0.006, 'bandpass', 2)
        tone(120, 80, 0.16, 'sine', vol * 0.45, 0.02)
        break
      case 'swirl':
        // liquid drag: soft low whoosh that tracks finger speed via pitch
        noise(0.14, 320, 520, vol * 0.4, 0, 'lowpass')
        break
      case 'pop': {
        // bubble pop: detuned blip + tiny click
        const dt = 1 + (Math.random() - 0.5) * 0.12
        tone(300 * dt, 540 * dt, 0.1, 'triangle', vol)
        noise(0.035, 2400, null, vol * 0.5, 0, 'highpass')
        break
      }
      case 'step':
        // ladder note: like pop but pitch-EXACT, so rising runs actually rise
        tone(300, 540, 0.11, 'triangle', vol)
        tone(300, 540, 0.11, 'sine', vol * 0.4)
        noise(0.03, 2600, null, vol * 0.45, 0, 'highpass')
        break
      case 'select':
        // soft mechanical tick
        noise(0.03, 3200, null, vol * 0.45, 0, 'highpass')
        tone(560, 720, 0.05, 'triangle', vol * 0.45)
        break
      case 'page':
        // a real paper whoosh
        noise(0.18, 420, 1500, vol * 0.7, 0, 'bandpass', 0.8)
        tone(130, 90, 0.12, 'sine', vol * 0.3)
        break
      case 'wrong':
        // friendly cushioned double-thud — never harsh
        tone(150, 110, 0.1, 'sine', vol * 0.6)
        tone(140, 100, 0.12, 'sine', vol * 0.5, 0.13)
        noise(0.05, 300, null, vol * 0.25, 0, 'lowpass')
        break
      case 'lift':
        // the collectible rises: tone climb + water sheeting off
        tone(180, 540, 0.5, 'sine', vol * 0.7)
        noise(0.45, 900, 2600, vol * 0.35, 0.05, 'bandpass', 0.7)
        break
      case 'gather':
        // ritual opener: riser swell (noise sweep + climbing tone)
        noise(0.4, 300, 2200, vol * 0.5, 0, 'bandpass', 0.8)
        tone(300, 590, 0.38, 'sine', vol * 0.55)
        break
      case 'chime': {
        // warm shelved chime: soft triad + sparkle
        tone(523, null, 0.6, 'sine', vol * 0.65)
        tone(659, null, 0.55, 'sine', vol * 0.4, 0.06)
        tone(784, null, 0.7, 'sine', vol * 0.5, 0.12)
        noise(0.25, 4200, 6200, vol * 0.2, 0.1, 'bandpass', 2)
        break
      }
      case 'fold':
        // paper folding over: two quick down-whooshes
        noise(0.14, 1400, 500, vol * 0.6, 0, 'bandpass', 0.9)
        noise(0.12, 1100, 420, vol * 0.5, 0.1, 'bandpass', 0.9)
        break
      case 'press':
        // the big squash: deep body + slow air squeeze
        tone(150, 55, 0.4, 'sine', vol * 0.8)
        noise(0.38, 700, 180, vol * 0.55, 0.02, 'lowpass')
        break
      case 'peel':
        // sticky lift: rising crackle sweep
        noise(0.32, 350, 2600, vol * 0.6, 0, 'bandpass', 1.4)
        tone(240, 620, 0.28, 'triangle', vol * 0.3)
        break
      case 'climax': {
        // the last-dot payoff: an accelerating pentatonic run sweeping up,
        // landing on a deep boom + bright major chord + long sparkle tail
        if (calm) {
          tone(392, null, 0.4, 'sine', vol * 0.5)
          tone(523, null, 0.5, 'sine', vol * 0.45, 0.18)
          tone(659, null, 0.7, 'sine', vol * 0.4, 0.36)
          noise(0.6, 2400, 4200, vol * 0.2, 0.3, 'bandpass', 1.4)
          break
        }
        const RUN = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24]
        let at = 0
        RUN.forEach((semi, i) => {
          tone(330 * Math.pow(2, semi / 12), null, 0.16, 'triangle', vol * (0.35 + i * 0.045), at)
          noise(0.03, 2600 + i * 300, null, vol * 0.25, at, 'highpass')
          at += Math.max(0.028, 0.085 - i * 0.006) // accelerando — it runs away upward
        })
        const land = at + 0.03
        tone(98, 55, 0.55, 'sine', vol * 0.95, land) // the boom
        tone(1046, null, 0.9, 'sine', vol * 0.6, land)
        tone(1318, null, 0.85, 'sine', vol * 0.45, land + 0.04)
        tone(1568, null, 1.0, 'sine', vol * 0.4, land + 0.08)
        noise(1.0, 5200, 2600, vol * 0.35, land, 'bandpass', 1.2) // sparkle rain
        for (let i = 0; i < 4; i++) {
          noise(0.05, 2000 + Math.random() * 2600, null, vol * 0.6, land + 0.1 + i * 0.12, 'bandpass', 2.2)
        }
        break
      }
      case 'fw':
        if (calm) {
          tone(500, 700, 0.25, 'sine', 0.05)
          noise(0.3, 2000, 3600, 0.03, 0, 'bandpass', 1.5)
          break
        }
        // celebration: crackle bursts + falling whistles across a full second
        for (let i = 0; i < 6; i++) {
          const d = i * 0.13 + Math.random() * 0.04
          noise(0.06, 1800 + Math.random() * 2400, null, vol * 0.7, d, 'bandpass', 2.2)
          if (i % 2 === 0) tone(700 + Math.random() * 500, 160, 0.22, 'triangle', vol * 0.6, d + 0.02)
        }
        noise(0.5, 5000, 2400, vol * 0.25, 0.35, 'bandpass', 1)
        break
    }
  }
}
