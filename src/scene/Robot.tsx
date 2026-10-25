import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { prefersReducedMotion } from './motion'
import { ROBOT_HEAD, ROBOT_HEAD_YAW, ROBOT_POS } from './layout'
import { RobotBody } from './RobotBody'
import { RobotHead } from './RobotHead'

/**
 * The robot: a layered white-shell body (RobotBody.tsx: torso, arms, hands, legs, feet) seated at the desk, and a
 * screen-faced head (RobotHead.tsx) that gently looks around. All dimensions live in ROBOT_BODY / ROBOT_HEAD in layout.ts.
 */
export function Robot() {
  const head = useRef<Group>(null)
  useFrame(({ clock }) => {
    if (!head.current || prefersReducedMotion) return
    head.current.rotation.y = ROBOT_HEAD_YAW + Math.sin(clock.elapsedTime * 0.5) * 0.05
    head.current.rotation.x = ROBOT_HEAD.pitch + Math.sin(clock.elapsedTime * 0.8) * 0.02
  })

  return (
    <group position={ROBOT_POS}>
      <RobotBody />
      {/* Head: screen-faced desktop-companion head (see RobotHead.tsx and ROBOT_HEAD in layout.ts) */}
      <group ref={head} position={ROBOT_HEAD.position} rotation={[ROBOT_HEAD.pitch, ROBOT_HEAD_YAW, 0]}>
        <RobotHead />
      </group>
    </group>
  )
}
