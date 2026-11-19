/**
 * TOA - Manual Modal Renderer
 * Renders quick reference sections and links to the full 5-language manual.html.
 */
const HelpManual = (() => {
  function renderModal(lang, titleEl, bodyEl, t) {
    const dict = (typeof I18N !== "undefined" && (I18N[lang] || I18N.ko)) || {};
    if (titleEl) titleEl.textContent = dict.mantitle || "사용자 매뉴얼";
    if (!bodyEl) return;

    const secs = Array.isArray(dict.manSecs) ? dict.manSecs : [];
    const secHtml = secs.map(s => `
      <div class="ms">
        <h3>${s.h}</h3>
        <ul>${(s.items || []).map(it => `<li>${it}</li>`).join("")}</ul>
      </div>
    `).join("");

    const fullManualLabel = dict.htmlmanual || "전체 전문 매뉴얼";
    bodyEl.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; background:var(--acbg); border:1px solid var(--bdr2); border-radius:10px; padding:12px 14px; margin-bottom:16px;">
        <div style="font-size:12.5px; font-weight:700; color:var(--tx);">
          Tubular Ovality &amp; Roller Analysis · v0.5 Beta
        </div>
        <a href="manual.html?lang=${encodeURIComponent(lang || "ko")}" target="_blank" rel="noopener"
           style="background:var(--ac); color:#fff; text-decoration:none; padding:7px 14px; border-radius:8px; font-size:12px; font-weight:800;">
          📖 ${fullManualLabel} ↗
        </a>
      </div>
      ${secHtml}
    `;
  }

  return { renderModal };
})();
window.HelpManual = HelpManual;
