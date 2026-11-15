import { useEffect, useMemo } from 'react'
import { InstancedBufferAttribute, InstancedMesh, Matrix4, PlaneGeometry } from 'three'
import { GROUND_Y } from './cityConfig'
import { blobAt, cylAt, mergeAll, paint } from './cityGeometry'
import type { RectData, TreeData } from './cityLayout'
import { PalmTrees, usePalm } from './PalmTrees'
import { makeSolidMaterial } from './solidMaterial'

function treeGeometry(detail: number) {
  const trunk: [number, number, number, number] = [0.085, 0.058, 0.04, 0]
  const leaf: [number, number, number, number] = [0.16, 0.42, 0.19, 1]
  return mergeAll([
    cylAt(0.13, 2.4, 0, 1.2, 0, trunk, 5),
    blobAt(1.35, 0, 3.15, 0, leaf, detail, 0.9),
    blobAt(1.0, 0.75, 2.75, 0.25, leaf, detail, 0.9),
    blobAt(0.95, -0.7, 2.85, -0.3, leaf, detail, 0.9),
    blobAt(0.8, 0.1, 4.0, -0.1, leaf, detail, 0.95),
  ])
}
function shrubGeometry(detail: number) {
  const leaf: [number, number, number, number] = [0.14, 0.38, 0.17, 1]
  return mergeAll([blobAt(0.62, 0, 0.42, 0, leaf, detail, 0.75), blobAt(0.46, 0.5, 0.32, 0.12, leaf, detail, 0.75)])
}

/**
 * Roadside, entrance and park trees are palms (public/models/palm_tree.glb, see PalmTrees.tsx); shrubs and the pocket-park lawn
 * are low-poly and instanced. The old low-poly tree is only built as a fallback if the palm model fails to load.
 */
export function UrbanTrees({ trees, shrubs, parks, low }: { trees: TreeData[]; shrubs: TreeData[]; parks: RectData[]; low: boolean }) {
  const palm = usePalm()
  const fallback = palm.status === 'failed'
  const parts = useMemo(() => {
    const mat = makeSolidMaterial(GROUND_Y)
    const detail = low ? 0 : 1
    const mk = (geo: ReturnType<typeof treeGeometry>, data: TreeData[], baseScale: number) => {
      const mesh = new InstancedMesh(geo, mat, Math.max(data.length, 1))
      const m = new Matrix4()
      const tint = new Float32Array(Math.max(data.length, 1) * 3).fill(1)
      data.forEach((t, i) => {
        m.makeScale(t.s * baseScale, t.s * baseScale, t.s * baseScale)
        m.setPosition(t.x, GROUND_Y, t.z)
        mesh.setMatrixAt(i, m)
        tint.set(t.tint, i * 3)
      })
      geo.setAttribute('aInst', new InstancedBufferAttribute(tint, 3))
      mesh.count = data.length
      mesh.frustumCulled = false
      return mesh
    }
    const treeGeo = fallback ? treeGeometry(detail) : null, shrubGeo = shrubGeometry(detail)
    const treeMesh = treeGeo ? mk(treeGeo, trees, 1) : null
    const shrubMesh = mk(shrubGeo, shrubs, 1)

    // lawn + paths for each park
    const lawnGeo = paint(new PlaneGeometry(1, 1).rotateX(-Math.PI / 2), [0.09, 0.24, 0.12, 1])
    const lawn = new InstancedMesh(lawnGeo, mat, Math.max(parks.length * 2, 1))
    const lm = new Matrix4()
    const lt = new Float32Array(Math.max(parks.length * 2, 1) * 3).fill(1)
    parks.forEach((p, i) => {
      lm.makeScale(p.w, 1, p.d).setPosition(p.x, GROUND_Y + 0.03, p.z)
      lawn.setMatrixAt(i * 2, lm)
      lm.makeScale(2.4, 1, p.d * 0.95).setPosition(p.x, GROUND_Y + 0.06, p.z) // central path
      lawn.setMatrixAt(i * 2 + 1, lm)
      lt.set([1.5, 0.95, 1.1], (i * 2 + 1) * 3) // the path is pale paving, not grass
    })
    lawnGeo.setAttribute('aInst', new InstancedBufferAttribute(lt, 3))
    lawn.count = parks.length * 2
    lawn.frustumCulled = false
    return { mat, treeGeo, shrubGeo, lawnGeo, treeMesh, shrubMesh, lawn }
  }, [trees, shrubs, parks, low, fallback])
  useEffect(() => () => {
    parts.mat.dispose(); parts.treeGeo?.dispose(); parts.shrubGeo.dispose(); parts.lawnGeo.dispose()
    parts.treeMesh?.dispose(); parts.shrubMesh.dispose(); parts.lawn.dispose()
  }, [parts])
  return (
    <group>
      {parts.treeMesh && <primitive object={parts.treeMesh} />}
      {palm.status === 'ready' && <PalmTrees asset={palm.asset} trees={trees} low={low} />}
      <primitive object={parts.shrubMesh} />
      <primitive object={parts.lawn} />
    </group>
  )
}
