/* ================== 更多问题页 ==================
   首页只摆前几条（「المزيد」按钮跳过来），全部在这里列。

   跟首页同一套逻辑：后台 site.faqs.items 有数据就用后台的，
   没有就保持 HTML 里写死的那 12 条（SEO 靠这些静态内容）。
   顺序：后台的排前面，HTML 里没被后台覆盖的接在后面 ——
   这样大哥在后台加新问题时，老问题不会凭空消失。 */
async function initFaq() {
  await boot('faq');
  const { site, tax } = CTX;
  const ui = tax.ui || {};
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v || ''; };

  const faqBlk = site.faqs || {};
  set('faq-kicker', faqBlk.kickerAr || ui.faqKickerAr || 'أسئلة شائعة');
  set('faq-title', faqBlk.titleAr || ui.faqTitleAr || 'أسئلة يسألها العملاء');
  set('faq-lead', faqBlk.leadAr || ui.faqLeadAr ||
      'جمعنا هنا أكثر ما يسأل عنه العملاء قبل ما يبدأون طلبهم. لو ما لقيت جوابك، راسلنا على واتساب ونرد مباشرة.');
  set('crumb-here', faqBlk.titleAr || ui.faqTitleAr || 'الأسئلة الشائعة');

  const mine = (faqBlk.items || [])
    .filter(x => (x.qAr || '').trim())
    .sort((a, b) => (a.sort || 99) - (b.sort || 99))
    .map(x => ({ q: x.qAr.trim(), a: (x.aAr || '').trim() }));

  if (mine.length) {
    const list = document.getElementById('faq-all');
    if (list) {
      /* HTML 里写死的问题里，跟后台问题重复的（同样的问法）就不重复列 */
      const mineQ = new Set(mine.map(x => x.q));
      const rest = [...list.querySelectorAll('details.faq-item')]
        .filter(d => !mineQ.has((d.querySelector('summary') || {}).textContent.trim()))
        .map(d => ({
          q: (d.querySelector('summary') || {}).textContent.trim(),
          a: (d.querySelector('p') || {}).textContent.trim(),
        }))
        .filter(x => x.q);
      const all = mine.concat(rest);
      list.innerHTML = all.map(f => `
        <details class="faq-item">
          <summary>${esc(f.q)}</summary>
          <p>${esc(f.a)}</p>
        </details>`).join('');
      const c = document.getElementById('faq-all-count');
      if (c) c.textContent = all.length + ' ' + (ui.faqsCntAr || 'سؤال');
    }
  }

  paintFavs();
}

initFaq().catch(e => console.error('[faq]', e));
