import type { RefObject } from 'react'
import { Canvas } from '@react-three/fiber'
import { ACESFilmicToneMapping } from 'three'
import { colors } from '../config/theme'
import { CAMERA, MONITOR_HOTSPOT } from './layout'
import { CameraRig } from './CameraRig'
import { Chair } from './Chair'
import { City } from './City'
import { CatBed } from './CatBed'
import { CeilingLight } from './CeilingLight'
import { CoffeeTable } from './CoffeeTable'
import { Desk, Monitor } from './Desk'
import { Book, Keyboard, Lamp, Mouse, Pen, Phone, StickyNotes } from './DeskProps'
import { Environment } from './Environment'
import { HotspotTracker } from './HotspotTracker'
import { MAX_DPR, lowPower } from './quality'
import { Rug } from './Rug'
import { Lighting } from './Lighting'
import { Robot } from './Robot'
import { Pegboard } from './Pegboard'
import { Room } from './Room'
import { Shelf } from './Shelf'
import { Sofa } from './Sofa'

const [fx, fy, fz] = CAMERA.focus
const [ox, oy, oz] = CAMERA.offset

export default function Scene({ onInteract, hotspotRef }: { onInteract?: () => void; hotspotRef?: RefObject<HTMLElement | null> }) {
  return (
    <Canvas
      shadows={!lowPower}
      dpr={[1, MAX_DPR]}
      camera={{ fov: CAMERA.fov, near: 0.1, far: 120, position: [fx + ox, fy + oy, fz + oz] }}
      gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      aria-label="Interactive 3D developer studio at night"
    >
      <color attach="background" args={[colors.skyTop]} />
      <Environment />
      <Lighting />
      <Room />
      <Rug />
      <CeilingLight />
      <City />
      <Desk />
      <Monitor />
      <Keyboard />
      <Lamp />
      <StickyNotes />
      <Book />
      <Pen />
      <Phone />
      <Mouse />
      <Chair />
      <Robot />
      <Shelf />
      <Pegboard />
      <Sofa />
      <CoffeeTable />
      <CatBed />
      <CameraRig onInteract={onInteract} />
      {hotspotRef && <HotspotTracker target={hotspotRef} anchor={MONITOR_HOTSPOT} />}
    </Canvas>
  )
}
