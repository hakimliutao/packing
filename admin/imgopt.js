/* 图片压缩 —— 上传前在浏览器里做完，不让原图跑到服务器上。

   为什么必须有这一步（实测过的坑）：
   之前后台只提示「单张压在 200KB」，但没有任何压缩程序。
   大哥拿手机拍的 PNG 有 3~5MB，原样存原样发 —— 线上实测一张 banner
   1.5MB，第一次打开总耗时 30 秒。手机更要命：屏幕上显示 200px 宽，
   却要下 1600px 的原图。

   这里做三件事：
   1. 缩到合理尺寸（再大的图，网页上用不着那个像素）
   2. 转 WebP（同样画质小 10 倍），不支持的浏览器回退 JPG
   3. 一次生成三档，让手机下小的那份

   压缩全在浏览器本地完成，不额外上传一次，服务器收到的就是压好的图。 */

/* 三档尺寸：手机 / 平板 / 桌面。
   再大的图前端也缩到 1600 以内 —— 详情页灯箱最多也就撑满一个屏。 */
const SIZES = [400, 900, 1600];

/* 质量 0.82 是肉眼几乎看不出差别、体积又小一大截的档位。
   0.9 以上体积涨得快，0.75 以下 Logo 和细字会发毛。 */
const QUALITY = 0.82;

/* 低于这个体积就不再压了，已经够小 */
const SKIP_BELOW = 90 * 1024;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error('图片读不出来，可能不是图片文件'));
    im.src = src;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise(resolve => {
    canvas.toBlob(b => resolve(b), type, quality);
  });
}

/* 缩到宽高都不超过 maxSide，保持原比例。不放大小图 ——
   把小图拉大会糊，浏览器显示时会自己插值，拉了纯亏。 */
function fitTo(img, maxSide) {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (w <= maxSide && h <= maxSide) return { w, h, scale: 1 };
  const scale = maxSide / Math.max(w, h);
  return { w: Math.max(1, Math.round(w * scale)),
           h: Math.max(1, Math.round(h * scale)), scale };
}

function drawOn(img, w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  /* 透明 PNG 压成 WebP 时，底下不铺白的话透明区会变黑。
     先铺一层白，跟设计稿里「白底」的直觉一致。 */
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return c;
}

function readAsDataURL(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(new Error('读取文件失败'));
    fr.readAsDataURL(blob);
  });
}

/* 这个浏览器能不能出 WebP —— 老 Safari 会返回 null，不支持就只用 JPG */
let _webpOK = null;
async function webpSupported() {
  if (_webpOK !== null) return _webpOK;
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    const b = await canvasToBlob(c, 'image/webp', 0.5);
    _webpOK = !!b && b.type === 'image/webp' && b.size > 0;
  } catch (e) {
    _webpOK = false;
  }
  return _webpOK;
}

/* 传一个 File，返回 { url, width, height, sizes, bytes }
     url   —— 主图地址（挑中间那档，前台默认用它）
     sizes —— 三档的地址数组，前台塞进 srcset，浏览器自己挑
   本地模式（没上线）也走这里，压缩完再存 base64。 */
