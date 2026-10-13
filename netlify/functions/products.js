import { ok, fail, readBlob, writeBlob, isAdmin, readBody } from './_shared.js'

/* GET  /api/products  -> 读所有产品
   PUT  /api/products  -> 覆盖所有产品（需管理员） */

const KEY = 'products'

export default async (req) => {
  if (req.method === 'GET') {
    return ok(await readBlob(KEY, { products: [] }))
  }

  if (req.method === 'PUT') {
    if (!isAdmin(req)) return fail(401, 'غير مصرح')
    const body = await readBody(req)
    const list = body.products
    if (!Array.isArray(list)) return fail(400, 'products must be an array')
    await writeBlob(KEY, { products: list })
    return ok({ count: list.length })
  }

  return fail(405, 'method not allowed')
}
