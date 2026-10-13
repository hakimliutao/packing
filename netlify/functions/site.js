import { ok, fail, readBlob, writeBlob, isAdmin, readBody } from './_shared.js'

/* GET/PUT /api/site —— 品牌名、WhatsApp 号码、首屏文案、CTA */

const KEY = 'site'

export default async (req) => {
  if (req.method === 'GET') {
    return ok(await readBlob(KEY, {}))
  }

  if (req.method === 'PUT') {
    if (!isAdmin(req)) return fail(401, 'غير مصرح')
    const body = await readBody(req)
    await writeBlob(KEY, body)
    return ok({ brand: body.brand?.nameAr })
  }

  return fail(405, 'method not allowed')
}
