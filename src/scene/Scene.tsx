import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { ACESFilmicToneMapping } from 'three'
import { colors } from '../config/theme'
import { CAMERA } from './layout'
import { CameraRig } from './CameraRig'
import { CITY_FAR } from './city/cityConfig'
import { Chair } from './Chair'
import { City } from './City'
import { CatBed } from './CatBed'
import { CeilingLight } from './CeilingLight'
import { Desk, Monitor } from './Desk'
import { DeskMat } from './DeskMat'
import { Book, Keyboard, Mouse, Pen, Phone, StickyNotes } from './DeskProps'
import { Lamp } from './Lamp'
import { Environment } from './Environment'
import { MAX_DPR, lowPower } from './quality'
import { Rug } from './Rug'
import { Lighting } from './Lighting'
import { Robot } from './Robot'
import { Pegboard } from './Pegboard'
import { Room } from './Room'
import { Building } from './Building'
import { Entrance } from './Entrance'
import { FloorLamps } from './FloorLamps'
import { Shelf } from './Shelf'
import { Frames } from './Frames'
import { FrameSpotlights } from './FrameSpotlights'
import { Sofa } from './Sofa'
import { MonsteraPlant } from './MonsteraPlant'
import { InspectHooks, manualFrames } from './InspectHooks'

const [fx, fy, fz] = CAMERA.focus
const [ox, oy, oz] = CAMERA.offset

/** The hotspotRef prop is accepted for API compatibility but the monitor-following tracker has been removed. */
export default function Scene({ onInteract }: { onInteract?: () => void; hotspotRef?: unknown }) {
  return (
    <Canvas
      frameloop={manualFrames ? 'never' : 'always'}
      shadows={lowPower ? false : 'percentage'}
      dpr={[1, MAX_DPR]}
      camera={{ fov: CAMERA.fov, near: 0.1, far: CITY_FAR, position: [fx + ox, fy + oy, fz + oz] }}
      gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      aria-label="Interactive 3D developer studio at night"
    >
      <color attach="background" args={[colors.skyTop]} />
      <Environment />
      <Lighting />
      <Room />
      <Building />
      <Entrance />
      <FloorLamps />
      <Rug />
      <CeilingLight />
      <City />
      <Desk />
      <Monitor />
      <DeskMat />
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
      <Frames />
      <Suspense fallback={null}><FrameSpotlights /></Suspense>
      <Pegboard />
      <Sofa />
      <MonsteraPlant />
      <CatBed />
      <CameraRig onInteract={onInteract} />
      <InspectHooks />
    </Canvas>
  )
}