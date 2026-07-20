import { createContext, useContext } from 'react'
import type { Config } from '../config'
import type { GalleryItem, GalleryType, KitId, Screen, Sound } from '../types'
import type { GameState } from './state'

/** Everything a finished creation needs to enter the ritual + gallery. */
export interface FinishInput {
  type: GalleryType
  title: string
  tint: string
  img?: string
  fills?: Record<string, number>
}

/** The API every screen consumes via {@link useGame}. */
export interface GameApi {
  state: GameState
  config: Config
  reducedMotion: boolean
  play: (sound: Sound, pitch?: number) => void
  showToast: (msg: string) => void
  go: (screen: Screen) => void
  openKit: (kit: KitId) => void
  confirmName: (name: string) => void
  openBook: () => void
  openSettings: () => void
  closeSettings: () => void
  toggleMute: () => void
  toggleCalm: () => void
  startFinish: (item: FinishInput) => void
  removeCreation: (id: string) => void
  restoreCreation: (item: GalleryItem, index: number) => void
  importCollection: (items: GalleryItem[]) => Promise<number>
  clearCollection: () => void
  /** switch to another maker (reloads into their studio) */
  switchProfile: (id: string) => void
  /** create a fresh maker and drop straight into naming them */
  addProfile: () => void
  /** delete a maker and all their work */
  deleteProfile: (id: string) => void
}

export const GameContext = createContext<GameApi | null>(null)

export function useGame(): GameApi {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame must be used within <GameProvider>')
  return ctx
}
