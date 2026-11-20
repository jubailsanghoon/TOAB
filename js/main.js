/**
 * TOA - Main UI Application Controller
 * Integrates TOAEngine, TOADiagram, DataStore, LicenseManager, HeaderKit & I18N.
 */
const BETA_ALLOWED_SUPPORTS = ["NATURAL", "SADDLE120", "TR2_45", "TR2_CUSTOM"];
const BETA_SAMPLE_SUPPORTS = ["TR2_491", "TR2_30", "TR4_STD", "TR4_CUSTOM", "DOUBLE_ROLLER"];

const App = {
  state: {
    lang: "ko",
    theme: "light",
    plan: "beta",
    lastResult: null,
    measMode: "abs",
    savCollapsed: false,
    records: []
  },

  init() {
    this.registerServiceWorker();
    this.checkKakaoInAppBanner();

    const savedDark = localStorage.getItem("HI_DARK_MODE") === "true" || localStorage.getItem("HI_THEME") === "dark";
    this.applyTheme(savedDark ? "dark" : "light", false);

    const savedLang = localStorage.getItem("HI_LANG") || "ko";
    this.state.lang = (typeof I18N !== "undefined" && I18N[savedLang]) ? savedLang : "ko";

    this.state.plan = "beta";
    this.state.records = DataStore.getRecords();

    if (typeof HeaderKit !== "undefined") {
      HeaderKit.init({
        version: "v0.5",
        isPro: false,
        defaultLang: this.state.lang,
        onThemeChange: (theme) => this.applyTheme(theme, false),
        onLanguageChange: (lang) => this.setLang(lang),
        onLicenseClick: () => this.openBetaNotice(false),
        onHelpClick: () => this.openManualModal()
      });
    }

    this.restoreLastState();
    this.applyLanguage();
    this.enforceBetaSupportSelection();
    this.onSupChange(false);
    this.onRmatChange(false);
    this.calcDT();
    this.calcRollerSets();
    this.renderMetrics();
    this.renderSampleMainDiagrams();
    this.renderMeas(this.state.lastResult);
    this.renderSaved();
    this.updatePlanBadge();
    this.bindNetworkEvents();
    if (this.shouldShowBetaNotice()) {
      this.openBetaNotice(true);
    }
  },

  _betaAutoCloseTimer: null,

  getLocalDateStamp() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  },

  shouldShowBetaNotice() {
    try {
      if (localStorage.getItem("TOAB_BETA_NOTICE_HIDE_FOREVER") === "1") return false;
      if (localStorage.getItem("TOAB_BETA_NOTICE_HIDE_DATE") === this.getLocalDateStamp()) return false;
    } catch (e) {}
    return true;
  },

  openBetaNotice(autoClose = false) {
    clearTimeout(this._betaAutoCloseTimer);
    document.getElementById("betaNoticeModal")?.classList.remove("hidden");
    if (autoClose) {
      this._betaAutoCloseTimer = setTimeout(() => {
        this.closeBetaNotice();
      }, 2000);
    }
  },

  closeBetaNotice(mode = "") {
    clearTimeout(this._betaAutoCloseTimer);
    this._betaAutoCloseTimer = null;
    try {
      if (mode === "today") {
        localStorage.setItem("TOAB_BETA_NOTICE_HIDE_DATE", this.getLocalDateStamp());
      } else if (mode === "forever") {
        localStorage.setItem("TOAB_BETA_NOTICE_HIDE_FOREVER", "1");
      }
    } catch (e) {}
    document.getElementById("betaNoticeModal")?.classList.add("hidden");
  },

  enforceBetaSupportSelection() {
    const sel = document.getElementById("i-sup");
    if (!sel) return;
    Array.from(sel.options).forEach(opt => {
      opt.disabled = false;
    });
  },

  t(key) {
    const dict = (typeof I18N !== "undefined" && (I18N[this.state.lang] || I18N.ko)) || {};
    return dict[key] !== undefined ? dict[key] : key;
  },

  registerServiceWorker() {
    try {
      if ("serviceWorker" in navigator && (location.protocol === "https:" || location.protocol === "http:")) {
        navigator.serviceWorker.register("./sw.js").catch(() => {});
      }
    } catch (e) {}
  },

  checkKakaoInAppBanner() {
    try {
      const ua = (navigator.userAgent || "").toLowerCase();
      if (ua.includes("kakaotalk")) {
        const overlay = document.getElementById("kakaoInAppOverlay");
        const banner = document.getElementById("kakaoInAppBanner");
        if (overlay) { overlay.classList.remove("hidden"); overlay.style.display = "flex"; }
        if (banner) { banner.classList.remove("hidden"); banner.style.display = "flex"; }
      }
    } catch (e) {}
  },

  escapeKakaoInApp() {
    const url = window.location.href;
    const ua = (navigator.userAgent || "").toLowerCase();
    if (/iphone|ipad|ipod/i.test(ua)) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(() => {
          alert("주소가 복사되었습니다!\nSafari 브라우저 주소창에 붙여넣기 하여 열어주세요.");
        }).catch(() => alert("Safari 브라우저로 접속해 주세요:\n" + url));
      } else {
        alert("Safari 브라우저로 접속해 주세요:\n" + url);
      }
    } else {
      try {
        location.href = "kakaotalk://web/openExternal?url=" + encodeURIComponent(url);
      } catch (e) {
        const rawHost = url.replace(/^https?:\/\//i, "");
        location.href = "intent://" + rawHost + "#Intent;scheme=https;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;end";
      }
    }
  },

  bindNetworkEvents() {
    const updateNet = () => {
      const online = navigator.onLine !== false;
      if (typeof HeaderKit !== "undefined") {
        HeaderKit.setNetStatus(online, online ? "온라인" : "오프라인");
      }
    };
    window.addEventListener("online", updateNet);
    window.addEventListener("offline", updateNet);
    updateNet();
  },

  handleNetBadgeClick() {
    const online = navigator.onLine !== false;
    this.toast(online ? "Online · Offline PWA Ready" : "Offline Mode Active");
  },

  applyTheme(theme, syncKit = true) {
    this.state.theme = theme === "dark" ? "dark" : "light";
    const isDark = this.state.theme === "dark";
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.setAttribute("data-theme", this.state.theme);
    try {
      localStorage.setItem("HI_DARK_MODE", isDark ? "true" : "false");
      localStorage.setItem("HI_THEME", this.state.theme);
    } catch (e) {}
    if (syncKit && typeof HeaderKit !== "undefined") {
      HeaderKit.setProStatus(false, "Beta", "trial");
    }
    if (this.state.lastResult) {
      this.drawDiag(this.state.lastResult);
    }
  },

  setLang(lang) {
    if (!I18N[lang]) return;
    this.state.lang = lang;
    this.applyLanguage();
    if (this.state.lastResult) {
      this.renderNat(this.state.lastResult);
      this.renderSup(this.state.lastResult);
      this.renderMeas(this.state.lastResult);
      this.renderMetrics(this.state.lastResult, this.state.lastResult.p);
      this.renderCompliance(this.state.lastResult);
      this.renderRecs(this.state.lastResult);
      this.renderOvalBendAlert(this.state.lastResult);
      this.drawDiag(this.state.lastResult);
      this.renderLdia(this.state.lastResult.p.D, this.state.lastResult.p.t);
      this.updateStat(this.state.lastResult);
    }
    this.onRmatChange();
    this.calcRollerSets();
    this.renderMetrics();
    this.renderSampleMainDiagrams();
    const D = +document.getElementById("iD").value || 0;
    const t = +document.getElementById("it").value || 0;
    const ev = TOAEngine.evaluateDT(D, t);
    this.renderBrazierAlert(ev);
    if (!this.state.lastResult) {
      this.updatePreAnalysisBuckling(ev);
    }
    this.renderSaved();
  },

  applyLanguage() {
    const x = I18N[this.state.lang] || I18N.ko;
    const s = (id, v) => { const e = document.getElementById(id); if (e && v !== undefined) e.textContent = v; };
    if (typeof HeaderKit !== "undefined") {
      HeaderKit.setTitle(x.appTitleFull, x.appTitleShort);
    }
    s("stat-txt", x.sIdle);
    s("t-tubspec", x.tubspec); s("t-rolspec", x.rolspec); s("t-std", x.std);
    s("t-field", x.field); s("t-rname", x.rname); s("t-rptsel", x.rptsel);
    s("t-rptcard", x.betaRptCardTtl || "리포트 발행 (Beta · PDF [샘플])");
    s("t-rptinc", x.rptIncLbl);
    s("t-ri-comp", x.tc); s("t-ri-cmp", x.tm); s("t-ri-diag", x.td); s("t-ri-recs", x.tr); s("t-ri-chk", x.tl);
    this.updateReportTargetMenu();
    s("t-lD", x.lD); s("t-lt", x.lt); s("t-lsup", x.lsup);
    s("t-lrdia", x.lrdia); s("t-lcc", x.lcc); s("t-lcl", x.lcl);
    s("t-lzone", x.lzone); s("t-lfat", x.lfat); s("t-lclim", x.lclim); s("t-lsettle", x.lsettle);
    s("t-lrcap", x.lrcap); s("t-madv", x.madv);
    s("t-lml", x.lml); s("t-lmm", x.lmm); s("t-lmr", x.lmr); s("t-lmbef", x.lmbef); s("t-lmaft", x.lmaft);
    s("t-lproj", x.lproj); s("t-lpipeno", x.lpipeno); s("t-lprep", x.lprep); s("t-lrev", x.lrev);
    s("t-ldmax", x.ldmax); s("t-ldmin", x.ldmin);
    s("t-ldevmin", x.ldevmin); s("t-ldevmax", x.ldevmax);
    s("t-run", x.run); s("t-cmp", x.cmp);
    s("t-save", x.save); s("t-imp", x.imp); s("t-exp", x.exp); s("t-csv", x.csv); s("t-xls", x.xls); s("t-pdf", x.betaPdfBtn || "📕 PDF [샘플]"); s("t-clr", x.clr);
    s("t-nat", x.nat); s("t-meas", x.meas); s("t-rolperf", x.rolperf);
    s("t-predsec", x.predsec); s("t-predsub", x.predsub);
    s("t-lplen", x.lplen); s("t-lnweld", x.lnweld);
    s("t-laweld", x.laweld); s("t-lplatespan", x.lplatespan);
    s("t-rspanel", x.rspanel); s("t-rsdefl", x.rsdefl); s("t-rshertz", x.rshertz);
    s("t-rsspan", x.rsspan); s("t-rsgov", x.rsgov);
    s("t-cslbl", x.cslbl); s("t-svlbl", x.svlbl);
    s("t-lasets", x.lasets); s("t-lrmat", x.lrmat);
    s("o-rmat-s", x.omatS); s("o-rmat-u", x.omatU);
    s("t-ph3", x.ph3);
    s("t-ma", x.ma); s("t-ml", x.ml); s("t-ms", x.ms); s("t-md", x.md);
    s("t-tc", x.tc); s("t-tm", x.tm); s("t-td", x.td); s("t-tr", x.tr); s("t-tl", x.tl);
    s("t-ph1", x.ph1); s("t-ph2", x.ph2);
    s("t-ph-tc", x.phTc); s("t-ph-tm", x.phTm); s("t-ph-td", x.phTd);
    s("t-ph-tr", x.phTr); s("t-ph-tl", x.phTl); s("t-ph-ts", x.phTs);
    s("t-savlist", x.savlist);
    s("t-tstog", this.state.savCollapsed ? x.savShow : x.savHide);
    const sampleTag = x.betaSampleTag || "[샘플]";
    s("o-nat", x.oNat); s("o-sad", x.oSad); s("o-t2a", `${x.oT2a} ${sampleTag}`); s("o-t2b", x.oT2b);
    s("o-t2c", `${x.oT2c} ${sampleTag}`); s("o-t2d", x.oT2d); s("o-t4a", `${x.oT4a} ${sampleTag}`); s("o-t4b", `${x.oT4b} ${sampleTag}`); s("o-dbl", `${x.oDbl} ${sampleTag}`);
    this.enforceBetaSupportSelection();
    s("o-body", x.oBody); s("o-end", x.oEnd); s("o-fn", x.oFn); s("o-ff", x.oFf);

    // Beta v0.5 다국어 UI 요소 동기화
    document.documentElement.setAttribute("lang", this.state.lang);
    s("betaNoticeTitle", x.betaNoticeTitle);
    const betaMsgEl = document.getElementById("betaNoticeMsg");
    if (betaMsgEl && x.betaNoticeMsg) {
      const parts = String(x.betaNoticeMsg).split("\n");
      if (parts.length >= 3) {
        betaMsgEl.innerHTML = `<span class="bp-line">${parts[0]}</span><span class="bp-warn">${parts[1]}</span><span class="bp-tip">💻 ${parts.slice(2).join("<br>")}</span>`;
      } else if (parts.length === 2) {
        betaMsgEl.innerHTML = `<span class="bp-line">${parts[0]}</span><span class="bp-warn">${parts[1]}</span>`;
      } else {
        betaMsgEl.innerHTML = `<span class="bp-line">${parts[0]}</span>`;
      }
    }
    s("betaNoticeBtn", x.betaNoticeBtn);
    s("betaNoticeHideTodayBtn", x.betaNoticeHideToday);
    s("betaNoticeHideForeverBtn", x.betaNoticeHideForever);
    s("t-td-sample", sampleTag);
    s("t-cs-sample", sampleTag);
    s("t-sv-sample", sampleTag);
    s("td-sample-banner", x.betaDiagBanner);
    document.querySelectorAll(".beta-sample-card").forEach(el => {
      el.setAttribute("data-beta-sample", sampleTag);
    });
    const disBadge = x.betaDisabledBadge || "Beta 비활성";
    const csvBtn = document.getElementById("t-csv");
    if (csvBtn) csvBtn.title = disBadge;
    const xlsBtn = document.getElementById("t-xls");
    if (xlsBtn) xlsBtn.title = disBadge;
  },

  updatePlanBadge() {
    if (typeof HeaderKit !== "undefined") {
      HeaderKit.setProStatus(false, "Beta", "trial");
    }
    this.updCnt();
  },

  updCnt() {
    const el = document.getElementById("sav-cnt");
    if (!el) return;
    el.textContent = `${this.state.records.length} / 5`;
  },

  saveLastState() {
    try {
      const nwVal = parseInt(document.getElementById("i-nweld").value, 10);
      const awVal = parseInt(document.getElementById("i-aweld").value, 10);
      DataStore.setLastState({
        D: +document.getElementById("iD").value || 8000,
        t: +document.getElementById("it").value || 20,
        plen: +document.getElementById("i-plen").value || 12000,
        nweld: isNaN(nwVal) ? 5 : nwVal,
        aweld: isNaN(awVal) ? 1 : awVal,
        platespan: +document.getElementById("i-platespan").value || 2000,
        st: document.getElementById("i-sup").value || "TR2_45",
        rmat: document.getElementById("i-rmat").value || "steel",
        rdia: +document.getElementById("i-rdia").value || 600,
        cc: +document.getElementById("i-cc").value || 1200,
        cl: +document.getElementById("i-cl").value || 300,
        zone: document.getElementById("i-zone").value || "body",
        fat: document.getElementById("i-fat").value || "false",
        customLim: document.getElementById("i-custom-lim")?.value ?? "",
        settle: document.getElementById("i-settle")?.value ?? "0",
        rcap: document.getElementById("i-rcap")?.value ?? "",
        ml: document.getElementById("i-ml")?.value ?? "",
        mm: document.getElementById("i-mm")?.value ?? "",
        mr: document.getElementById("i-mr")?.value ?? "",
        mbef: document.getElementById("i-mbef")?.value ?? "",
        maft: document.getElementById("i-maft")?.value ?? "",
        proj: document.getElementById("i-proj")?.value ?? "",
        pipeno: document.getElementById("i-pipeno")?.value ?? "",
        prep: document.getElementById("i-prep")?.value ?? "",
        rev: document.getElementById("i-rev")?.value ?? "",
        dmin: document.getElementById("i-dmin")?.value ?? "",
        dmax: document.getElementById("i-dmax")?.value ?? "",
        devmin: document.getElementById("i-devmin")?.value ?? "",
        devmax: document.getElementById("i-devmax")?.value ?? "",
        measMode: this.state.measMode || "abs"
      });
    } catch (e) {}
  },

  restoreLastState() {
    const st = DataStore.getLastState();
    if (!st) return;
    const setVal = (id, v) => { const el = document.getElementById(id); if (el && v !== undefined) el.value = v; };
    setVal("iD", st.D); setVal("it", st.t); setVal("i-plen", st.plen);
    setVal("i-nweld", st.nweld); setVal("i-aweld", st.aweld); setVal("i-platespan", st.platespan);
    setVal("i-sup", st.st); setVal("i-rmat", st.rmat); setVal("i-rdia", st.rdia);
    setVal("i-cc", st.cc); setVal("i-cl", st.cl); setVal("i-zone", st.zone); setVal("i-fat", st.fat);
    if (st.customLim !== undefined) setVal("i-custom-lim", st.customLim);
    if (st.settle !== undefined) setVal("i-settle", st.settle);
    if (st.rcap !== undefined) setVal("i-rcap", st.rcap);
    if (st.ml !== undefined) setVal("i-ml", st.ml);
    if (st.mm !== undefined) setVal("i-mm", st.mm);
    if (st.mr !== undefined) setVal("i-mr", st.mr);
    if (st.mbef !== undefined) setVal("i-mbef", st.mbef);
    if (st.maft !== undefined) setVal("i-maft", st.maft);
    if (st.proj !== undefined) setVal("i-proj", st.proj);
    if (st.pipeno !== undefined) setVal("i-pipeno", st.pipeno);
    if (st.prep !== undefined) setVal("i-prep", st.prep);
    if (st.rev !== undefined) setVal("i-rev", st.rev);
    if (st.dmin !== undefined) setVal("i-dmin", st.dmin);
    if (st.dmax !== undefined) setVal("i-dmax", st.dmax);
    if (st.devmin !== undefined) setVal("i-devmin", st.devmin);
    if (st.devmax !== undefined) setVal("i-devmax", st.devmax);
    this.state.measMode = st.measMode || "abs";
    if (String(st.dmin || "").trim() !== "" || String(st.dmax || "").trim() !== "") {
      this.syncMeasuredFields("abs");
    } else if (String(st.devmin || "").trim() !== "" || String(st.devmax || "").trim() !== "") {
      this.syncMeasuredFields("dev");
    }
  },

  onRmatChange(triggerAnalysis = false) {
    const el = document.getElementById("i-rmat");
    const note = document.getElementById("rmat-note");
    if (!el || !note) return;
    const v = el.value;
    if (v === "urethane") {
      note.style.display = "block";
      note.innerHTML = `<b>◎ Urethane</b> &nbsp;${this.t("rmatNoteU")}`;
      note.style.borderLeftColor = "var(--gn)";
      note.style.background = "var(--gnbg)";
    } else {
      note.style.display = "block";
      note.innerHTML = `<b>⚙ Steel</b> &nbsp;${this.t("rmatNoteS")}`;
      note.style.borderLeftColor = "var(--bdr2)";
      note.style.background = "var(--inp)";
    }
    this.calcRollerSets();
    if (triggerAnalysis) this.runAnalysis({ keepTab: true, silent: true });
  },

  onSupChange(triggerAnalysis = false) {
    const v = document.getElementById("i-sup").value;
    const show = v === "TR2_CUSTOM" || v === "TR4_CUSTOM" || v === "DOUBLE_ROLLER";
    document.getElementById("cust-wrap").classList.toggle("hide", !show);
    document.getElementById("cust-tr2").classList.toggle("hide", v !== "TR2_CUSTOM");
    document.getElementById("cust-tr4")?.classList.toggle("hide", v !== "TR4_CUSTOM");
    document.getElementById("cust-dbl")?.classList.toggle("hide", v !== "DOUBLE_ROLLER");
    if (triggerAnalysis) this.runAnalysis({ keepTab: true, silent: true });
  },

  onRollerSpecInput() {
    this.calcRollerSets();
    this.runAnalysis({ keepTab: true, silent: true });
  },

  updateActualSets() {
    // Beta v0.5: 고정 샘플 기준(4 sets) 대비 상태 표시 + [샘플]
    const aEl = document.getElementById("i-asets");
    const st = document.getElementById("asets-status");
    if (!aEl || !st) return;
    const tag = this.t("betaSampleTag") || "[샘플]";
    const aVal = parseInt(aEl.value, 10);
    const minRec = 4;
    if (isNaN(aVal) || aVal < 1) {
      st.textContent = `— ${tag}`;
      st.style.background = "var(--inp)";
      st.style.color = "var(--tx2)";
      aEl.style.borderColor = "var(--bdr)";
      return;
    }
    if (aVal >= minRec) {
      st.textContent = `✓ ${this.t("asetsOk")} ${tag}`;
      st.style.background = "var(--gnbg)";
      st.style.color = "var(--gn)";
      aEl.style.borderColor = "var(--gn)";
    } else {
      st.textContent = `⚠ +${minRec - aVal} ${this.t("asetsShort")} ${tag}`;
      st.style.background = "var(--rdbg)";
      st.style.color = "var(--rd)";
      aEl.style.borderColor = "var(--rd)";
    }
  },

  renderBrazierAlert(ev) {
    const box = document.getElementById("dt-brazier-alert");
    if (!box) return;
    if (!ev) {
      box.className = "dt-brazier-alert hidden";
      box.innerHTML = "";
      return;
    }
    const dtStr = ev.dt.toFixed(1);
    if (ev.brazierLevel === "HIGH") {
      box.className = "dt-brazier-alert is-high";
      box.innerHTML = `<div><span class="dt-brazier-badge">BRAZIER HIGH</span><b>D/t &gt; 300</b></div>`
        + `<div>${this.t("brazierHighMsg").replace("{dt}", dtStr)}</div>`;
    } else if (ev.brazierLevel === "MODERATE") {
      box.className = "dt-brazier-alert is-mod";
      box.innerHTML = `<div><span class="dt-brazier-badge">BRAZIER MODERATE</span><b>D/t &gt; 200</b></div>`
        + `<div>${this.t("brazierModMsg").replace("{dt}", dtStr)}</div>`;
    } else {
      box.className = "dt-brazier-alert is-low";
      box.innerHTML = `<div><span class="dt-brazier-badge">BRAZIER LOW</span></div>`
        + `<div>${this.t("brazierLowMsg").replace("{dt}", dtStr).replace("{iso}", ev.isoLimitPct)}</div>`;
    }

    if (!this.state.lastResult) {
      const trBody = document.getElementById("tr-body");
      if (trBody) {
        const msgs = this.t("rMsgs") || [];
        let preHtml = "";
        if (ev.brazierLevel === "HIGH") {
          preHtml += `<div class="rec CR"><span class="rec-b">HIGH</span><span class="rec-m">${msgs[3]} (D/t=${ev.dt.toFixed(0)})</span></div>`;
        } else if (ev.brazierLevel === "MODERATE") {
          preHtml += `<div class="rec WA"><span class="rec-b">MOD</span><span class="rec-m">${msgs[4]} (D/t=${ev.dt.toFixed(0)})</span></div>`;
        }
        if (msgs[9]) {
          preHtml += `<div class="rec IN"><span class="rec-b">IN</span><span class="rec-m">${msgs[9]}</span></div>`;
        }
        trBody.innerHTML = preHtml || `<div class="ph"><p id="t-ph-tr">${this.t("phTr")}</p></div>`;
      }
    }
  },

  calcDT() {
    const D = +document.getElementById("iD").value || 0;
    const t = +document.getElementById("it").value || 0;
    const dv = document.getElementById("dt-val");
    const dc = document.getElementById("dt-cls");
    const dR = document.getElementById("dt-R");
    const di = document.getElementById("dt-iso");
    const dbz = document.getElementById("dt-braz");
    const ev = TOAEngine.evaluateDT(D, t);

    if (!ev) {
      dv.textContent = "—"; dv.style.color = "var(--txm)";
      dc.textContent = "—"; dc.style.background = "var(--inp)"; dc.style.color = "var(--txl)";
      dR.textContent = "—"; di.textContent = "—";
      if (dbz) { dbz.textContent = "—"; dbz.style.color = "var(--txm)"; }
      this.renderBrazierAlert(null);
      return;
    }
    const { dt, R, isThin, isoLimitPct, brazierLevel } = ev;
    dv.textContent = dt.toFixed(2);
    dR.textContent = R.toFixed(0);
    di.textContent = `≤${isoLimitPct.toFixed(1)}%`;

    if (brazierLevel === "HIGH") {
      dv.style.color = "var(--rd)"; di.style.color = "var(--rd)";
      if (dbz) { dbz.textContent = "HIGH ⚠"; dbz.style.color = "var(--rd)"; }
    } else if (brazierLevel === "MODERATE") {
      dv.style.color = "var(--or)"; di.style.color = "var(--or)";
      if (dbz) { dbz.textContent = "MOD △"; dbz.style.color = "var(--or)"; }
    } else if (dt > 120) {
      dv.style.color = "var(--ac)"; di.style.color = "var(--or)";
      if (dbz) { dbz.textContent = "LOW"; dbz.style.color = "var(--gn)"; }
    } else {
      dv.style.color = "var(--gn)"; di.style.color = "var(--gn)";
      if (dbz) { dbz.textContent = "LOW"; dbz.style.color = "var(--gn)"; }
    }

    dc.textContent = isThin ? "Thin-Wall" : "Thick-Wall";
    dc.style.background = isThin ? "var(--acbg)" : "var(--orbg)";
    dc.style.color = isThin ? "var(--ac)" : "var(--or)";

    const ccAuto = Math.min(5000, Math.max(100, Math.round(Math.sqrt(2) * R / 10) * 10));
    document.getElementById("i-cc").value = ccAuto;
    const ccLbl = document.getElementById("cc-auto-lbl");
    if (ccLbl) ccLbl.textContent = `(α45°: ${ccAuto}mm)`;

    const L = +document.getElementById("i-plen").value || 0;
    const dld = document.getElementById("dt-ld");
    if (dld) {
      if (L > 0 && D > 0) {
        dld.textContent = (L / D).toFixed(2);
        dld.style.color = L / D > 10 ? "var(--or)" : L / D > 6 ? "var(--ac)" : "var(--gn)";
      } else {
        dld.textContent = "—";
      }
    }
    this.renderBrazierAlert(ev);
    if (!this.state.lastResult) {
      this.updatePreAnalysisBuckling(ev);
      this.renderOvalBendAlert(null);
    }
    if (D > 0) {
      this.syncMeasuredFields(this.state.measMode === "dev" ? "dev" : "abs");
    }
    this.renderMeas(this.state.lastResult);
    if (this.state.lastResult) {
      this.runAnalysis({ keepTab: true, silent: true });
    }
  },

  renderOvalBendAlert(r) {
    const box = document.getElementById("oval-bend-alert");
    if (!box || typeof TOAEngine.evaluateOvalBendingRisk !== "function") return;

    const D = r && r.p ? r.p.D : (+document.getElementById("iD")?.value || 0);
    const t = r && r.p ? r.p.t : (+document.getElementById("it")?.value || 0);
    if (!D || !t || t <= 0 || t >= D / 2) {
      box.className = "ob-alert hide";
      box.innerHTML = "";
      return;
    }

    const plen = +document.getElementById("i-plen")?.value || 0;
    const rd = +document.getElementById("i-rdia")?.value || 600;
    const cl = +document.getElementById("i-cl")?.value || 300;
    const nW = +document.getElementById("i-nweld")?.value || 0;
    const nA = +document.getElementById("i-aweld")?.value || 0;
    const asets = +document.getElementById("i-asets")?.value || 0;
    const dm = +document.getElementById("i-dmax")?.value || 0;
    const dn = +document.getElementById("i-dmin")?.value || 0;
    const measOvalPct = (dm > 0 && dn > 0 && dm >= dn) ? ((dm - dn) / D * 100) : 0;

    const rs = plen > 0 ? TOAEngine.computeRollerSets({ D, t, L: plen, nW, nA, rd, cl }) : null;
    const nSets = asets > 0 ? asets : (rs ? rs.n_rec : 2);
    const spanUse = (plen > 0 && nSets > 0) ? (plen / (nSets + 1)) : 0;
    const beamDeltaMm = spanUse > 0 ? TOAEngine.beam(D, t, spanUse).delta : 0;

    const risk = TOAEngine.evaluateOvalBendingRisk({
      D, t, L: plen,
      ovalPct: r ? r.oval_pct : 0,
      measOvalPct,
      ringBendStressMPa: r ? (r.ringBendStressMPa || 0) : 0,
      beamDeltaMm
    });

    if (risk.level === "SAFE") {
      box.className = "ob-alert hide";
      box.innerHTML = "";
      return;
    }

    const tt = (k, fb) => { const v = this.t(k); return (v && v !== k) ? v : fb; };
    const isCrit = risk.level === "CRITICAL";
    box.className = `ob-alert ${isCrit ? "crit" : "warn"}`;

    const title = isCrit
      ? tt("obCritTitle", "타원화 및 굽힘 고위험 감지 (Ovalization & Bending CRITICAL)")
      : tt("obWarnTitle", "타원화·굽힘 주의 조건 감지 (Ovalization & Bending WARNING)");
    const desc = isCrit
      ? tt("obCritDesc", "단면 편평화 또는 굽힘 변형·응력이 안전 기준을 초과할 위험이 높습니다. 내부 보강링·Spider Brace 설치 및 롤러 지지 간격 축소를 즉시 검토하세요.")
      : tt("obWarnDesc", "박벽 타원화(Brazier) 또는 굽힘 변형 주의 구간입니다. 보강링·다수 롤러 지지 배치를 검토하세요.");
    const btnLbl = tt("obBtn", "🛠 보강 설계·도면 보기");

    const chips = [
      `<span class="ob-chip">D/t = ${risk.dt}</span>`,
      risk.maxOvalPct > 0 ? `<span class="ob-chip">Oval = ${risk.maxOvalPct.toFixed(2)}%</span>` : "",
      risk.ringBendStressMPa > 0 ? `<span class="ob-chip">σ_b = ${risk.ringBendStressMPa} MPa</span>` : "",
      risk.beamDeltaMm > 0 ? `<span class="ob-chip">Beam δ = ${risk.beamDeltaMm} mm</span>` : ""
    ].filter(Boolean).join("");

    box.innerHTML =
      `<div class="ob-alert-main">`
      + `<div class="ob-alert-ico">${isCrit ? "🚨" : "⚠️"}</div>`
      + `<div>`
      + `<div class="ob-alert-title">${title}</div>`
      + `<div class="ob-alert-desc">${desc}</div>`
      + `<div class="ob-chips">${chips}</div>`
      + `</div>`
      + `</div>`
      + `<button type="button" class="ob-alert-btn" onclick="App.goTab('tr');document.getElementById('tr')?.scrollIntoView({behavior:'smooth',block:'start'});">${btnLbl}</button>`;
  },

  renderBucklingTag(D, t, ovalPct) {
    const b = TOAEngine.evaluateStateBuckling(D, t, ovalPct);
    if (!b || b.level === "LOW") return "";
    const isHigh = b.level === "HIGH";
    const badge = isHigh ? this.t("buckHighBadge") : this.t("buckModBadge");
    const tip = isHigh ? this.t("buckHighTip") : this.t("buckModTip");
    return `<div class="rc-buck-warn ${isHigh ? "high" : "mod"}" title="${tip}">`
      + `<div class="rc-buck-b">${badge}</div>`
      + `<div class="rc-buck-t">${tip}</div>`
      + `</div>`;
  },

  setCardBucklingClass(el, D, t, ovalPct) {
    if (!el) return;
    el.classList.remove("buck-high", "buck-mod");
    const b = TOAEngine.evaluateStateBuckling(D, t, ovalPct);
    if (!b || b.level === "LOW") return;
    el.classList.add(b.level === "HIGH" ? "buck-high" : "buck-mod");
  },

  updatePreAnalysisBuckling(ev) {
    const items = [
      { card: "card-nat", body: "nat-body", phId: "t-ph1", phKey: "ph1" },
      { card: "card-sup", body: "sup-body", phId: "t-ph2", phKey: "ph2" }
    ];
    const hasRisk = ev && ev.brazierLevel !== "LOW";
    const isHigh = ev && ev.brazierLevel === "HIGH";
    items.forEach(it => {
      const cEl = document.getElementById(it.card);
      const bEl = document.getElementById(it.body);
      if (cEl) {
        cEl.classList.remove("buck-high", "buck-mod");
        if (hasRisk) cEl.classList.add(isHigh ? "buck-high" : "buck-mod");
      }
      if (bEl) {
        let html = `<div class="ph"><div class="ico">⦿</div><p id="${it.phId}">${this.t(it.phKey)}</p></div>`;
        if (hasRisk) {
          const badge = isHigh ? this.t("buckHighBadge") : this.t("buckModBadge");
          const tip = isHigh ? this.t("buckHighTip") : this.t("buckModTip");
          html += `<div class="rc-buck-warn ${isHigh ? "high" : "mod"}" title="${tip}">`
            + `<div class="rc-buck-b">${badge} (D/t=${ev.dt.toFixed(0)})</div>`
            + `<div class="rc-buck-t">${tip}</div>`
            + `</div>`;
        }
        bEl.innerHTML = html;
      }
    });
  },

  onWeldInput(source) {
    const nwEl = document.getElementById("i-nweld");
    const awEl = document.getElementById("i-aweld");
    if (nwEl && awEl) {
      const nwRaw = parseInt(nwEl.value, 10);
      const awRaw = parseInt(awEl.value, 10);
      if (source === "nweld" && !isNaN(nwRaw)) {
        const nw = Math.max(0, nwRaw);
        if (!isNaN(awRaw) && awRaw > nw) awEl.value = nw;
      } else if (source === "aweld" && !isNaN(awRaw)) {
        const aw = Math.max(0, awRaw);
        if (isNaN(nwRaw) || nwRaw < aw) nwEl.value = aw;
      }
    }
    this.calcRollerSets();
    this.saveLastState();
  },

  calcRollerSets() {
    // Beta v0.5: 고정 샘플 숫자 표시
    const tag = this.t("betaSampleTag") || "[샘플]";
    const setText = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    setText("rs-sets", `4 sets ${tag}`);
    setText("rs-defl", "3 sets");
    setText("rs-hertz", "4 sets");
    setText("rs-span", "2400mm");
    setText("rs-gov", `Hertz ${tag}`);
    this.updateActualSets();
  },

  getP() {
    const D = +document.getElementById("iD").value;
    const t = +document.getElementById("it").value;
    const st = document.getElementById("i-sup").value;
    const customLimRaw = +document.getElementById("i-custom-lim")?.value || 0;
    const opts = {
      zone: document.getElementById("i-zone").value,
      fatigue: document.getElementById("i-fat").value === "true",
      customLimitPct: customLimRaw > 0 ? customLimRaw : undefined
    };
    const p = { D, t, st, opts };
    if (st === "TR2_CUSTOM") p.a = +document.getElementById("i-a").value;
    if (st === "TR4_CUSTOM") {
      p.a1 = +document.getElementById("i-a1").value;
      p.a2 = +document.getElementById("i-a2").value;
    }
    if (st === "DOUBLE_ROLLER") {
      p.ac = +document.getElementById("i-ac").value;
      p.gr = +document.getElementById("i-gr").value;
    }
    return p;
  },

  toggleSavedCollapse(forceState) {
    if (typeof forceState === "boolean") {
      this.state.savCollapsed = forceState;
    } else {
      this.state.savCollapsed = !this.state.savCollapsed;
    }
    const wrap = document.getElementById("ts-collapse-wrap");
    if (wrap) wrap.classList.toggle("hide", this.state.savCollapsed);
    const lbl = document.getElementById("t-tstog");
    if (lbl) lbl.textContent = this.t(this.state.savCollapsed ? "savShow" : "savHide");
  },

  goTab(id) {
    const activeTab = id === "ts" ? "tc" : id;
    const panelIds = ["tc", "tm", "td", "tr", "tl"];
    const btnIds = ["tab-tc", "tab-tm", "tab-td", "tab-tr", "tab-tl"];
    panelIds.forEach(tabId => {
      document.getElementById(tabId)?.classList.toggle("on", tabId === activeTab);
    });
    btnIds.forEach(btnId => {
      document.getElementById(btnId)?.classList.toggle("on", btnId === `tab-${activeTab}`);
    });
    if (activeTab === "td") {
      this.renderSampleMainDiagrams();
    }
    if (id === "ts") {
      this.toggleSavedCollapse(false);
      document.getElementById("ts")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  },

  buildSampleSupportResult(p) {
    // Beta v0.5: 샘플 지지방식 5종 선택 시 고정 예시 제원(D=8000, t=20) 기반 샘플 결과 생성
    const sampleP = {
      D: 8000,
      t: 20,
      st: p.st,
      opts: p.opts || {},
      a1: p.a1 != null ? p.a1 : 30,
      a2: p.a2 != null ? p.a2 : 60,
      ac: p.ac != null ? p.ac : 45,
      gr: p.gr != null ? p.gr : 10
    };
    const r = TOAEngine.analyze(sampleP);
    r.isBetaSample = true;
    return r;
  },

  runAnalysis({ keepTab = false, silent = false } = {}) {
    const p = this.getP();
    try {
      const isSampleSup = BETA_SAMPLE_SUPPORTS.includes((p.st || "").toUpperCase());
      const r = isSampleSup ? this.buildSampleSupportResult(p) : TOAEngine.analyze(p);
      this.state.lastResult = r;
      this.saveLastState();
      this.renderNat(r);
      this.renderSup(r);
      this.renderMeas(r);
      this.renderMetrics(r, p);
      this.renderCompliance(r);
      this.renderCompare(TOAEngine.analyzeAll(p.D, p.t, p.opts));
      this.renderRecs(r);
      this.renderOvalBendAlert(r);
      this.drawDiag(r);
      this.renderLdia(p.D, p.t);
      this.updateStat(r);
      this.calcRollerSets();
      if (!keepTab) this.goTab("tc");
    } catch (err) {
      if (!silent) this.toast("⚠ " + err.message, true);
    }
  },

  runCompare() {
    this.runAnalysis({ keepTab: true });
    const p = this.getP();
    try {
      const all = TOAEngine.analyzeAll(p.D, p.t, p.opts);
      this.renderCompare(all);
      this.goTab("tm");
    } catch (err) {
      this.toast("⚠ " + err.message, true);
    }
  },

  updateStat(r) {
    const ok = r.comp.API_2B.pass && r.comp.ISO_19902.pass;
    const el = document.getElementById("stat-pill");
    if (el) el.className = "status-pill " + (ok ? "pass" : "fail");
    const ico = document.getElementById("stat-ico");
    const txt = document.getElementById("stat-txt");
    if (ico) ico.textContent = ok ? "✓" : "⚠";
    if (txt) txt.textContent = ok ? this.t("sPass") : this.t("sFail");
  },

  renderNat(r) {
    const n = r.natOval_mm, p = r.natOval_pct;
    const cc = p > 1 ? "c-rd" : p > 0.3 ? "c-or" : "c-ac";
    document.getElementById("dot-nat").className = "rc-dot on";
    this.setCardBucklingClass(document.getElementById("card-nat"), r.p.D, r.p.t, p);
    document.getElementById("nat-body").innerHTML =
      `<div class="rc-big ${cc}">${n.toFixed(2)}<span class="rc-unit">mm</span></div>`
      + `<div class="rc-desc">NATURAL STATE — DV_N</div>`
      + `<div class="rc-sub ${cc}">${p.toFixed(2)}<span style="font-size:13px;margin-left:2px;">%</span></div>`
      + `<div class="rc-sub-d">PREDICTED OVALITY</div>`
      + this.renderBucklingTag(r.p.D, r.p.t, p);
  },

  renderSup(r) {
    const supKeyMap = {
      NATURAL: "oNat",
      SADDLE120: "oSad",
      TR2_491: "oT2a",
      TR2_45: "oT2b",
      TR2_30: "oT2c",
      TR2_CUSTOM: "oT2d",
      TR4_STD: "oT4a",
      TR4_CUSTOM: "oT4b",
      DOUBLE_ROLLER: "oDbl"
    };
    const st = (r.p.st || "NATURAL").toUpperCase();
    const supName = this.t(supKeyMap[st] || "") || st;
    const tag = this.t("betaSampleTag") || "[샘플]";
    document.getElementById("sup-lbl").textContent = `${this.t("sup")} · ${supName}${r.isBetaSample ? ` ${tag}` : ""}`;
    const c = r.oval_pct < 0.01 ? "#22c55e" : r.oval_pct < 0.5 ? "#377feb" : "#f87171";
    const cc = r.oval_pct > 1 ? "c-rd" : r.oval_pct > 0.3 ? "c-or" : "c-ac";
    const supDot = document.getElementById("dot-sup");
    supDot.className = "rc-dot on";
    supDot.style.background = c;
    this.setCardBucklingClass(document.getElementById("card-sup"), r.p.D, r.p.t, r.oval_pct);
    const sampleBadgeHtml = r.isBetaSample
      ? `<div style="margin-bottom:4px;"><span class="beta-sample-badge" style="margin-left:0;">${tag} D=8000·t=20</span></div>`
      : "";
    document.getElementById("sup-body").innerHTML =
      sampleBadgeHtml
      + `<div class="rc-big ${cc}">${r.oval_mm.toFixed(2)}<span class="rc-unit">mm</span></div>`
      + `<div class="rc-desc">PREDICTED DEFLECTION (ATTENUATED)</div>`
      + `<div class="rc-sub ${cc}">${r.oval_pct.toFixed(2)}<span style="font-size:13px;margin-left:2px;">%</span></div>`
      + `<div class="rc-sub-d">PREDICTED OVALITY (${(r.vsNat * 100).toFixed(0)}% OF NATURAL · θ<sub>max</sub>=${r.thetaMaxDeg != null ? r.thetaMaxDeg : 0}° / θ<sub>min</sub>=${r.thetaMinDeg != null ? r.thetaMinDeg : 90}°)</div>`
      + this.renderBucklingTag(r.p.D, r.p.t, r.oval_pct);
  },

  syncMeasuredFields(mode) {
    const D = +document.getElementById("iD")?.value || 0;
    const dminEl = document.getElementById("i-dmin");
    const dmaxEl = document.getElementById("i-dmax");
    const devMinEl = document.getElementById("i-devmin");
    const devMaxEl = document.getElementById("i-devmax");
    if (!dminEl || !dmaxEl || !devMinEl || !devMaxEl || D <= 0) return;

    if (mode === "dev") {
      this.state.measMode = "dev";
      const vMin = String(devMinEl.value ?? "").trim();
      const vMax = String(devMaxEl.value ?? "").trim();
      dminEl.value = (vMin !== "" && !isNaN(+vMin)) ? +(D + (+vMin)).toFixed(4) : "";
      dmaxEl.value = (vMax !== "" && !isNaN(+vMax)) ? +(D + (+vMax)).toFixed(4) : "";
    } else if (mode === "abs") {
      this.state.measMode = "abs";
      const aMin = String(dminEl.value ?? "").trim();
      const aMax = String(dmaxEl.value ?? "").trim();
      devMinEl.value = (aMin !== "" && !isNaN(+aMin) && +aMin > 0) ? +((+aMin) - D).toFixed(4) : "";
      devMaxEl.value = (aMax !== "" && !isNaN(+aMax) && +aMax > 0) ? +((+aMax) - D).toFixed(4) : "";
    }
  },

  onMeasuredInput(mode) {
    if (mode === "dev" || mode === "abs") {
      this.syncMeasuredFields(mode);
    }
    this.saveLastState();
    if (this.state.lastResult) {
      this.runAnalysis({ keepTab: true, silent: true });
    } else {
      this.renderMeas(null);
      this.renderOvalBendAlert(null);
    }
  },

  renderMeas(r) {
    const card = document.getElementById("card-meas");
    const dot = document.getElementById("dot-meas");
    const body = document.getElementById("meas-body");
    if (!card || !dot || !body) return;

    const dm = +document.getElementById("i-dmax").value;
    const dn = +document.getElementById("i-dmin").value;
    const params = (r && r.p) ? r.p : this.getP();
    const D = params.D;
    const t = params.t;

    // 다단면(좌·중·우) & 용접 전·후 열변형 요약 업데이트
    const ml = +document.getElementById("i-ml")?.value || 0;
    const mm = +document.getElementById("i-mm")?.value || 0;
    const mr = +document.getElementById("i-mr")?.value || 0;
    const mbef = +document.getElementById("i-mbef")?.value || 0;
    const maft = +document.getElementById("i-maft")?.value || 0;
    const deltaBox = document.getElementById("meas-weld-delta");
    if (deltaBox) {
      const parts = [];
      if (ml > 0 || mm > 0 || mr > 0) {
        const mxSec = Math.max(ml, mm, mr);
        parts.push(`3-Sec Max: ${mxSec.toFixed(2)}mm (${D > 0 ? (mxSec / D * 100).toFixed(2) : 0}%)`);
      }
      if (mbef > 0 && maft > 0) {
        const dw = maft - mbef;
        parts.push(`Δ_weld: ${dw >= 0 ? "+" : ""}${dw.toFixed(2)}mm (${mbef.toFixed(1)}→${maft.toFixed(1)})`);
      }
      if (parts.length) {
        deltaBox.textContent = parts.join("  |  ");
        deltaBox.classList.remove("hide");
      } else {
        deltaBox.classList.add("hide");
      }
    }

    if (!D || !t || t <= 0 || t >= D / 2 || !dm || !dn || dm <= 0 || dn <= 0) {
      card.className = "rc-meas no-data";
      dot.className = "rc-dot";
      dot.style.background = "";
      body.innerHTML = `<div class="ph"><div class="ico" style="opacity:.25">📐</div><p style="color:var(--txm)">${this.t("measNoInput")}</p></div>`;
      return;
    }

    if (dm < dn) {
      card.className = "rc-meas fail-data";
      dot.className = "rc-dot on";
      dot.style.background = "#dc2626";
      body.innerHTML = `<div class="ph" style="color:var(--rd)"><div class="ico">⚠</div><p style="color:var(--rd);font-weight:700;font-size:12px;line-height:1.45;">${this.t("measErrOrder")}</p></div>`;
      return;
    }

    const oval_mm = dm - dn;
    const oval_pct = oval_mm / D * 100;
    const comp = TOAEngine.compliance(oval_mm, oval_pct, D, t, params.opts || {});
    const allPass = comp.API_2B.pass && comp.ISO_19902.pass && comp.DNV.pass;
    const cc = !allPass ? "c-rd" : oval_pct > 0.3 ? "c-or" : "c-gn";
    card.className = "rc-meas " + (allPass ? "has-data" : "fail-data");
    this.setCardBucklingClass(card, D, t, oval_pct);
    dot.className = "rc-dot on";
    dot.style.background = allPass ? "#22c55e" : "#dc2626";
    body.innerHTML =
      `<div class="rc-big ${cc}">${oval_mm.toFixed(2)}<span class="rc-unit">mm</span></div>`
      + `<div class="rc-desc">${this.t("measLabel")}</div>`
      + `<div class="rc-sub ${cc}">${oval_pct.toFixed(2)}<span style="font-size:13px;margin-left:2px;">%</span></div>`
      + `<div class="rc-sub-d" style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">`
      + `<span style="padding:2px 8px;border-radius:4px;font-size:9px;font-weight:700;background:${comp.API_2B.pass ? "var(--gnbg)" : "var(--rdbg)"};color:${comp.API_2B.pass ? "var(--gn)" : "var(--rd)"}">API 2B ${comp.API_2B.pass ? "PASS" : "FAIL"}</span>`
      + `<span style="padding:2px 8px;border-radius:4px;font-size:9px;font-weight:700;background:${comp.ISO_19902.pass ? "var(--gnbg)" : "var(--rdbg)"};color:${comp.ISO_19902.pass ? "var(--gn)" : "var(--rd)"}">ISO ${comp.ISO_19902.pass ? "PASS" : "FAIL"}</span>`
      + `<span style="padding:2px 8px;border-radius:4px;font-size:9px;font-weight:700;background:${comp.DNV.pass ? "var(--gnbg)" : "var(--rdbg)"};color:${comp.DNV.pass ? "var(--gn)" : "var(--rd)"}">DNV ${comp.DNV.pass ? "PASS" : "FAIL"}</span>`
      + `</div>`
      + this.renderBucklingTag(D, t, oval_pct);
  },

  renderMetrics(r, p) {
    // Beta v0.5: 롤러 지지 성능 분석 고정 샘플 숫자 표시
    const tag = this.t("betaSampleTag") || "[샘플]";
    const sb = document.getElementById("stab");
    if (sb) {
      sb.className = "stab ok";
      sb.textContent = `${this.t("stabStable")} ${tag}`;
    }
    const mi = (l, v, u, cc2 = "") => `<div class="mi"><div class="mi-l">${l}</div><div class="mi-v ${cc2}">${v}<span class="mi-u">${u}</span></div></div>`;
    const mEl = document.getElementById("metrics");
    if (mEl) {
      mEl.innerHTML =
        mi(this.t("ma"), "45.00", "°")
        + mi(this.t("ml"), "148.50", "kN")
        + mi(this.t("ms"), "312.4", "MPa", "c-or")
        + mi(this.t("md"), "8.20", "mm");
    }
    const noteEl = document.getElementById("rol-note");
    if (noteEl) {
      noteEl.textContent = `${tag} Hertz [STEEL] | Ø600mm | cl=300mm | C-C=1200mm | Sets=4 (D=8000·t=20·L=12000)`;
    }
  },

  renderCompliance(r) {
    const c = r.comp;
    const h = this.t("cHdr");
    const tag = this.t("betaSampleTag") || "[샘플]";
    let html = r.isBetaSample
      ? `<div style="margin-bottom:8px;padding:7px 11px;border-radius:7px;background:#fef3c7;border:1px solid #f59e0b;color:#92400e;font-size:11.5px;font-weight:700;"><span class="beta-sample-badge" style="margin:0 6px 0 0;">${tag}</span>${this.t("betaReinfExampleSpec")}</div>`
      : "";
    html += `<div class="twrap"><table class="tbl"><thead><tr>${h.map(v => `<th>${v}</th>`).join("")}</tr></thead><tbody>`;
    const stdKeys = c.CUSTOM ? ["API_2B", "ISO_19902", "API_5L", "DNV", "CUSTOM"] : ["API_2B", "ISO_19902", "API_5L", "DNV"];
    stdKeys.forEach(k => {
      const v = c[k];
      const scopeText = v.scopeNoteKey ? this.t(v.scopeNoteKey) : "";
      const noteBadge = v.asAgreed
        ? `<div style="font-size:10px;color:var(--or);font-weight:700;margin-top:2px;">⚠ ${this.t("api5lAgreedNote")}</div>`
        : (scopeText && scopeText !== v.scopeNoteKey ? `<div style="font-size:10px;color:var(--txl);margin-top:2px;">${scopeText}</div>` : "");
      const reqLabel = (this.t("api5lReqBadge") && this.t("api5lReqBadge") !== "api5lReqBadge") ? this.t("api5lReqBadge") : "AGREEMENT REQ.";
      const pillHtml = v.agreementRequired
        ? `<span class="pill w">${reqLabel}</span>`
        : `<span class="pill ${v.pass ? "p" : "f"}">${v.pass ? "PASS" : "FAIL"}</span>`;
      const limMmTxt = v.agreementRequired ? `<span style="color:var(--txl);">Ref ${v.lmm.toFixed(2)}mm</span>` : `${v.lmm.toFixed(2)}mm`;
      const limPctTxt = v.agreementRequired ? `<span style="color:var(--txl);">Ref ${v.lpct.toFixed(2)}%</span>` : `${v.lpct.toFixed(2)}%`;
      const marCell = v.agreementRequired
        ? `<td class="mono" style="color:var(--or);">—</td>`
        : `<td class="mono ${v.mar > 0 ? "c-gn" : "c-rd"}">${v.mar > 0 ? "+" : ""}${v.mar.toFixed(2)}%</td>`;
      html += `<tr><td><b>${v.label}</b>${noteBadge}</td>`
        + `<td class="mono"><b>${v.oval_mm.toFixed(2)}</b>mm / ${v.oval_pct.toFixed(2)}%</td>`
        + `<td class="mono">${limMmTxt}</td>`
        + `<td class="mono">${limPctTxt}</td>`
        + marCell
        + `<td>${pillHtml}</td></tr>`;
    });
    html += `</tbody></table></div>`;

    const dm = +document.getElementById("i-dmax").value;
    const dn = +document.getElementById("i-dmin").value;
    html += `<div style="margin-top:14px;"><div class="shdr"><div class="sttl">${this.t("fieldRes")}</div></div>`;
    if (dm > 0 && dn > 0) {
      if (dm < dn) {
        html += `<div style="padding:10px 14px;background:var(--rdbg);color:var(--rd);border:1px solid rgba(220,38,38,.3);border-radius:8px;font-size:12px;font-weight:700;">${this.t("measErrOrder")}</div>`;
      } else {
        const ov = dm - dn, op = ov / r.p.D * 100;
        const fc = TOAEngine.compliance(ov, op, r.p.D, r.p.t, r.p.opts);
        html += `<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;padding:10px 14px;background:var(--inp);border-radius:8px;font-size:12px;">`
          + `<span>Oval=<b>${ov.toFixed(2)}mm</b> (${op.toFixed(2)}%)</span>`
          + `<span>API 2B:<span class="pill ${fc.API_2B.pass ? "p" : "f"}">${fc.API_2B.pass ? "PASS" : "FAIL"}</span></span>`
          + `<span>ISO:<span class="pill ${fc.ISO_19902.pass ? "p" : "f"}">${fc.ISO_19902.pass ? "PASS" : "FAIL"}</span></span>`
          + `</div>`;
      }
    } else {
      html += `<div style="padding:10px 14px;background:var(--inp);border-radius:8px;font-size:12px;color:var(--txl);">${this.t("measNoInput")}</div>`;
    }
    html += `</div>`;
    html += `<div style="margin-top:12px;padding:9px 12px;background:var(--inp);border-left:3px solid var(--txl);border-radius:6px;font-size:11px;line-height:1.55;color:var(--tx2);">${this.t("compDisclaimer")}</div>`;
    document.getElementById("tc-body").innerHTML = html;
  },

  renderCompare(all) {
    const cmMap = { NATURAL: "oNat", SADDLE120: "oSad", TR2_30: "oT2c", TR2_45: "oT2b", TR2_491: "oT2a", TR4_STD: "oT4a" };
    const cmCol = ["#ef4444", "#f97316", "#f59e0b", "#3b82f6", "#22c55e", "#8b5cf6"];
    const types = ["NATURAL", "SADDLE120", "TR2_30", "TR2_45", "TR2_491", "TR4_STD"];
    const tag = this.t("betaSampleTag") || "[샘플]";
    let mx = 0;
    types.forEach(k => { if (all[k]) mx = Math.max(mx, all[k].oval_mm); });

    let barH = '<div class="bars">';
    const h = this.t("cmHdr");
    let tH = `<div class="twrap"><table class="tbl"><thead><tr>${h.map(v => `<th>${v}</th>`).join("")}</tr></thead><tbody>`;
    types.forEach((tp, i) => {
      const r = all[tp];
      if (!r) return;
      const isSample = BETA_SAMPLE_SUPPORTS.includes(tp);
      const lbl = (this.t(cmMap[tp]) || tp) + (isSample ? ` ${tag}` : "");
      const ov = r.oval_mm, pct = r.oval_pct;
      const bw = mx > 0 ? Math.max(0.5, ov / mx * 100) : 0.5;
      barH += `<div class="bar-row"><div class="bar-lbl">${lbl}</div>`
        + `<div class="bar-trk"><div class="bar-fl" style="width:${bw}%;background:${cmCol[i]}">`
        + `<span>${pct.toFixed(2)}%</span></div></div></div>`;
      const best = tp === "TR2_45";
      tH += `<tr class="${best ? "best" : ""}">`
        + `<td>${best ? "★ " : ""}${lbl}</td>`
        + `<td class="mono">${r.Dv.toFixed(2)}</td><td class="mono">${r.Dh.toFixed(2)}</td>`
        + `<td class="mono">${r.oval_mm.toFixed(2)}</td>`
        + `<td class="mono ${pct > 1 ? "c-rd" : pct > 0.3 ? "c-or" : "c-gn"}"><b>${pct.toFixed(2)}%</b></td>`
        + `<td class="mono">${(r.vsNat * 100).toFixed(2)}%</td>`
        + `<td><span class="pill ${r.comp.API_2B.pass ? "p" : "f"}">${r.comp.API_2B.pass ? "PASS" : "FAIL"}</span></td>`
        + `<td><span class="pill ${r.comp.ISO_19902.pass ? "p" : "f"}">${r.comp.ISO_19902.pass ? "PASS" : "FAIL"}</span></td></tr>`;
    });
    barH += "</div>";
    tH += "</tbody></table></div>";
    document.getElementById("tm-body").innerHTML = barH + tH;
  },

  renderRecs(r) {
    const checks = [
      { k: "CR", check: res => !res.comp.API_2B.pass, mi: 0 },
      { k: "CR", check: res => !res.comp.ISO_19902.pass, mi: 1 },
      { k: "CR", check: res => !res.comp.DNV.pass, mi: 2 },
      { k: "WA", check: res => res.p.D / res.p.t > 300, mi: 3 },
      { k: "CA", check: res => res.p.D / res.p.t > 200 && res.p.D / res.p.t <= 300, mi: 4 },
      { k: "CA", check: res => res.p.D >= 6000, mi: 5 },
      { k: "IN", check: res => (res.p.st || "").toUpperCase() === "NATURAL", mi: 6 },
      { k: "IN", check: res => (res.p.st || "").toUpperCase() === "SADDLE120", mi: 7 },
      { k: "IN", check: () => true, mi: 8 },
      { k: "IN", check: () => true, mi: 9 }
    ];
    const msgs = this.t("rMsgs");
    let html = "";
    if (r.oval_pct > 5 && this.t("linWarn") && this.t("linWarn") !== "linWarn") {
      html += `<div class="rec WA"><span class="rec-b">LIM</span><span class="rec-m">${this.t("linWarn")}</span></div>`;
    }
    if (r.ringBendStressMPa >= 100) {
      const isCritB = r.ringBendStressMPa >= 175;
      const bMsg = (this.t("ringBendWarn") && this.t("ringBendWarn") !== "ringBendWarn")
        ? this.t("ringBendWarn").replace("{sb}", r.ringBendStressMPa)
        : `링 자중 굽힘응력 σ_b = ${r.ringBendStressMPa} MPa — 국부 굽힘·항복 위험 검토 필요`;
      html += `<div class="rec ${isCritB ? "CR" : "WA"}"><span class="rec-b">${isCritB ? "CR" : "WA"}</span><span class="rec-m">${bMsg}</span></div>`;
    }
    if (typeof TOAEngine.evaluateFeaTrigger === "function") {
      const plenF = +document.getElementById("i-plen")?.value || 0;
      const rdF = +document.getElementById("i-rdia")?.value || 600;
      const clF = +document.getElementById("i-cl")?.value || 300;
      const asetsF = +document.getElementById("i-asets")?.value || 0;
      const settleF = +document.getElementById("i-settle")?.value || 0;
      const rsF = plenF > 0 ? TOAEngine.computeRollerSets({ D: r.p.D, t: r.p.t, L: plenF, nW: 0, nA: 0, rd: rdF, cl: clF }) : null;
      const nSetsF = asetsF > 0 ? asetsF : (rsF ? rsF.n_rec : 2);
      const cbF = (plenF > 0 && nSetsF >= 3 && settleF > 0)
        ? TOAEngine.continuousBeamReactions(r.p.D, r.p.t, plenF, nSetsF, settleF)
        : { loadFactor: 1, liftOff: false };
      const fea = TOAEngine.evaluateFeaTrigger({
        D: r.p.D, t: r.p.t, ovalPct: r.oval_pct,
        ringBendStressMPa: r.ringBendStressMPa,
        loadFactor: cbF.loadFactor, liftOff: cbF.liftOff
      });
      if (fea.feaRequired) {
        const fMsg = (this.t("feaWarn") && this.t("feaWarn") !== "feaWarn")
          ? this.t("feaWarn").replace("{rs}", fea.reasons.join(", "))
          : `3D FEA 상세검토 권장 [${fea.reasons.join(", ")}] — 최종 승인 전 비선형·국부응력 FEA 검증 필요`;
        html += `<div class="rec WA"><span class="rec-b">FEA</span><span class="rec-m">${fMsg}</span></div>`;
      }
    }
    checks.forEach(rt => {
      if (rt.check(r)) {
        let msg = msgs[rt.mi];
        if (rt.mi === 3 || rt.mi === 4) msg += ` (D/t=${(r.p.D / r.p.t).toFixed(0)})`;
        html += `<div class="rec ${rt.k}"><span class="rec-b">${rt.k}</span><span class="rec-m">${msg}</span></div>`;
      }
    });

    // Beta v0.5: 보강 단면도·보강 측면도는 고정 샘플 데이터로 발행하고 [샘플] 표기
    document.getElementById("tr-body").innerHTML = html || `<div class="ph"><p>${msgs[8]}</p></div>`;
    this.renderSampleReinforcement();
  },

  getSampleReinfPlan() {
    const tag = this.t("betaSampleTag") || "[샘플]";
    return {
      needed: true,
      D: 8000,
      t: 20,
      L: 12000,
      govOvalMm: 85.4,
      targetLimitMm: 40.0,
      targetMm: 32.0,
      kReq: 2.7,
      strategy: "SELECT_ONE",
      ring: {
        profile: `FB 250×20 ${tag}`,
        count: 3,
        spacingMm: 3000,
        endOffsetMm: 1500,
        I_req_cm4: 1840,
        I_prov_cm4: 2604,
        positionsMm: [1500, 6000, 10500],
        estOvalMm: 28.5
      },
      spider: {
        arms: 6,
        count: 2,
        pipeSpec: `Ø168.3×7.1 ${tag}`,
        armLenMm: 3820,
        slenderness: 67,
        pushDeg: 0,
        pullDeg: 90,
        positionsMm: [600, 11400]
      },
      support: {
        recSets: 4,
        recSpanMm: 2400,
        rollerPositionsMm: [1500, 4500, 7500, 10500],
        recommendTR45: true,
        tr45OvalMm: 38.4
      }
    };
  },

  renderSampleReinforcement() {
    const reinfBox = document.getElementById("tr-reinf");
    if (!reinfBox) return;
    const plan = this.getSampleReinfPlan();
    this.state.lastReinfPlan = plan;
    const posFmt = arr => (arr || []).map(v => `${(v / 1000).toFixed(2)}m`).join(", ");
    const tag = this.t("betaSampleTag") || "[샘플]";
    const tgtWord = this.t("betaReinfTargetWord") || "목표";

    document.getElementById("tr-reinf-meta").innerHTML =
      `<div class="reinf-hdr">`
      + `<div class="reinf-title">🛠 ${this.t("betaReinfPreviewTtl")} <span class="beta-sample-badge">${tag}</span></div>`
      + `<span class="reinf-src">${this.t("betaReinfExampleSpec")}</span>`
      + `</div>`
      + `<div class="reinf-guide s-sel">${this.t("betaReinfGuide")}</div>`
      + `<div class="reinf-grid">`
      + `<div class="reinf-card ring">`
      + `<h4>① ${this.t("reinfRing")} ${tag}</h4>`
      + `<div class="kv"><span>Profile</span><b>${plan.ring.profile}</b></div>`
      + `<div class="kv"><span>Qty / Spacing</span><b>${plan.ring.count} ea / @${plan.ring.spacingMm}mm</b></div>`
      + `<div class="kv"><span>I_req / I_prov</span><b>${plan.ring.I_req_cm4} / ${plan.ring.I_prov_cm4} cm⁴</b></div>`
      + `<div class="kv"><span>Positions (x)</span><b>${posFmt(plan.ring.positionsMm)}</b></div>`
      + `<div class="kv"><span>Est. Ovality</span><b>~${plan.ring.estOvalMm}mm</b></div>`
      + `</div>`
      + `<div class="reinf-card spider">`
      + `<h4>② ${this.t("reinfSpider")} ${tag}</h4>`
      + `<div class="kv"><span>Config</span><b>${plan.spider.arms}-Arm Turnbuckle</b></div>`
      + `<div class="kv"><span>Pipe Spec</span><b>${plan.spider.pipeSpec}</b></div>`
      + `<div class="kv"><span>Arm L / λ</span><b>${plan.spider.armLenMm}mm / λ=${plan.spider.slenderness}</b></div>`
      + `<div class="kv"><span>Push / Pull</span><b>${plan.spider.pushDeg}° Push · ${plan.spider.pullDeg}° Pull</b></div>`
      + `<div class="kv"><span>Positions (x)</span><b>${posFmt(plan.spider.positionsMm)}</b></div>`
      + `</div>`
      + `<div class="reinf-card">`
      + `<h4>③ ${this.t("reinfSup")} ${tag}</h4>`
      + `<div class="kv"><span>Rec. Sets / Span</span><b>${plan.support.recSets} sets / @${plan.support.recSpanMm}mm</b></div>`
      + `<div class="kv"><span>Positions (x)</span><b>${posFmt(plan.support.rollerPositionsMm)}</b></div>`
      + `<div class="kv"><span>TR2 α=45°</span><b>→ ${plan.support.tr45OvalMm}mm</b></div>`
      + `<div class="kv"><span>Target Limit</span><b>≤ ${plan.targetLimitMm}mm (${tgtWord} ${plan.targetMm}mm)</b></div>`
      + `</div>`
      + `</div>`;

    document.getElementById("t-reinf-cs").textContent = this.t("betaReinfCsLbl");
    document.getElementById("t-reinf-sv").textContent = this.t("betaReinfSvLbl");
    document.getElementById("tr-reinf-note").textContent = this.t("betaReinfNote");
    reinfBox.classList.remove("hide");

    if (typeof TOADiagram !== "undefined" && typeof TOADiagram.drawReinforcement === "function") {
      TOADiagram.drawReinforcement(
        document.getElementById("cvs-reinf-cs"),
        document.getElementById("cvs-reinf-sv"),
        plan,
        this.state.theme === "dark",
        tag
      );
    }
  },

  renderLdia(D, t) {
    const cc = +document.getElementById("i-cc").value || 1200;
    const rd = +document.getElementById("i-rdia").value || 600;
    const cl = +document.getElementById("i-cl").value || 300;
    const plen = +document.getElementById("i-plen")?.value || 0;
    const nW = +document.getElementById("i-nweld")?.value || 0;
    const nA = +document.getElementById("i-aweld")?.value || 0;
    const asets = +document.getElementById("i-asets")?.value || 0;
    const rmat = document.getElementById("i-rmat")?.value || "steel";
    const rsInfo = plen > 0 ? TOAEngine.computeRollerSets({ D, t, L: plen, nW, nA, rd, cl }) : null;
    const nSets = asets > 0 ? asets : (rsInfo ? rsInfo.n_rec : 2);
    const spanUse = (plen > 0 && nSets > 0) ? (plen / (nSets + 1)) : D;
    const ge = TOAEngine.rollerAngleDeg(D, rd, cc);
    const bz = TOAEngine.brazier(D, t);
    const hz = TOAEngine.hertz(D, t, rd, cl, { ...this.getP(), L: plen, nSets, rmat });
    const bm = TOAEngine.beam(D, t, spanUse);

    let html = "";
    if (D < 6000) {
      html = `<div class="rec IN"><span class="rec-b">INFO</span><span class="rec-m">${this.t("ldNote")} (D=${D}mm)</span></div>`;
    }
    const mi = (l, v, u, c2 = "") => `<div class="mi"><div class="mi-l">${l}</div><div class="mi-v ${c2}">${v}<span class="mi-u">${u}</span></div></div>`;
    html += `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:10px 0;">`
      + mi(`γ_eff (C-C=${cc})`, ge.toFixed(2), "°")
      + mi("D/t", bz.dt, "", bz.risk === "HIGH" ? "c-rd" : bz.risk === "MODERATE" ? "c-or" : "c-gn")
      + mi("Brazier", bz.risk, "", bz.risk === "HIGH" ? "c-rd" : bz.risk === "MODERATE" ? "c-or" : "c-gn")
      + mi("P_max", hz.Pmax.toFixed(2), "MPa", hz.Pmax > 500 ? "c-rd" : hz.Pmax > 300 ? "c-or" : "")
      + mi("Mcr", (+bz.Mcr).toFixed(2), "GN·m")
      + mi("Beam δ", (+bm.delta).toFixed(2), "mm", bm.delta > 20 ? "c-or" : "")
      + `</div>`;

    html += `<div class="shdr"><div class="sttl">${this.t("ldTitle")}</div></div><div class="recs">`;
    (this.t("ldItems") || []).forEach((item, i) => {
      let v = "";
      if (i === 0) v = `γ=${ge.toFixed(1)}°, α_c=45.0°`;
      else if (i === 1) v = `D/t=${bz.dt} → ${bz.risk}`;
      else if (i === 2) v = `P_max=${hz.Pmax}MPa`;
      else if (i === 3) v = `≤${Math.round(D * 0.5)}mm`;
      else if (i === 4) v = `γ=${ge.toFixed(1)}°${ge < 5 ? " ⚠" : ""}`;
      const lv = (i === 1 && bz.dt > 300) || (i === 2 && hz.Pmax > 500) ? "WA" : "IN";
      html += `<div class="rec ${lv}"><span class="rec-b">${i + 1}</span><span class="rec-m"><b>${item[0]}</b> — ${item[1]}${v ? ` [${v}]` : ""}</span></div>`;
    });
    html += "</div>";
    document.getElementById("tl-body").innerHTML = html;
  },

  renderSampleMainDiagrams() {
    if (typeof TOADiagram === "undefined" || typeof TOAEngine === "undefined") return;
    try {
      const tag = this.t("betaSampleTag") || "[샘플]";
      const sampleRes = TOAEngine.analyze({ D: 8000, t: 20, st: "TR2_45", opts: { zone: "body", fatigue: false } });
      TOADiagram.drawCrossSection(sampleRes, {
        rd: 600,
        theme: this.state.theme,
        dmin: 0,
        dmax: 0,
        labels: {
          nat: this.t("nat"),
          sup: this.t("sup"),
          meas: this.t("meas")
        },
        sampleTag: tag
      });
      const sampleRsInfo = TOAEngine.computeRollerSets({ D: 8000, t: 20, L: 12000, nW: 5, nA: 1, rd: 600, cl: 300 });
      TOADiagram.drawSideView(
        sampleRes,
        4,
        2400,
        12000,
        5,
        1,
        { ...(sampleRsInfo || {}), govLabel: `Hertz ${tag}` },
        this.state.theme,
        { sampleTag: tag, sampleInfoHtml: this.t("betaSvInfoSample") }
      );
    } catch (e) {}
  },

  drawDiag(r) {
    // Beta v0.5: 단면도·측면도 및 보강 도면 모두 샘플 데이터 + [샘플] 표기로 발행
    this.renderSampleMainDiagrams();
    if (this.state.lastReinfPlan) {
      this.renderSampleReinforcement();
    }
  },

  doSave() {
    const r = this.state.lastResult;
    if (!r) { this.toast(this.t("tNoData"), true); return; }

    const nm = document.getElementById("i-rname").value.trim() || `Record-${this.state.records.length + 1}`;
    const devMinRaw = document.getElementById("i-devmin")?.value ?? "";
    const devMaxRaw = document.getElementById("i-devmax")?.value ?? "";
    if ((!document.getElementById("i-dmin")?.value && !document.getElementById("i-dmax")?.value)
      && (String(devMinRaw).trim() !== "" || String(devMaxRaw).trim() !== "")) {
      this.syncMeasuredFields("dev");
    }
    const dmax = +document.getElementById("i-dmax").value || 0;
    const dmin = +document.getElementById("i-dmin").value || 0;
    const devmax = document.getElementById("i-devmax")?.value ?? "";
    const devmin = document.getElementById("i-devmin")?.value ?? "";
    if (dmax > 0 && dmin > 0 && dmax < dmin) {
      this.toast(this.t("measErrOrder"), true);
      return;
    }
    const meas_mm = (dmax > 0 && dmin > 0) ? (dmax - dmin) : 0;
    const meas_pct = meas_mm ? meas_mm / r.p.D * 100 : 0;
    const measComp = (dmax > 0 && dmin > 0) ? TOAEngine.compliance(meas_mm, meas_pct, r.p.D, r.p.t, r.p.opts || {}) : null;
    const rsEl = document.getElementById("rs-sets");
    const minSets = rsEl ? (parseInt(rsEl.textContent, 10) || 0) : 0;

    const newId = Date.now();
    const res = DataStore.addRecord({
      id: newId,
      name: nm,
      ts: new Date().toISOString(),
      p: r.p,
      plen: +document.getElementById("i-plen").value || 0,
      nweld: +document.getElementById("i-nweld").value || 0,
      aweld: +document.getElementById("i-aweld").value || 0,
      asets: +document.getElementById("i-asets").value || 0,
      rmat: document.getElementById("i-rmat").value || "steel",
      rdia: +document.getElementById("i-rdia").value || 600,
      cc_mm: +document.getElementById("i-cc").value || 1200,
      cl_mm: +document.getElementById("i-cl").value || 300,
      platespan: +document.getElementById("i-platespan").value || 0,
      dmax, dmin,
      devmax, devmin,
      measMode: this.state.measMode || "abs",
      ml: +document.getElementById("i-ml")?.value || 0,
      mm: +document.getElementById("i-mm")?.value || 0,
      mr: +document.getElementById("i-mr")?.value || 0,
      mbef: +document.getElementById("i-mbef")?.value || 0,
      maft: +document.getElementById("i-maft")?.value || 0,
      proj: document.getElementById("i-proj")?.value.trim() || "",
      pipeno: document.getElementById("i-pipeno")?.value.trim() || "",
      prep: document.getElementById("i-prep")?.value.trim() || "",
      rev: document.getElementById("i-rev")?.value.trim() || "",
      meas_mm: +meas_mm.toFixed(4),
      meas_pct: +meas_pct.toFixed(6),
      measComp,
      Dv: r.Dv, Dh: r.Dh, oval_mm: r.oval_mm, oval_pct: r.oval_pct,
      vsNat: r.vsNat, natOval_mm: r.natOval_mm, natOval_pct: r.natOval_pct,
      comp: r.comp,
      minSets
    });

    if (!res.success) {
      this.toast(this.t("betaSaveLimitToast"), true);
      return;
    }
    this.state.records = res.records;
    this.renderSaved();
    this.updateReportTargetMenu(`REC:${newId}`);
    this.toast(this.t("tSaved"));
    document.getElementById("i-rname").value = "";
  },

  delRec(id) {
    this.state.records = DataStore.deleteRecord(id);
    this.renderSaved();
    this.toast(this.t("tDeleted"));
  },

  loadRec(id) {
    const rec = this.state.records.find(r => r.id === id);
    if (!rec) return;
    const setVal = (elId, v) => { const el = document.getElementById(elId); if (el && v !== undefined) el.value = v; };
    setVal("iD", rec.p.D); setVal("it", rec.p.t); setVal("i-sup", rec.p.st || "NATURAL");
    if (rec.p.a !== undefined) setVal("i-a", rec.p.a);
    if (rec.p.a1 !== undefined) setVal("i-a1", rec.p.a1);
    if (rec.p.a2 !== undefined) setVal("i-a2", rec.p.a2);
    if (rec.p.ac !== undefined) setVal("i-ac", rec.p.ac);
    if (rec.p.gr !== undefined) setVal("i-gr", rec.p.gr);
    if (rec.p.opts) {
      setVal("i-zone", rec.p.opts.zone || "body");
      setVal("i-fat", rec.p.opts.fatigue ? "true" : "false");
    }
    if (rec.plen) setVal("i-plen", rec.plen);
    if (rec.nweld !== undefined) setVal("i-nweld", rec.nweld);
    if (rec.aweld !== undefined) setVal("i-aweld", rec.aweld);
    if (rec.platespan) setVal("i-platespan", rec.platespan);
    if (rec.rmat) setVal("i-rmat", rec.rmat);
    if (rec.rdia) setVal("i-rdia", rec.rdia);
    if (rec.cc_mm) setVal("i-cc", rec.cc_mm);
    if (rec.cl_mm) setVal("i-cl", rec.cl_mm);
    setVal("i-asets", rec.asets || "");
    const hasAbs = (rec.dmax && +rec.dmax > 0) || (rec.dmin && +rec.dmin > 0);
    const hasDev = (rec.devmax !== undefined && String(rec.devmax).trim() !== "")
      || (rec.devmin !== undefined && String(rec.devmin).trim() !== "");
    this.state.measMode = hasAbs ? "abs" : (hasDev ? "dev" : (rec.measMode || "abs"));
    setVal("i-dmax", rec.dmax ? rec.dmax : "");
    setVal("i-dmin", rec.dmin ? rec.dmin : "");
    setVal("i-devmax", rec.devmax !== undefined ? rec.devmax : "");
    setVal("i-devmin", rec.devmin !== undefined ? rec.devmin : "");
    setVal("i-ml", rec.ml || ""); setVal("i-mm", rec.mm || ""); setVal("i-mr", rec.mr || "");
    setVal("i-mbef", rec.mbef || ""); setVal("i-maft", rec.maft || "");
    setVal("i-proj", rec.proj || ""); setVal("i-pipeno", rec.pipeno || "");
    setVal("i-prep", rec.prep || ""); setVal("i-rev", rec.rev || "");
    if (hasAbs) {
      this.syncMeasuredFields("abs");
    } else if (hasDev) {
      this.syncMeasuredFields("dev");
    }

    this.onSupChange();
    this.onRmatChange();
    const prevLast = this.state.lastResult;
    this.state.lastResult = null; // calcDT()가 이전 상태로 runAnalysis 중복 실행하며 실측값을 덮어쓰는 것 방지
    this.calcDT();
    this.state.lastResult = prevLast;
    try {
      const r = TOAEngine.analyze(rec.p);
      this.state.lastResult = r;
      this.saveLastState();
      this.renderNat(r); this.renderSup(r); this.renderMeas(r);
      this.renderMetrics(r, rec.p); this.renderCompliance(r); this.renderRecs(r);
      this.renderOvalBendAlert(r);
      this.drawDiag(r); this.renderLdia(rec.p.D, rec.p.t);
      this.updateStat(r); this.calcRollerSets();
      this.updateReportTargetMenu(`REC:${id}`);
      this.goTab("tc");
      this.toast("↩ " + rec.name);
    } catch (err) {
      this.toast("⚠ " + err.message, true);
    }
  },

  doExport() {
    if (!DataStore.exportJSON(this.state.records)) {
      this.toast(this.t("tNoRec"), true);
      return;
    }
    this.toast(this.t("tExported"));
  },

  doCsvExport() {
    this.toast(this.t("betaCsvToast"), true);
  },

  getReportSections() {
    const chk = id => {
      const el = document.getElementById(id);
      return el ? !!el.checked : true;
    };
    return {
      comp: chk("rpt-inc-comp"),
      cmp: chk("rpt-inc-cmp"),
      diag: chk("rpt-inc-diag"),
      recs: chk("rpt-inc-recs"),
      chk: chk("rpt-inc-chk")
    };
  },

  buildReportExtras(r, spec, meas_mm, measComp) {
    const D = r.p.D, t = r.p.t;
    const plen = spec.plen || 12000;
    const rd = spec.rdia || 600;
    const cc = spec.cc_mm || 1200;
    const cl = spec.cl_mm || 300;
    const nW = spec.nweld || 0;
    const nA = spec.aweld || 0;
    const asets = spec.asets || 0;
    const rmat = spec.rmat || "steel";

    // 1. 상태 비교 (compareList)
    const all = TOAEngine.analyzeAll(D, t, r.p.opts || {});
    const cmMap = { NATURAL: "oNat", SADDLE120: "oSad", TR2_30: "oT2c", TR2_45: "oT2b", TR2_491: "oT2a", TR4_STD: "oT4a" };
    const compareList = ["NATURAL", "SADDLE120", "TR2_30", "TR2_45", "TR2_491", "TR4_STD"]
      .filter(k => all[k])
      .map(k => ({
        st: k,
        label: this.t(cmMap[k]) || k,
        Dv: all[k].Dv,
        Dh: all[k].Dh,
        oval_mm: all[k].oval_mm,
        oval_pct: all[k].oval_pct,
        vsNatPct: +(all[k].vsNat * 100).toFixed(2),
        api2b: !!(all[k].comp && all[k].comp.API_2B && all[k].comp.API_2B.pass),
        iso: !!(all[k].comp && all[k].comp.ISO_19902 && all[k].comp.ISO_19902.pass)
      }));

    // 2. 권고사항 및 보강 제안
    const msgs = this.t("rMsgs") || [];
    const recsList = [];
    if (r.oval_pct > 5 && this.t("linWarn") && this.t("linWarn") !== "linWarn") {
      recsList.push({ level: "LIM", msg: this.t("linWarn") });
    }
    if (r.ringBendStressMPa >= 100) {
      const bMsg = (this.t("ringBendWarn") && this.t("ringBendWarn") !== "ringBendWarn")
        ? this.t("ringBendWarn").replace("{sb}", r.ringBendStressMPa)
        : `링 자중 굽힘응력 σ_b = ${r.ringBendStressMPa} MPa`;
      recsList.push({ level: r.ringBendStressMPa >= 175 ? "CR" : "WA", msg: bMsg });
    }
    [
      { k: "CR", ok: !r.comp.API_2B.pass, mi: 0 },
      { k: "CR", ok: !r.comp.ISO_19902.pass, mi: 1 },
      { k: "CR", ok: !r.comp.DNV.pass, mi: 2 },
      { k: "WA", ok: D / t > 300, mi: 3 },
      { k: "CA", ok: D / t > 200 && D / t <= 300, mi: 4 },
      { k: "CA", ok: D >= 6000, mi: 5 },
      { k: "IN", ok: (r.p.st || "").toUpperCase() === "NATURAL", mi: 6 },
      { k: "IN", ok: (r.p.st || "").toUpperCase() === "SADDLE120", mi: 7 },
      { k: "IN", ok: true, mi: 8 },
      { k: "IN", ok: true, mi: 9 }
    ].forEach(it => {
      if (it.ok && msgs[it.mi]) recsList.push({ level: it.k, msg: msgs[it.mi] });
    });

    const reinfPlan = typeof TOAEngine.designReinforcement === "function"
      ? TOAEngine.designReinforcement({
        D, t, L: plen, ovalMm: r.oval_mm, measOvalMm: meas_mm,
        comp: r.comp, measComp, thetaMaxDeg: r.thetaMaxDeg, thetaMinDeg: r.thetaMinDeg,
        st: r.p.st, rd, cl, nW, nA, stdOpts: r.p.opts || {}
      })
      : null;
    let reinfGuideText = "";
    let reinfCsImg = "", reinfSvImg = "";
    if (reinfPlan && reinfPlan.needed) {
      const kMap = { SUPPORT_ONLY: "reinfGuideOnly", COMBINE_ALL: "reinfGuideAll", SELECT_ONE: "reinfGuideSel" };
      const gKey = kMap[reinfPlan.strategy] || "reinfGuideSel";
      const gTxt = this.t(gKey);
      reinfGuideText = (gTxt && gTxt !== gKey) ? gTxt : "";
      if (typeof TOADiagram !== "undefined" && typeof TOADiagram.drawReinforcement === "function") {
        try {
          const rCs = document.getElementById("cvs-reinf-cs");
          const rSv = document.getElementById("cvs-reinf-sv");
          TOADiagram.drawReinforcement(rCs, rSv, reinfPlan, false);
          if (rCs && typeof rCs.toDataURL === "function") reinfCsImg = rCs.toDataURL("image/png");
          if (rSv && typeof rSv.toDataURL === "function") reinfSvImg = rSv.toDataURL("image/png");
          if (this.state.lastReinfPlan) {
            TOADiagram.drawReinforcement(rCs, rSv, this.state.lastReinfPlan, this.state.theme === "dark");
          }
        } catch (e) {}
      }
    }

    // 3. 체크리스트 & 주요 지표
    const rs = TOAEngine.computeRollerSets({ D, t, L: plen, nW, nA, rd, cl });
    const nSets = asets > 0 ? asets : (rs ? rs.n_rec : 2);
    const spanUse = (plen > 0 && nSets > 0) ? (plen / (nSets + 1)) : D;
    const ge = TOAEngine.rollerAngleDeg(D, rd, cc);
    const bz = TOAEngine.brazier(D, t);
    const hz = TOAEngine.hertz(D, t, rd, cl, { ...r.p, L: plen, nSets, rmat });
    const bm = TOAEngine.beam(D, t, spanUse);
    const ldItems = (this.t("ldItems") || []).map((item, i) => {
      let val = "";
      if (i === 0) val = `γ=${ge.toFixed(1)}°, α_c=45.0°`;
      else if (i === 1) val = `D/t=${bz.dt} → ${bz.risk}`;
      else if (i === 2) val = `P_max=${hz.Pmax}MPa`;
      else if (i === 3) val = `≤${Math.round(D * 0.5)}mm`;
      else if (i === 4) val = `γ=${ge.toFixed(1)}°`;
      return { title: item[0], desc: item[1], val };
    });
    const checklist = {
      ge: ge.toFixed(2),
      dt: bz.dt,
      brazierRisk: bz.risk,
      pmax: hz.Pmax.toFixed(2),
      mcr: (+bz.Mcr).toFixed(2),
      beamDelta: (+bm.delta).toFixed(2),
      items: ldItems
    };

    return { compareList, recsList, reinfPlan, reinfGuideText, reinfCsImg, reinfSvImg, checklist };
  },

  buildCurrentReportEntry() {
    const r = this.state.lastResult;
    if (!r) return null;
    const nm = document.getElementById("i-rname")?.value.trim() || "Current-Analysis";
    const dmax = +document.getElementById("i-dmax")?.value || 0;
    const dmin = +document.getElementById("i-dmin")?.value || 0;
    const meas_mm = (dmax > 0 && dmin > 0 && dmax >= dmin) ? (dmax - dmin) : 0;
    const meas_pct = meas_mm ? meas_mm / r.p.D * 100 : 0;
    const measComp = meas_mm ? TOAEngine.compliance(meas_mm, meas_pct, r.p.D, r.p.t, r.p.opts || {}) : null;
    const rsEl = document.getElementById("rs-sets");
    const minSets = rsEl ? (parseInt(rsEl.textContent, 10) || 0) : 0;
    const cvs = document.getElementById("cvs");
    const cvsSv = document.getElementById("cvs-sv");
    let csImg = "", svImg = "";
    try { if (cvs && typeof cvs.toDataURL === "function") csImg = cvs.toDataURL("image/png"); } catch (e) {}
    try { if (cvsSv && typeof cvsSv.toDataURL === "function") svImg = cvsSv.toDataURL("image/png"); } catch (e) {}
    const nwRaw = parseInt(document.getElementById("i-nweld")?.value, 10);
    const awRaw = parseInt(document.getElementById("i-aweld")?.value, 10);
    const spec = {
      plen: +document.getElementById("i-plen")?.value || 0,
      nweld: isNaN(nwRaw) ? 0 : nwRaw,
      aweld: isNaN(awRaw) ? 0 : awRaw,
      asets: +document.getElementById("i-asets")?.value || 0,
      rmat: document.getElementById("i-rmat")?.value || "steel",
      rdia: +document.getElementById("i-rdia")?.value || 600,
      cc_mm: +document.getElementById("i-cc")?.value || 1200,
      cl_mm: +document.getElementById("i-cl")?.value || 300
    };
    const extras = this.buildReportExtras(r, spec, meas_mm, measComp);
    return {
      name: nm,
      ts: new Date().toISOString(),
      p: r.p,
      ...spec,
      dmax, dmin, meas_mm, meas_pct, measComp,
      ml: +document.getElementById("i-ml")?.value || 0,
      mm: +document.getElementById("i-mm")?.value || 0,
      mr: +document.getElementById("i-mr")?.value || 0,
      mbef: +document.getElementById("i-mbef")?.value || 0,
      maft: +document.getElementById("i-maft")?.value || 0,
      docMeta: {
        proj: document.getElementById("i-proj")?.value.trim() || "",
        pipeno: document.getElementById("i-pipeno")?.value.trim() || "",
        prep: document.getElementById("i-prep")?.value.trim() || "",
        rev: document.getElementById("i-rev")?.value.trim() || ""
      },
      Dv: r.Dv, Dh: r.Dh, oval_mm: r.oval_mm, oval_pct: r.oval_pct,
      vsNat: r.vsNat, natOval_mm: r.natOval_mm, natOval_pct: r.natOval_pct,
      comp: r.comp,
      minSets,
      csImg,
      svImg,
      ...extras
    };
  },

  updateReportTargetMenu(preferredVal) {
    const sel = document.getElementById("i-rpt-target");
    if (!sel) return;
    sel.innerHTML = `<option value="SAMPLE">${this.t("betaRptTargetSample")}</option>`;
    sel.value = "SAMPLE";
  },

  buildReportEntryFromSaved(rec) {
    if (!rec || !rec.p) return null;
    const r = TOAEngine.analyze(rec.p);
    const dmax = +rec.dmax || 0;
    const dmin = +rec.dmin || 0;
    const hasMeas = dmax > 0 && dmin > 0 && dmax >= dmin;
    const meas_mm = hasMeas ? (rec.meas_mm != null ? +rec.meas_mm : (dmax - dmin)) : 0;
    const meas_pct = hasMeas ? (rec.meas_pct != null ? +rec.meas_pct : (meas_mm / rec.p.D * 100)) : 0;
    const measComp = hasMeas ? (rec.measComp || TOAEngine.compliance(meas_mm, meas_pct, rec.p.D, rec.p.t, rec.p.opts || {})) : null;
    const rsInfo = TOAEngine.computeRollerSets({
      D: rec.p.D,
      t: rec.p.t,
      L: rec.plen || 12000,
      nW: rec.nweld || 0,
      nA: rec.aweld || 0,
      rd: rec.rdia || 600,
      cl: rec.cl_mm || 300
    });
    const minSets = rec.minSets || (rsInfo ? rsInfo.n_rec : 0);

    let csImg = "", svImg = "";
    if (typeof TOADiagram !== "undefined") {
      try {
        TOADiagram.drawCrossSection(r, {
          rd: rec.rdia || 600,
          theme: this.state.theme,
          dmin,
          dmax,
          labels: { nat: this.t("nat"), sup: this.t("sup"), meas: this.t("meas") }
        });
        if (rsInfo) {
          const govDict = this.t("govLabels") || {};
          const govLabel = rsInfo.govKeys.map(k => govDict[k] || k).join("·");
          TOADiagram.drawSideView(
            r, minSets || rsInfo.n_rec, rsInfo.span_rec, rec.plen || 12000,
            rec.nweld || 0, rsInfo.effNA ?? (rec.aweld || 0), { ...rsInfo, govLabel }, this.state.theme
          );
        }
        const cvs = document.getElementById("cvs");
        const cvsSv = document.getElementById("cvs-sv");
        if (cvs && typeof cvs.toDataURL === "function") csImg = cvs.toDataURL("image/png");
        if (cvsSv && typeof cvsSv.toDataURL === "function") svImg = cvsSv.toDataURL("image/png");
      } catch (e) {}
      if (this.state.lastResult) {
        try {
          this.drawDiag(this.state.lastResult);
          this.calcRollerSets();
        } catch (e) {}
      }
    }

    const spec = {
      plen: rec.plen || 0,
      nweld: rec.nweld || 0,
      aweld: rec.aweld || 0,
      asets: rec.asets || 0,
      rmat: rec.rmat || "steel",
      rdia: rec.rdia || 600,
      cc_mm: rec.cc_mm || 1200,
      cl_mm: rec.cl_mm || 300
    };
    const extras = this.buildReportExtras(r, spec, meas_mm, measComp);
    return {
      name: rec.name,
      ts: rec.ts || new Date().toISOString(),
      p: r.p,
      ...spec,
      dmax, dmin, meas_mm, meas_pct, measComp,
      ml: +document.getElementById("i-ml")?.value || 0,
      mm: +document.getElementById("i-mm")?.value || 0,
      mr: +document.getElementById("i-mr")?.value || 0,
      mbef: +document.getElementById("i-mbef")?.value || 0,
      maft: +document.getElementById("i-maft")?.value || 0,
      docMeta: {
        proj: document.getElementById("i-proj")?.value.trim() || "",
        pipeno: document.getElementById("i-pipeno")?.value.trim() || "",
        prep: document.getElementById("i-prep")?.value.trim() || "",
        rev: document.getElementById("i-rev")?.value.trim() || ""
      },
      Dv: r.Dv, Dh: r.Dh, oval_mm: r.oval_mm, oval_pct: r.oval_pct,
      vsNat: r.vsNat, natOval_mm: r.natOval_mm, natOval_pct: r.natOval_pct,
      comp: r.comp,
      minSets,
      csImg,
      svImg,
      ...extras
    };
  },

  resolveReportPayload() {
    const sel = document.getElementById("i-rpt-target");
    const val = sel ? (sel.value || "CURRENT") : "CURRENT";
    if (val.startsWith("REC:")) {
      const idStr = val.slice(4);
      const rec = this.state.records.find(r => String(r.id) === idStr);
      if (rec) {
        return { records: [rec], cur: this.buildReportEntryFromSaved(rec) };
      }
    }
    if (val === "ALL") {
      return { records: this.state.records, cur: null };
    }
    const cur = this.buildCurrentReportEntry()
      || (this.state.records.length ? this.buildReportEntryFromSaved(this.state.records[this.state.records.length - 1]) : null);
    return { records: this.state.records, cur };
  },

  doXlsExport() {
    this.toast(this.t("betaXlsToast"), true);
  },

  doPdfExport() {
    let reinfCsImg = "", reinfSvImg = "";
    const tag = this.t("betaSampleTag") || "[샘플]";
    try {
      const samplePlan = this.getSampleReinfPlan();
      const tmpCs = document.createElement("canvas");
      tmpCs.width = 380; tmpCs.height = 360;
      const tmpSv = document.createElement("canvas");
      tmpSv.width = 540; tmpSv.height = 360;
      if (typeof TOADiagram !== "undefined" && typeof TOADiagram.drawReinforcement === "function") {
        TOADiagram.drawReinforcement(tmpCs, tmpSv, samplePlan, false, tag);
        reinfCsImg = tmpCs.toDataURL("image/png");
        reinfSvImg = tmpSv.toDataURL("image/png");
      }
    } catch (e) {}
    if (!DataStore.exportSamplePDF({ reinfCsImg, reinfSvImg }, this.state.lang)) {
      this.toast(this.t("betaPdfToastBlocked"), true);
      return;
    }
    this.toast(this.t("betaPdfToastOk"));
  },

  doImport() {
    document.getElementById("file-inp").click();
  },

  onFileLoad(ev) {
    const f = ev.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const d = JSON.parse(e.target.result);
        const list = d.recs || d.records || (Array.isArray(d) ? d : []);
        const res = DataStore.importRecords(list);
        this.state.records = res.records;
        this.renderSaved();
        this.toast(`${this.t("tImported")} (+${res.added})`);
        if (res.blockedByLimit) {
          this.toast(this.t("betaSaveLimitToast"), true);
        }
      } catch (err) {
        this.toast("Import error: " + err.message, true);
      }
    };
    reader.readAsText(f);
    ev.target.value = "";
  },

  doClear() {
    if (!this.state.records.length) return;
    if (!confirm(`${this.t("tCleared")}\n(${this.state.records.length} records)`)) return;
    this.state.records = DataStore.clearRecords();
    this.renderSaved();
    this.toast(this.t("tCleared"));
  },

  renderSaved() {
    this.updCnt();
    this.updateReportTargetMenu();
    const body = document.getElementById("ts-body");
    if (!body) return;
    if (!this.state.records.length) {
      body.innerHTML = `<div class="ph"><p>${this.t("phTs")}</p></div>`;
      return;
    }
    const esc = str => String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const codes = ["API_2B", "ISO_19902", "API_5L", "DNV"];
    const codeLabels = { API_2B: "API2B", ISO_19902: "ISO", API_5L: "5L", DNV: "DNV" };

    let html = "";
    this.state.records.slice().reverse().forEach(rec => {
      const comp = rec.comp || {};
      let badges = "";
      codes.forEach(k => {
        if (comp[k]) {
          if (comp[k].agreementRequired) {
            badges += `<span class="pill w" style="font-size:8px;padding:1px 5px;" title="Agreement Required">${codeLabels[k]}?</span>`;
          } else {
            badges += `<span class="pill ${comp[k].pass ? "p" : "f"}" style="font-size:8px;padding:1px 5px;">${codeLabels[k]}</span>`;
          }
        }
      });
      let measBadge = "";
      if (rec.dmax && rec.dmin) {
        const mok = rec.measComp && rec.measComp.API_2B ? rec.measComp.API_2B.pass : (rec.meas_pct || 0) <= 1;
        measBadge = `<span class="pill ${mok ? "p" : "f"}" style="font-size:8px;padding:1px 5px;">실측${(rec.meas_pct || 0).toFixed(2)}%</span>`;
      }
      const pct = rec.oval_pct || 0;
      const ok = comp.API_2B ? comp.API_2B.pass : pct <= 1;
      const dt = new Date(rec.ts);
      const ds = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")} ${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
      let sub = `D=${rec.p.D} t=${rec.p.t} ${rec.p.st}`;
      if (rec.plen) sub += ` L=${rec.plen}`;
      if (rec.rmat) sub += ` [${rec.rmat.toUpperCase()}]`;
      if (rec.minSets) sub += ` Sets≥${rec.minSets}`;
      sub += ` | ${ds}`;

      html += `<div class="sav-item">`
        + `<div class="sav-info">`
        + `<div class="sav-name">${esc(rec.name)}</div>`
        + `<div class="sav-sub">${esc(sub)}</div>`
        + `<div style="display:flex;gap:3px;flex-wrap:wrap;margin-top:3px;">${badges}${measBadge}</div>`
        + `</div>`
        + `<span class="sav-pct ${ok ? "p" : "f"}">${pct.toFixed(4)}%</span>`
        + `<button class="btn-sm" onclick="App.loadRec(${rec.id})">↩</button>`
        + `<button class="btn-sm r" onclick="App.delRec(${rec.id})">✕</button>`
        + `</div>`;
    });
    body.innerHTML = html;
  },

  openManualModal() {
    const modal = document.getElementById("subPageModal");
    const titleEl = document.getElementById("subPageTitle");
    const bodyEl = document.getElementById("subPageBody");
    if (!modal || !bodyEl) return;
    if (typeof HelpManual !== "undefined") {
      HelpManual.renderModal(this.state.lang, titleEl, bodyEl, k => this.t(k));
    }
    modal.classList.remove("hidden");
  },

  openProModal(context = "") {
    const isPro = this.state.plan === "pro";
    const title = isPro ? this.t("proModalTitleManage") : this.t("proModalTitleUnlock");
    const savedLic = (typeof LicenseManager !== "undefined") ? LicenseManager.getSavedLicense() : null;
    const devCode = (typeof LicenseManager !== "undefined") ? LicenseManager.getDeviceCode() : "00000";
    const prevName = savedLic && savedLic.name ? savedLic.name.replace(/"/g, "&quot;") : "";
    const prevCode = savedLic && savedLic.code ? savedLic.code.replace(/"/g, "&quot;") : "";

    let subNotice = "";
    if (context === "CSV_EXPORT") {
      subNotice = `<div style="background:#eff6ff;color:#1e40af;padding:10px 14px;border-radius:8px;font-weight:800;font-size:12px;margin-bottom:14px;border:1px solid #bfdbfe;">🔒 ${this.t("proCsvLockNotice")}</div>`;
    } else if (context === "DATA_LIMIT") {
      subNotice = `<div style="background:#fef3c7;color:#92400e;padding:10px 14px;border-radius:8px;font-weight:800;font-size:12px;margin-bottom:14px;border:1px solid #fde68a;">⚠️ ${this.t("proLimitNotice")}</div>`;
    }

    const activeBanner = isPro
      ? `<div style="background:#ebfbee;border:1.5px solid #38d9a9;border-radius:10px;padding:10px 12px;font-size:12.5px;font-weight:800;color:#087f5b;margin-bottom:14px;">${this.t("proActiveBanner").replace("{dev}", devCode)}</div>`
      : "";

    const body = `
      <div style="padding: 4px 0; text-align:left;">
        ${subNotice}
        ${activeBanner}
        <div style="background:var(--bg-soft);border:1px solid var(--border-light);border-radius:10px;padding:12px 14px;font-size:12.5px;line-height:1.6;margin-bottom:14px;">
          <strong style="color:var(--brand-orange);">${this.t("proModalBenefitsTitle")}</strong><br>
          ${this.t("proModalBenefit1")}<br>
          ${this.t("proModalBenefit2")}<br>
          ${this.t("proModalBenefit3")}
        </div>

        <div style="background:#e7f5ff;border:1.5px solid #74c0fc;border-radius:12px;padding:12px 14px;margin-bottom:12px;">
          <div style="font-size:13px;font-weight:900;color:#1864ab;margin-bottom:8px;">📧 ${this.t("proStep1Title")}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
            <div>
              <label style="display:block;font-size:11px;font-weight:800;color:#495057;margin-bottom:4px;">${this.t("proStep1Dev")}</label>
              <input type="text" value="${devCode}" readonly style="width:100%;padding:9px;font-family:monospace;font-size:15px;font-weight:900;color:var(--brand-orange);background:#f8f9fa;border:1.5px solid #ced4da;border-radius:8px;text-align:center;">
            </div>
            <div>
              <label style="display:block;font-size:11px;font-weight:800;color:#495057;margin-bottom:4px;">${this.t("proStep1Name")} <span style="color:#e03131;">*</span></label>
              <input type="text" id="toaProRegName" value="${prevName}" placeholder="${this.t("proStep1NamePh")}" style="width:100%;padding:9px;font-size:13px;font-weight:700;border:1.5px solid #adb5bd;border-radius:8px;background:#fff;color:#111;">
            </div>
          </div>
          <label style="display:block;font-size:11px;font-weight:800;color:#495057;margin-bottom:4px;">${this.t("proStep1Email")} <span style="color:#e03131;">*</span></label>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <input type="email" id="toaEmailApplyInput" placeholder="${this.t("proStep1EmailPh")}" style="flex:1;min-width:170px;padding:9px 10px;font-size:13px;font-weight:700;border:1.5px solid #adb5bd;border-radius:8px;background:#fff;color:#111;">
            <button type="button" id="toaBtnApplyEmail" style="background:#1864ab;color:#fff;border:none;border-radius:8px;padding:9px 14px;font-size:12.5px;font-weight:900;cursor:pointer;white-space:nowrap;">${this.t("proStep1BtnGet")}</button>
          </div>
          <div id="toaEmailApplyStatus" style="margin-top:8px;font-size:11.5px;color:#495057;line-height:1.5;">
            ${this.t("proStep1Guide")}<br>
            <span style="color:#e03131;font-weight:700;">${this.t("proStep1Spam")}</span>
          </div>
        </div>

        <div style="border:1.5px solid var(--border-light);border-radius:12px;padding:12px 14px;margin-bottom:12px;background:var(--bg-card);">
          <div style="font-size:13px;font-weight:900;margin-bottom:8px;">${this.t("proStep2Title")}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
            <a href="https://qr.kakaopay.com/FLfFztgIX5dc01361" target="_blank" rel="noopener" style="display:flex;align-items:center;justify-content:center;background:#FEE500;color:#191919;text-decoration:none;padding:10px 8px;border-radius:8px;font-size:12.5px;font-weight:900;border:1.5px solid #e6cf00;">${this.t("proStep2Kakao")}</a>
            <a href="https://buymeacoffee.com/iskorea" target="_blank" rel="noopener" style="display:flex;align-items:center;justify-content:center;background:#FFDD00;color:#000000;text-decoration:none;padding:10px 8px;border-radius:8px;font-size:12.5px;font-weight:900;border:1.5px solid #ebd000;">${this.t("proStep2Bmac")}</a>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg-soft);padding:7px 10px;border-radius:8px;font-size:11.5px;">
            <span>${this.t("proStep2Inquiry")}</span>
            <a href="https://pf.kakao.com/_hALxeX/chat" target="_blank" rel="noopener" style="color:var(--brand-orange);font-weight:800;text-decoration:underline;">${this.t("proStep2Chat")}</a>
          </div>
        </div>

        <div style="background:var(--bg-soft);border:1.5px solid var(--border-light);border-radius:12px;padding:12px 14px;">
          <div style="font-size:13px;font-weight:900;margin-bottom:4px;">${this.t("proStep3Title")}</div>
          <div style="font-size:11.5px;opacity:0.8;margin-bottom:8px;">${this.t("proStep3Desc")}</div>
          <input type="text" id="toaProRegCode" value="${prevCode}" placeholder="TOA-${devCode}-XXXXX-XXXXX" oninput="this.value=this.value.toUpperCase()" style="width:100%;font-family:monospace;font-weight:900;font-size:14px;letter-spacing:1.2px;text-align:center;color:#065f46;background:#fff;padding:10px;border:1.5px solid #adb5bd;border-radius:8px;margin-bottom:10px;">
          <button type="button" id="toaBtnVerifyPro" style="width:100%;height:44px;border:none;border-radius:8px;background:var(--brand-orange);color:#fff;font-size:14px;font-weight:900;cursor:pointer;">${this.t("proModalBtnActivate")}</button>
          <div id="toaProAuthMessage" style="margin-top:8px;font-size:12.5px;font-weight:800;text-align:center;"></div>
        </div>
      </div>
    `;

    const modal = document.getElementById("subPageModal");
    const titleEl = document.getElementById("subPageTitle");
    const bodyEl = document.getElementById("subPageBody");
    if (!modal || !bodyEl) return;
    if (titleEl) titleEl.textContent = title;
    bodyEl.innerHTML = body;
    modal.classList.remove("hidden");

    document.getElementById("toaBtnApplyEmail")?.addEventListener("click", () => {
      if (typeof LicenseManager !== "undefined") LicenseManager.applyByEmail(k => this.t(k));
    });

    document.getElementById("toaBtnVerifyPro")?.addEventListener("click", () => {
      if (typeof LicenseManager === "undefined") return;
      const res = LicenseManager.verifyAndActivate(k => this.t(k));
      if (res.ok) {
        this.state.plan = res.plan;
        this.updatePlanBadge();
        this.renderSaved();
        setTimeout(() => this.closeModal(), 650);
      }
    });
  },

  closeModal() {
    document.getElementById("subPageModal")?.classList.add("hidden");
  },

  toast(msg, err = false) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.className = "toast" + (err ? " err" : "");
    el.classList.add("show");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("show"), 2600);
  }
};

window.App = App;
window.MainController = { handleNetBadgeClick: () => App.handleNetBadgeClick() };
window.addEventListener("DOMContentLoaded", () => App.init());
