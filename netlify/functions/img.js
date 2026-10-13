import { json, fail, isAdmin, store, readBody } from './_shared.js'

/* 图片单独存，不塞进产品数据里。
   一张 500KB 的图转 base64 会变成 670KB，6 张就是 4MB，
   整个产品数据塞进 Blobs 会写失败。所以图片走这里，按 key 存。 */

const PREFIX = 'img/'

/* 存储时把 type 放进 metadata，读的时候可能拿不到，按扩展名兜底 */
const MIME = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', avif: 'image/avif',
}
function guessType(key) {
  const ext = (key.split('.').pop() || '').toLowerCase()
  return MIME[ext] || 'application/octet-stream'
}

export default async (req) => {
  /* GET /api/img?k=img_xxx —— 取图片 */
  if (req.method === 'GET') {
    const k = new URL(req.url, 'http://x').searchParams.get('k')
    if (!k || !k.startsWith(PREFIX)) return fail(400, 'bad key')
    try {
      /* get(key, {type:'blob'}) 返回的就是 Blob 本身，不是 {body,type} 包装。
         Content-Type 从存储时的 metadata 拿，拿不到就按扩展名猜。 */
      const blob = await store().get(k, { type: 'blob' })
      const meta = await store().getMetadata(k).catch(() => null)
      const ct = (meta && meta.metadata && meta.metadata.type) || guessType(k)
      return new Response(blob, {
        status: 200,
        headers: {
          'Content-Type': ct,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      })
    } catch (e) {
      return fail(404, 'not found')
    }
  }

  /* POST /api/img  body: { name, type, data(base64) } */
  if (req.method === 'POST') {
    if (!isAdmin(req)) return fail(401, 'غير مصرح')
    const body = await readBody(req)
    const { name, type } = body
    /* 两种体：
       { data }                     —— 一张图，老调用方式，还能用
       { variants: [{data,w,h}] }  —— 三档尺寸一起传（后台新走这条）
       后者是为了让手机下小的那份：一档 1600 的图，手机下起来能拖慢整页。 */
    const variants = Array.isArray(body.variants) && body.variants.length
      ? body.variants
      : (body.data ? [{ data: body.data, w: 0, h: 0 }] : null)
    if (!variants || !variants.length) return fail(400, 'no data')

    const ext = (name || 'img.jpg').split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
    const ct = type || guessType('x.' + ext)
    const stamp = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)

    /* 存三档。key 里带上宽度，GET 时也能知道这档多宽。 */
    const saved = []
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i]
      if (!v || !v.data) continue
      const buf = Buffer.from(String(v.data).split(',')[1] || v.data, 'base64')
      if (buf.length > 3 * 1024 * 1024) return fail(413, 'image too large (max 3MB)')
      const w = Number(v.w) || 0
      const h = Number(v.h) || 0
      /* 同一批的档位用同一个 stamp，只有宽度不同 —— 靠这个能推回同批。
         键名短一点，Blobs 键名也是要占地方的。 */
      const key = PREFIX + stamp + '-' + w + '.' + ext
      await store().set(key, buf, { type: ct, metadata: { name: name || key, type: ct, w, h } })
      saved.push({ url: '/api/img?k=' + key, w, h, size: buf.length, key })
    }
    if (!saved.length) return fail(400, 'no data')

    /* 主图挑最大的那档（存的是 width，缺了按数组末尾算） */
    const main = saved.reduce((a, b) => ((b.w || 0) >= (a.w || 0) ? b : a))
    return json(200, {
      ok: true,
      data: {
        key: main.key,
        url: main.url,
        size: main.size,
        width: main.w,
        height: main.h,
        /* 三档全给回去，前台塞 srcset 让浏览器自己挑 */
        variants: saved,
      },
    })
  }

  return fail(405, 'method not allowed')
}
