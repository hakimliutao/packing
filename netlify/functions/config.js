import { ok, fail, tokenConfigured, isAdmin } from './_shared.js'

/* /api/config —— 后台启动时问一句"我能进吗"。

   逻辑很简单，直接告诉前端该怎么办：
   needToken = 要不要弹密钥输入框
   reason    = 为什么要（显示给用户看）

   这个接口不碰任何产品数据，公开访问无害。 */

export default async (req) => {
  if (req.method !== 'GET') return fail(405, 'method not allowed')

  if (!tokenConfigured()) {
    /* 服务器还没配 ADMIN_TOKEN。写操作会被拒绝（这是故意的），
       但后台要能读、能看见你发了什么内容，只是改不了。
       提示你去 Netlify 后台补上这个变量。 */
    return ok({ needToken: false, canEdit: false, reason: 'not_configured' })
  }

  if (isAdmin(req)) {
    return ok({ needToken: false, canEdit: true, reason: 'ok' })
  }

  return ok({ needToken: true, canEdit: false, reason: 'need_token' })
}
