import { Box3, Group, Matrix4, Texture, Vector3 } from 'three'
import type { Material, Mesh, Object3D } from 'three'

/**
 * public/models/random_books.glb ("Random Books" by isnainul, CC BY 4.0, see public/models/CREDITS.md) holds twelve separate books
 * (nodes Buku1 ... Buku12) spread far apart, plus an empty "Lamp" node that is dropped. Geometry, UVs and materials are used exactly as
 * supplied. This module only:
 *  1. lifts each book out of the file's node tree, keeping its full world transform (so any scale the artist baked in is kept);
 *  2. turns Buku7 half a turn about its own vertical axis. Measured on the file, eleven books have their spine on +x; Buku7 ("Take
 *     Flight") is the one mirrored the other way, with its spine on -x;
 *  3. measures every book, so Shelf.tsx can pack them tightly and stand them on a shelf.
 * In the model's frame the books stand upright (+y), their spines face +x and their thickness runs along z.
 */
const BOOK_NAME = /^Buku\d+$/
const SPINE_ON_MINUS_X = new Set(['Buku7'])

export interface PreparedBook {
  name: string
  node: Object3D
  /** Bounding box in model space, after any flip. */
  min: Vector3
  max: Vector3
}

export function prepareBooks(scene: Object3D): PreparedBook[] {
  const root = scene.clone(true)
  root.updateMatrixWorld(true)
  const found: Object3D[] = []
  root.traverse((o) => { if (BOOK_NAME.test(o.name)) found.push(o) })

  const holder = new Group()
  const result: PreparedBook[] = []
  for (const node of found) {
    const world = node.matrixWorld.clone()
    node.removeFromParent()
    node.matrixAutoUpdate = false
    node.matrix.copy(world)
    holder.add(node)
    holder.updateMatrixWorld(true)

    if (SPINE_ON_MINUS_X.has(node.name)) {
      const c = new Box3().setFromObject(node).getCenter(new Vector3())
      const flip = new Matrix4().makeTranslation(c.x, c.y, c.z)
        .multiply(new Matrix4().makeRotationY(Math.PI))
        .multiply(new Matrix4().makeTranslation(-c.x, -c.y, -c.z))
      node.matrix.premultiply(flip)
      holder.updateMatrixWorld(true)
    }

    const box = new Box3().setFromObject(node)
    result.push({ name: node.name, node, min: box.min.clone(), max: box.max.clone() })
  }
  // The file's own order is Buku1 ... Buku12.
  return result.sort((a, b) => Number(a.name.slice(4)) - Number(b.name.slice(4)))
}

/** Sharper spine lettering at the shallow angle the room camera sees the books from; materials are otherwise left as supplied. */
export function sharpenBookTextures(books: PreparedBook[], anisotropy = 8) {
  const seen = new Set<Texture>()
  for (const b of books) {
    b.node.traverse((o) => {
      const mesh = o as Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = false
      mesh.receiveShadow = false
      const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as Material[]
      for (const m of mats) {
        const map = (m as { map?: Texture | null }).map
        if (map && !seen.has(map)) { seen.add(map); map.anisotropy = Math.max(map.anisotropy, anisotropy); map.needsUpdate = true }
      }
    })
  }
}
