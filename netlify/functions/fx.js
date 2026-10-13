import { json, fail, isAdmin, store, readBody } from './_shared.js'

/* ==========================================================================
   fx — 海湾六国汇率
   --------------------------------------------------------------------------
   每小时拉一次，缓存在 Blobs。前台每次打开都打这个接口，
   不缓存的话一个访客一次请求，六国汇率换算这条链就没法做。

   为什么自己缓存而不是让前端直接拉 exchangerate：
   1. 前端直接拉会暴露 API key（免费版也要 key）
   2. 汇率一天变不了几次，缓存住能把外部请求降到每天 24 次
   3. 断网时前端还有兜底值，页面不会开天窗

   汇率方向统一是「1 单位该货币 = 多少 AED」，跟前端 fallbackRates 一致。
   1 KWD ≈ 12.15 AED —— 注意币值排序，KWD 数字最小但值最大，
   不能按数字大小排国家。 */

const KEY = 'fx-cache'
const TTL = 60 * 60 * 1000      /* 1 小时 */
const CCY = ['AED', 'SAR', 'KWD', 'BHD', 'OMR', 'QAR']

/* 拿不到实时汇率时的兜底值（1 该货币 = X AED）。
   数字量级要对：1 KWD ≈ 12.15 AED → 0.0823；
   1 SAR ≈ 0.915 AED。宁可不够准，也不能让价格显示错位。 */
const FALLBACK = {
  AED: 1, SAR: 1.0926, KWD: 0.0823, BHD: 0.0982, OMR: 0.3847, QAR: 1.0107,
}

/* 从 exchangerate.host 拿。以 AED 为基准换算，
   它给的是「1 AED = X 外币」，取倒数才是我们要的方向。 */
async function fetchRates() {
  const src = 'AED'
  const url = 'https://api.exchangerate.host/live?source=' + src +
              '&currencies=' + CCY.filter(c => c !== src).join(',')

  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), 6000)   /* 6 秒拿不到就算了，用旧的 */
  try {
    const res = await fetch(url, { signal: ctl.signal })
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const j = await res.json()
    if (!j || !j.rates) throw new Error('no rates field')

    /* rates 是「1 AED = X 外币」，取倒数变成「1 外币 = X AED」 */
    const out = { AED: 1 }
    for (const c of CCY) {
      if (c === src) continue
      const v = Number(j.rates[c])
      if (v > 0) out[c] = 1 / v
    }
    /* 少一档就当这次失败，继续用旧的 ——
       缺了币种的话前台会显示错价格，比慢一点严重 */
    if (Object.keys(out).length < 4) throw new Error('incomplete rates')
    return { rates: out, at: Date.now(), source: 'exchangerate.host' }
  } finally {
    clearTimeout(timer)
  }
}

/* 读缓存；顺手判断要不要刷新 */
async function getFx(force) {
  let cache = null
  try {
    cache = await store().get(KEY, { type: 'json' })
  } catch (e) { /* 没存过，正常 */ }

  const fresh = cache && cache.rates &&
                (Date.now() - (cache.at || 0)) < TTL && !cache.manual

  if (fresh && !force) {
    return { rates: cache.rates, at: cache.at, stale: false, source: cache.source || 'cache' }
  }

  try {
    const got = await fetchRates()
    /* 后台手动锁过汇率就只更新 fetchedAt，别覆盖手动值 */
    if (!cache || !cache.manual) {
      await store().setJSON(KEY, got)
    }
    return { rates: got.rates, at: got.at, stale: false, source: got.source }
  } catch (e) {
    /* 拉不到：有旧值就用旧的并标 stale，没旧值才用兜底 */
    if (cache && cache.rates) {
      return { rates: cache.rates, at: cache.at, stale: true, source: 'cache-stale' }
    }
    return { rates: FALLBACK, at: 0, stale: true, source: 'fallback' }
  }
}

export default async (req) => {
  /* GET /api/fx —— 前台拿汇率（缓存一天，汇率不会几分钟一变） */
  if (req.method === 'GET') {
    const fx = await getFx(false)
    /* Netlify 在每个请求上挂了 x-nf-geo 头，里面有访客国家。
       靠它做「首次打开自动选货币」——但只是默认，
       前端记住用户手选之后就以用户的选择为准。 */
    let country = ''
    try {
      const geo = JSON.parse((req.headers && req.headers.get && req.headers.get('x-nf-geo')) || '{}')
      country = (geo.country && geo.country.code) || ''
    } catch (e) { country = '' }

    return json(200, {
      ok: true,
      data: {
        rates: fx.rates,
        at: fx.at,
        /* stale=true 时前台该知道「这个数可能不是最新的」 */
        stale: fx.stale,
        source: fx.source,
        country: country,
      },
    })
  }

  /* PUT /api/fx —— 后台手动锁汇率。
     汇率剧烈波动、或外部接口挂了的时候应急用。
     body: { rates: {AED:1, SAR:...}, on: true } */
  if (req.method === 'PUT') {
    if (!isAdmin(req)) return fail(401, 'غير مصرح')
    const body = await readBody(req)

    if (body.action === 'unlock') {
      let cache = {}
      try { cache = await store().get(KEY, { type: 'json' }) || {} } catch (e) {}
      delete cache.manual
      try {
        const got = await fetchRates()
        cache = Object.assign(got, { manual: false })
      } catch (e) {
        cache.manual = false      /* 拉不到就保留旧值，只解开锁定 */
      }
      await store().setJSON(KEY, cache)
      return json(200, { ok: true, data: { unlocked: true, rates: cache.rates } })
    }

    const src = body.rates
    if (!src || typeof src !== 'object') return fail(400, 'rates required')

    /* 只收六国，AED 强制为 1（基准不能改，改了整个价格体系都错） */
    const out = { AED: 1 }
    for (const c of CCY) {
      if (c === 'AED') continue
      const v = Number(src[c])
      if (v > 0 && isFinite(v)) out[c] = v
    }
    if (Object.keys(out).length < 4) return fail(400, 'missing currencies')

    await store().setJSON(KEY, {
      rates: out, at: Date.now(), source: 'manual', manual: true,
    })
    return json(200, { ok: true, data: { locked: true, rates: out } })
  }

  /* POST /api/fx —— 强制刷新一次（后台点「刷新汇率」用） */
  if (req.method === 'POST') {
    if (!isAdmin(req)) return fail(401, 'غير مصرح')
    const fx = await getFx(true)
    return json(200, {
      ok: true,
      data: { rates: fx.rates, at: fx.at, stale: fx.stale, source: fx.source },
    })
  }

  return fail(405, 'method not allowed')
}