async function compressImage(file) {
  if (!file) throw new Error('لم يتم اختيار ملف');
  if (!/^image\//.test(file.type)) throw new Error('الملف ليس صورة');

  /* SVG 是矢量图，压缩没意义还会糊，直接原样放行 */
  if (file.type === 'image/svg+xml') {
    return { url: await readAsDataURL(file), width: 0, height: 0,
             sizes: [], bytes: file.size, raw: true };
  }

  /* GIF 动图压了会丢帧，别碰 */
  if (file.type === 'image/gif') {
    return { url: await readAsDataURL(file), width: 0, height: 0,
             sizes: [], bytes: file.size, raw: true };
  }

  /* 已经很小的不折腾了，省时间也避免二次有损压缩 */
  if (file.size < SKIP_BELOW) {
    return { url: await readAsDataURL(file), width: 0, height: 0,
             sizes: [], bytes: file.size, raw: true };
  }

  const src = await readAsDataURL(file);
  let img;
  try {
    img = await loadImage(src);
  } catch (e) {
    /* 读不出来的图别拦着大哥 —— 原样传，总比传不上去强 */
    console.warn('[imgopt] 解码失败，原样上传', e);
    return { url: src, width: 0, height: 0, sizes: [], bytes: file.size, raw: true };
  }

  const useWebp = await webpSupported();
  const type = useWebp ? 'image/webp' : 'image/jpeg';
  const ext = useWebp ? 'webp' : 'jpg';
  const origW = img.naturalWidth, origH = img.naturalHeight;

  const out = [];
  for (const maxSide of SIZES) {
    const { w, h, scale } = fitTo(img, maxSide);
    const c = drawOn(img, w, h);
    const blob = await canvasToBlob(c, type, QUALITY);
    if (!blob) break;
    out.push({
      maxSide, width: w, height: h, blob,
      data: await readAsDataURL(blob),
    });
    /* 这一档已经等于原图尺寸（scale===1），后面几档只会更小 —— 到这收工。
       注意是「先 push 再 break」：原图刚好 1600 宽时，1600 这档就是
       桌面端要用的 largest，必须留着。写反了会只剩 400/900 两档。 */
    if (scale === 1) break;
  }

  if (!out.length) {
    return { url: src, width: origW, height: origH, sizes: [], bytes: file.size, raw: true };
  }

  /* 主图取最大那档 —— 前台 srcset 会让浏览器自己挑小的，
     这个 url 是给不支持 srcset 的老浏览器兜底的，清晰度优先。
     跟 netlify/functions/img.js 里挑主图的规则保持一致。 */
  const main = out[out.length - 1];
  return {
    url: main.data,
    width: origW,
    height: origH,
    type,
    ext,
    bytes: main.blob.size,
    originalBytes: file.size,
    /* 每档都带宽度描述，srcset 靠它匹配 */
    sizes: out.map(o => ({ url: o.data, w: o.width, h: o.height })),
  };
}

/* 把压缩结果传上去。三档一次传完，返回 { url, variants }。
   variants 里的地址直接塞 srcset，浏览器按屏幕宽度自己挑 ——
   这一步才是手机变快的关键：只存一张大图，手机照样要下全尺寸。 */
/* r22 修：形参原来叫 adminHeaders，跟 api.js 里那个函数同名，
   三个调用方（admin.js 两处、import.js 一处）传进来的都是
   window.AR_ADMIN_HEADERS() 的**执行结果**（一个对象），
   但函数体里写的是 headers: adminHeaders() —— 把对象当函数调，
   一上传就报「adminHeaders is not a function」。
   形参改名成 hdrs（headers 的缩写），直接当对象用。 */
async function uploadCompressed(file, hdrs, base) {
  const r = await compressImage(file);

  if (r.raw) {
    /* 原样放行的（SVG / GIF / 已很小）走老路直接传 */
    const res = await fetch(base + 'api/img', {
      method: 'POST',
      headers: hdrs,
      body: JSON.stringify({ name: file.name, type: file.type, data: r.url }),
    });
    const j = await res.json();
    if (!res.ok || j.ok === false) throw new Error(j.error || ('HTTP ' + res.status));
    return { url: j.data.url, variants: [], width: r.width, height: r.height, bytes: file.size };
  }

  const res = await fetch(base + 'api/img', {
    method: 'POST',
    headers: hdrs,
    body: JSON.stringify({
      name: file.name,
      type: r.type,
      variants: r.sizes.map(s => ({ data: s.url, w: s.w, h: s.h })),
    }),
  });
  const j = await res.json();
  if (!res.ok || j.ok === false) throw new Error(j.error || ('HTTP ' + res.status));

  return {
    url: j.data.url,
    variants: (j.data.variants || []).map(v => ({ url: v.url, w: v.w, h: v.h })),
    width: r.width,
    height: r.height,
    bytes: r.bytes,
    originalBytes: r.originalBytes,
  };
}

/* 一行提示，告诉大哥省了多少 —— 看得见的省才会继续传好图 */
function savedText(r) {
  if (!r || r.raw || !r.originalBytes) return '';
  const saved = Math.round((1 - r.bytes / r.originalBytes) * 100);
  if (saved < 5) return '';
  const kb = Math.round(r.bytes / 1024);
  return `تم ضغط الصورة ${kb} KB (أقل ${saved}%)`;
}

/* 这个文件用普通 <script> 加载（不是 module），所以挂 window 给 admin.js / import.js 用。
   放在文件末尾，保证上面都定义完了。 */
window.compressImage = compressImage;
window.uploadCompressed = uploadCompressed;
window.readAsDataURL = readAsDataURL;
window.IMG_SIZES = SIZES;
