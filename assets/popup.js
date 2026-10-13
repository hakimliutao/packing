/* ============================ 弹层（点格子看说明） ============================
   r21 新增。用户要求：手机上「لماذا يختارنا عملاؤنا」那4 条压成 4 个小格一行，
   每格只留编号 + 标题，解释文字点了才看。

   为什么用弹层不用「往下展开」：展开会把下面的内容顶走，
   客户点第三个想看第一个，手机上就找不着了。弹层不改变页面高度。

   只在窄屏生效（≥761px 时说明文字本来就在卡里，不需要弹层）——
   data-desc 到处都带着，popup.js 自己按宽度判断要不要接管。 */
(function () {
  if (window.__popInit) return;
  window.__popInit = true;

  var box = null;

  function ensure() {
    if (box) return box;
    box = document.createElement('div');
    box.className = 'pop';
    box.setAttribute('role', 'dialog');
    box.hidden = true;
    box.innerHTML =
      '<div class="pop-card">' +
      '<button type="button" class="pop-x" aria-label="إغلاق">&times;</button>' +
      '<b class="pop-t"></b>' +
      '<p class="pop-d"></p>' +
      '</div>';
    document.body.appendChild(box);

    box.addEventListener('click', function (e) {
      /* 点遮罩或关闭按钮 → 关掉；点卡片内容 → 不关 */
      if (e.target === box || e.target.classList.contains('pop-x')) hide();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') hide();
    });
    return box;
  }

  function show(el) {
    var d = el.getAttribute('data-desc') || '';
    if (!d) return;
    /* 宽屏时说明就在卡里可见，不需要弹层 */
    if (window.matchMedia('(min-width:761px)').matches) return;

    var b = ensure();
    b.querySelector('.pop-t').textContent = (el.getAttribute('data-title') || '').trim();
    b.querySelector('.pop-d').textContent = d;
    b.hidden = false;
    /* 下一帧再加 .on，让 opacity 过渡生效 */
    requestAnimationFrame(function () { b.classList.add('on'); });
  }

  function hide() {
    if (!box || box.hidden) return;
    box.classList.remove('on');
    box.hidden = true;
  }

  /* 事件委托：卡片是动态渲染的，不能一个个绑定 */
  document.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('[data-desc]') : null;
    if (!el) return;
    /* 只有窄屏才拦截，宽屏让它正常当普通卡片 */
    if (window.matchMedia('(min-width:761px)').matches) return;
    if (!el.getAttribute('data-desc')) return;
    e.preventDefault();
    show(el);
  });

  /* 键盘可达：回车/空格也能打开 */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var el = e.target.closest ? e.target.closest('[data-desc][tabindex]') : null;
    if (!el) return;
    e.preventDefault();
    show(el);
  });
})();