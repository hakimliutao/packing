/* 公用函数：Blobs 读写 + 管理员身份验证
   Netlify Blobs 免费额度 1GB，够用很久 */

import { getStore } from '@netlify/blobs'

/* 所有产品/分类/设置共用一个 store，用 key 区分 */
const STORE = 'site-data'

export function store() {
  return getStore({ name: STORE, consistency: 'strong' })
}

/* Netlify Functions（v2 运行时）只认真正的 Response 对象，
   早返回 {statusCode, body} 会报 "Function returned an unsupported value"。 */
export function json(statusCode, body) {
  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

export function ok(data) {
  return json(200, { ok: true, data })
}

export function fail(statusCode, message) {
  return json(statusCode, { ok: false, error: message })
}

/* ---------- 管理员鉴权 ----------
   必须配环境变量 ADMIN_TOKEN（Site settings → Environment variables）。
   没配的话写操作一律拒绝——宁可后台进不去，也不能让任何人都能改产品。 */

/* 新版运行时传进来的是标准 Request，取头要用 .get()，
   .headers 是个 Headers 实例，不能当普通对象下标取值。 */
export function isAdmin(req) {
  const expected = process.env.ADMIN_TOKEN

  if (!expected) {
    console.error('[auth] ADMIN_TOKEN 未配置，写操作已全部拒绝。请到 Netlify 后台添加该环境变量。')
    return false
  }

  const headers = req.headers
  const supplied =
    (headers && typeof headers.get === 'function' && headers.get('x-admin-token')) ||
    (headers && typeof headers.get === 'function' &&
      (headers.get('authorization') || '').replace('Bearer ', '').trim())

  return supplied === expected
}

/* 标准 Request 没有 .body，要用 .text() 读，v1/v2 都能用 */
export async function readBody(req) {
  if (typeof req.text === 'function') {
    const t = await req.text()
    return t ? JSON.parse(t) : {}
  }
  return JSON.parse(req.body || '{}')
}

/* 有配 token 才算"已配置好"，用于判断前端要不要弹密钥框 */
export function tokenConfigured() {
  return !!process.env.ADMIN_TOKEN
}

/* 读取 blob，没有就用默认值 */
export async function readBlob(key, fallback) {
  try {
    const val = await store().get(key, { type: 'json' })
    return val === null || val === undefined ? fallback : val
  } catch (e) {
    return fallback
  }
}

export async function writeBlob(key, value) {
  await store().setJSON(key, value)
}
