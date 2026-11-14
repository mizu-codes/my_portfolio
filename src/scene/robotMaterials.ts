import { MeshBasicMaterial, MeshStandardMaterial } from 'three'
import { colors } from '../config/theme'

/**
 * Materials shared by every part of the robot's body and hands (RobotBody.tsx, RobotHand.tsx). One instance each, so the ~150 body
 * meshes do not create ~150 materials. The values are the ones the body already used, so the look stays consistent with the head.
 */

/** White ceramic outer plating. */
export const SHELL_MAT = new MeshStandardMaterial({ color: colors.robot, roughness: 0.32, metalness: 0.08 })
/** Slightly cooler, darker white for layered plates and bands. */
export const PANEL_MAT = new MeshStandardMaterial({ color: colors.robotPanel, roughness: 0.36, metalness: 0.1 })
/** Dark mechanical joints and the gaps between plates. */
export const JOINT_MAT = new MeshStandardMaterial({ color: colors.robotJoint, roughness: 0.5, metalness: 0.35 })
/** Brushed metal for hinge pins and the wrist and ankle collars. */
export const METAL_MAT = new MeshStandardMaterial({ color: colors.robotMetal, roughness: 0.3, metalness: 0.75 })
/** Black glass of the chest core. */
export const GLASS_MAT = new MeshStandardMaterial({ color: colors.robotGlass, roughness: 0.2, metalness: 0.3 })
/** Unlit cyan accent, the same colour as the face. */
export const CYAN_MAT = new MeshBasicMaterial({ color: colors.cyan, toneMapped: false })
