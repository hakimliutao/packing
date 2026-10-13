import { ok, fail, readBlob, writeBlob, isAdmin, readBody } from './_shared.js'

/* GET/PUT /api/categories —— 分类、行业、页面文案 */

const KEY = 'categories'

export default async (req) => {
  if (req.method === 'GET') {
    return ok(await readBlob(KEY, { categories: [], sectors: [], features: [], nav: [], ui: {} }))
  }

  if (req.method === 'PUT') {
    if (!isAdmin(req)) return fail(401, 'غير مصرح')
    const body = await readBody(req)
    if (!Array.isArray(body.categories)) return fail(400, 'categories must be an array')
    await writeBlob(KEY, body)
    return ok({ categories: body.categories.length })
  }

  return fail(405, 'method not allowed')
}
