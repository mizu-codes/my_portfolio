import type { ReactNode } from 'react'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'
import { PEGBOARD_POS } from './layout'
import { Board } from './pegboard/Board'
import { Cable } from './pegboard/Cable'
import { Charm } from './pegboard/Charm'
import { Headphones } from './pegboard/Headphones'
import { Hook } from './pegboard/Hook'
import { IdCard } from './pegboard/IdCard'
import { Keys } from './pegboard/Keys'
import { Stickers } from './pegboard/Stickers'
import { Backlight } from './pegboard/Backlight'
import { ARM_Z, HOOKS, hookAnchor, type HookSpec } from './pegboard/layout'

RectAreaLightUniformsLib.init()

/** The whole board (and everything on it) is built at 1.30 m and scaled up so its contents read clearly from the default camera. */
const BOARD_SCALE = 1.05
const FILL = 0.65

/** A hanging object's pivot sits on the hook arm's centre line, so rotating the group named `pivot:*` inside swings it about the real hook. */
function OnHook({ spec, name, scale = 1, children }: { spec: HookSpec; name: string; scale?: number; children: ReactNode }) {
  const [x, y] = hookAnchor(spec)
  return <group name={`hang:${name}`} position={[x, y, ARM_Z]} scale={scale}>{children}</group>
}

/**
 * Wall pegboard: a perforated charcoal steel panel lit only by the room's own lights (with its own concealed four-sided LED backlight (cool lavender-white)), with every accessory a
 * separate named group so it can be animated later.
 *   pegboard-panel, stickers, hook:*, hang:* → pivot:* → swing:*
 * Beneath it the original speaker ledge is unchanged.
 */
export function Pegboard() {
  const [px, py, pz] = PEGBOARD_POS
  return (
    <group>
      {/* Broad, soft, neutral-cool fill in front of the board (replaces the old amber point light that tinted the steel brown).
          It only lets the hooks, headphones and lanyards read their true colours; the LED backlight is the board's own separate glow. */}
      <rectAreaLight name="pegboard-fill" color="#e8e6ff" intensity={FILL} width={1.8} height={0.9} position={[px, py - 0.1, pz + 1.3]} />
      <group name="pegboard" position={[px, py, pz]} scale={BOARD_SCALE}>
        <Backlight />
        <Board />
        <Stickers />

        {(Object.keys(HOOKS) as (keyof typeof HOOKS)[]).map((k) => <Hook key={k} spec={HOOKS[k]} name={`hook:${k}`} />)}

        {/* Two access badges: hooks near the top edge, long lanyards, badges hanging well below the board's lower edge */}
        <OnHook spec={HOOKS.idMizhan} name="id-mizhan" scale={1.3}>
          <IdCard
            id_="id-mizhan" name="Mizhan" role="Full Stack Developer" id="ID 0417 · FS-01"
            accent="#7d4fdc" accentDeep="#5530b0" lanyard="#d84e4e" lanyardEdge="#5a35ae" drop={0.31}
          />
        </OnHook>
        <OnHook spec={HOOKS.idOlyvex} name="id-olyvex" scale={1.3}>
          <IdCard
            id_="id-olyvex" name="Olyvex" role="Project Team" id="ID 0418 · PT-02"
            accent="#14a69c" accentDeep="#0b7873" lanyard="#16a79d" lanyardEdge="#0e7c76" drop={0.32}
          />
        </OnHook>

        <OnHook spec={HOOKS.headphones} name="headphones" scale={1.2}><group name="pivot:headphones"><Headphones /></group></OnHook>
        <OnHook spec={HOOKS.cable} name="cable" scale={1.45}><Cable /></OnHook>
        <OnHook spec={HOOKS.keys} name="keys" scale={1.75}><Keys /></OnHook>
        <OnHook spec={HOOKS.charm} name="charm" scale={1.7}><Charm /></OnHook>
      </group>
     
    </group>
  )
}
