import { Canvas } from '@react-three/fiber'
import { ACESFilmicToneMapping } from 'three'
import { colors } from '../config/theme'
import { CAMERA } from './layout'
import { CameraRig } from './CameraRig'
import { Chair } from './Chair'
import { City } from './City'
import { Desk, Keyboard, Monitor } from './Desk'
import { Lighting } from './Lighting'
import { Robot } from './Robot'
import { Pegboard } from './Pegboard'
import { Room } from './Room'
import { Shelf } from './Shelf'
import { Sofa } from './Sofa'

const [fx, fy, fz] = CAMERA.focus
const [ox, oy, oz] = CAMERA.offset

export default function Scene({ onInteract }: { onInteract?: () => void }) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ fov: CAMERA.fov, near: 0.1, far: 120, position: [fx + ox, fy + oy, fz + oz] }}
      gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1.15 }}
      aria-label="Interactive 3D developer studio at night"
    >
      <color attach="background" args={[colors.skyTop]} />
      <Lighting />
      <Room />
      <City />
      <Desk />
      <Monitor />
      <Keyboard />
      <Chair />
      <Robot />
      <Shelf />
      <Pegboard />
      <Sofa />
      <CameraRig onInteract={onInteract} />
    </Canvas>
  )
}
