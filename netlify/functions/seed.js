import { ok, fail, writeBlob, store } from './_shared.js'

/* 一次性初始化：把 data/*.json 的内容灌进 Blobs

   浏览器直接打开这个网址就能跑，不用密钥、不用命令行。

   数据用 import 直接打包进函数，不依赖运行时读文件，
   这样无论 Netlify 把函数部署在哪都能读到。

   这个接口不校验密钥，真正的保护是下面那道：
   已经初始化过就一律拒绝，所以别人只能在你还没初始化时
   调用一次，灌进去的也就是你自己那份初始数据，没有破坏性。 */

import productsSeed from '../../data/products.json'
import categoriesSeed from '../../data/categories.json'
import siteSeed from '../../data/site.json'

export default async (req) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return fail(405, 'POST only')
  }

  /* 已经初始化过就直接拒绝 */
  try {
    const existing = await store().get('products', { type: 'json' })
    if (existing && Array.isArray(existing.products) && existing.products.length) {
      return fail(409, 'already seeded')
    }
  } catch (e) {
    /* 不存在，继续初始化 */
  }

  await writeBlob('products', productsSeed)
  await writeBlob('categories', categoriesSeed)
  await writeBlob('site', siteSeed)

  return ok({
    products: productsSeed.products.length,
    categories: categoriesSeed.categories.length,
    sectors: categoriesSeed.sectors.length,
    brand: siteSeed.brand?.nameAr,
  })
}
