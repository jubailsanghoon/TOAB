/**
 * TOA - Storage & Export Manager
 * Handles LocalStorage persistence, Pro/Free record limits, JSON & CSV export.
 */
const DataStore = (() => {
  const STORAGE_KEYS = {
    RECORDS: "toab_recs_v05",
    PLAN: "TOAB_PLAN_V05",
    THEME: "HI_DARK_MODE",
    LANG: "HI_LANG",
    LAST_STATE: "TOAB_LAST_STATE_V05"
  };

  const PLAN_LIMITS = {
    free: 5,
    beta: 5,
    pro: 5
  };

  function getPlan() {
    return "beta";
  }

  function setPlan(plan) {
    try {
      localStorage.setItem(STORAGE_KEYS.PLAN, "beta");
    } catch (e) {}
  }

  function getPlanLimit() {
    return 5;
  }

  function getRecords() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.RECORDS) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveRecords(records) {
    try {
      localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(records));
    } catch (e) {}
  }

  function addRecord(record) {
    const records = getRecords();
    const limit = getPlanLimit();
    if (records.length >= limit) {
      return { success: false, reason: "limit_reached", limit };
    }
    records.push(record);
    saveRecords(records);
    return { success: true, records };
  }

  function deleteRecord(id) {
    const records = getRecords().filter(r => r.id !== id);
    saveRecords(records);
    return records;
  }

  function clearRecords() {
    saveRecords([]);
    return [];
  }

  function importRecords(list) {
    const records = getRecords();
    const limit = getPlanLimit();
    let added = 0;
    let blockedByLimit = false;

    for (let i = 0; i < list.length; i++) {
      const rec = list[i];
      if (!rec || !rec.id || !rec.p) continue;
      if (records.some(r => r.id === rec.id)) continue;
      if (records.length >= limit) {
        blockedByLimit = true;
        break;
      }
      records.push(rec);
      added++;
    }
    saveRecords(records);
    return { records, added, blockedByLimit };
  }

  function exportJSON(records) {
    if (!records || !records.length) return false;
    const payload = {
      app: "TubularOvalityEngine",
      v: "1.0",
      exported: new Date().toISOString(),
      recs: records
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `TubularOvality_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    return true;
  }

  function exportCSV(records) {
    if (!records || !records.length) return false;
    const headers = [
      "No", "Name", "Saved At", "D(mm)", "t(mm)", "Support", "PipeLen(mm)",
      "RollerMat", "RollerDia(mm)", "C-C(mm)", "ContactLen(mm)", "MinSets", "ActualSets",
      "Dv(mm)", "Dh(mm)", "PredOval(mm)", "PredOval(%)", "API_2B", "ISO_19902", "API_5L", "DNV",
      "Dmax(mm)", "Dmin(mm)", "MeasOval(mm)", "MeasOval(%)"
    ];
    const escCsv = val => `"${String(val == null ? "" : val).replace(/"/g, '""')}"`;
    const rows = [headers.join(",")];

    records.forEach((r, idx) => {
      const comp = r.comp || {};
      rows.push([
        idx + 1,
        r.name || "",
        r.ts || "",
        r.p ? r.p.D : "",
        r.p ? r.p.t : "",
        r.p ? r.p.st : "",
        r.plen || "",
        r.rmat || "",
        r.rdia || "",
        r.cc_mm || "",
        r.cl_mm || "",
        r.minSets || "",
        r.asets || "",
        r.Dv != null ? Number(r.Dv).toFixed(2) : "",
        r.Dh != null ? Number(r.Dh).toFixed(2) : "",
        r.oval_mm != null ? Number(r.oval_mm).toFixed(3) : "",
        r.oval_pct != null ? Number(r.oval_pct).toFixed(4) : "",
        comp.API_2B ? (comp.API_2B.pass ? "PASS" : "FAIL") : "",
        comp.ISO_19902 ? (comp.ISO_19902.pass ? "PASS" : "FAIL") : "",
        comp.API_5L ? (comp.API_5L.agreementRequired ? "AGREEMENT REQUIRED" : (comp.API_5L.pass ? "PASS" : "FAIL")) : "",
        comp.DNV ? (comp.DNV.pass ? "PASS" : "FAIL") : "",
        r.dmax || "",
        r.dmin || "",
        r.meas_mm != null ? Number(r.meas_mm).toFixed(3) : "",
        r.meas_pct != null ? Number(r.meas_pct).toFixed(4) : ""
      ].map(escCsv).join(","));
    });

    const csv = "\uFEFF" + rows.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `TubularOvality_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    return true;
  }

  function escHtml(val) {
    return String(val == null ? "" : val)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function passBadgeStyle(pass, forExcel = false) {
    if (forExcel) {
      return pass
        ? 'background:#dcfce7;color:#15803d;font-weight:bold;text-align:center;'
        : 'background:#fee2e2;color:#b91c1c;font-weight:bold;text-align:center;';
    }
    return pass ? "pill p" : "pill f";
  }

  function formatStamp() {
    return new Date().toISOString().split("T")[0];
  }

  function buildCompRowsHtml(comp, forExcel = false) {
    if (!comp) return "";
    const keys = comp.CUSTOM ? ["API_2B", "ISO_19902", "API_5L", "DNV", "CUSTOM"] : ["API_2B", "ISO_19902", "API_5L", "DNV"];
    return keys.map(k => {
      const v = comp[k];
      if (!v) return "";
      let badge;
      if (v.agreementRequired) {
        badge = forExcel
          ? `<td style="background:#fffbeb;color:#d97706;font-weight:bold;text-align:center;">AGREEMENT REQ.</td>`
          : `<td><span class="pill w">AGREEMENT REQ.</span></td>`;
      } else {
        const st = passBadgeStyle(v.pass, forExcel);
        badge = forExcel
          ? `<td style="${st}">${v.pass ? "PASS" : "FAIL"}</td>`
          : `<td><span class="${st}">${v.pass ? "PASS" : "FAIL"}</span></td>`;
      }
      const marStr = v.agreementRequired ? "—" : `${v.mar > 0 ? "+" : ""}${Number(v.mar).toFixed(2)}%`;
      const limMm = v.agreementRequired ? `Ref ${Number(v.lmm).toFixed(2)} mm` : `${Number(v.lmm).toFixed(2)} mm`;
      const limPct = v.agreementRequired ? `Ref ${Number(v.lpct).toFixed(2)}%` : `${Number(v.lpct).toFixed(2)}%`;
      return `<tr>`
        + `<td><b>${escHtml(v.label || k)}</b></td>`
        + `<td>${Number(v.oval_mm).toFixed(2)} mm / ${Number(v.oval_pct).toFixed(2)}%</td>`
        + `<td>${limMm}</td>`
        + `<td>${limPct}</td>`
        + `<td style="color:${v.agreementRequired ? "#d97706" : (v.mar > 0 ? "#15803d" : "#b91c1c")};font-weight:bold;">${marStr}</td>`
        + badge
        + `</tr>`;
    }).join("");
  }

  function buildRecordCells(r, idx) {
    const comp = r.comp || {};
    return [
      idx + 1,
      r.name || "",
      r.ts || "",
      r.p ? r.p.D : "",
      r.p ? r.p.t : "",
      r.p ? r.p.st : "",
      r.plen || "",
      r.rmat || "",
      r.rdia || "",
      r.cc_mm || "",
      r.cl_mm || "",
      r.minSets || "",
      r.asets || "",
      r.Dv != null ? Number(r.Dv).toFixed(2) : "",
      r.Dh != null ? Number(r.Dh).toFixed(2) : "",
      r.oval_mm != null ? Number(r.oval_mm).toFixed(3) : "",
      r.oval_pct != null ? Number(r.oval_pct).toFixed(4) : "",
      comp.API_2B ? (comp.API_2B.pass ? "PASS" : "FAIL") : "",
      comp.ISO_19902 ? (comp.ISO_19902.pass ? "PASS" : "FAIL") : "",
      comp.API_5L ? (comp.API_5L.agreementRequired ? "AGREEMENT REQ." : (comp.API_5L.pass ? "PASS" : "FAIL")) : "",
      comp.DNV ? (comp.DNV.pass ? "PASS" : "FAIL") : "",
      r.dmax || "",
      r.dmin || "",
      r.meas_mm != null ? Number(r.meas_mm).toFixed(3) : "",
      r.meas_pct != null ? Number(r.meas_pct).toFixed(4) : ""
    ];
  }

  function buildCompareRowsHtml(compareList, forExcel = false) {
    if (!Array.isArray(compareList) || !compareList.length) return "";
    return compareList.map(row => {
      const a2 = row.api2b ? "PASS" : "FAIL";
      const iso = row.iso ? "PASS" : "FAIL";
      const a2Cell = forExcel
        ? `<td style="${passBadgeStyle(row.api2b, true)}">${a2}</td>`
        : `<td><span class="${passBadgeStyle(row.api2b, false)}">${a2}</span></td>`;
      const isoCell = forExcel
        ? `<td style="${passBadgeStyle(row.iso, true)}">${iso}</td>`
        : `<td><span class="${passBadgeStyle(row.iso, false)}">${iso}</span></td>`;
      return `<tr>`
        + `<td><b>${escHtml(row.label || row.st)}</b></td>`
        + `<td>${Number(row.Dv).toFixed(2)}</td>`
        + `<td>${Number(row.Dh).toFixed(2)}</td>`
        + `<td>${Number(row.oval_mm).toFixed(2)}</td>`
        + `<td><b>${Number(row.oval_pct).toFixed(2)}%</b></td>`
        + `<td>${Number(row.vsNatPct).toFixed(2)}%</td>`
        + a2Cell + isoCell
        + `</tr>`;
    }).join("");
  }

  function buildXlsHtml(records, currentEntry, sections) {
    const cur = currentEntry || null;
    const hasRecs = Array.isArray(records) && records.length > 0;
    const sec = Object.assign({ comp: true, cmp: true, diag: true, recs: true, chk: true }, sections || {});
    let secNo = 1;
    const recHeaders = [
      "No", "Name", "Saved At", "D(mm)", "t(mm)", "Support", "PipeLen(mm)",
      "RollerMat", "RollerDia(mm)", "C-C(mm)", "ContactLen(mm)", "MinSets", "ActualSets",
      "Dv(mm)", "Dh(mm)", "PredOval(mm)", "PredOval(%)", "API_2B", "ISO_19902", "API_5L", "DNV",
      "Dmax(mm)", "Dmin(mm)", "MeasOval(mm)", "MeasOval(%)"
    ];
    let body = `<h2>Tubular Ovality &amp; Roller Analysis — Engineering Report</h2>`
      + `<p>Generated: ${escHtml(new Date().toLocaleString())}</p>`;

    if (cur && cur.p) {
      const dtRatio = cur.p.t > 0 ? (cur.p.D / cur.p.t).toFixed(2) : "—";
      const dm = cur.docMeta || {};
      if (dm.proj || dm.pipeno || dm.prep || dm.rev) {
        body += `<table border="1" cellspacing="0" cellpadding="5" style="border-collapse:collapse;margin-bottom:12px;">`
          + `<tr><th style="background:#1e2340;color:#fff;">Project</th><td>${escHtml(dm.proj || "—")}</td><th style="background:#1e2340;color:#fff;">Pipe / Can No.</th><td>${escHtml(dm.pipeno || "—")}</td></tr>`
          + `<tr><th style="background:#1e2340;color:#fff;">Prepared by</th><td>${escHtml(dm.prep || "—")}</td><th style="background:#1e2340;color:#fff;">Reviewed by</th><td>${escHtml(dm.rev || "—")}</td></tr>`
          + `</table>`;
      }
      const measParts = [];
      if (cur.dmax > 0 && cur.dmin > 0 && cur.dmax >= cur.dmin) {
        measParts.push(`D_min=${cur.dmin} mm / D_max=${cur.dmax} mm → ${Number(cur.meas_mm).toFixed(2)} mm (${Number(cur.meas_pct).toFixed(2)}%)`);
      }
      if (cur.ml > 0 || cur.mm > 0 || cur.mr > 0) {
        measParts.push(`3-Sec: L=${cur.ml || "—"} / Mid=${cur.mm || "—"} / R=${cur.mr || "—"} mm`);
      }
      if (cur.mbef > 0 && cur.maft > 0) {
        const dw = cur.maft - cur.mbef;
        measParts.push(`Weld Before/After: ${cur.mbef}→${cur.maft} mm (Δ=${dw >= 0 ? "+" : ""}${dw.toFixed(2)} mm)`);
      }
      const measStr = measParts.length ? measParts.join(" | ") : "Not entered";
      body += `<h3>${secNo++}. Current Analysis Summary (${escHtml(cur.name || "Current-Analysis")})</h3>`
        + `<table border="1" cellspacing="0" cellpadding="5" style="border-collapse:collapse;margin-bottom:14px;">`
        + `<tr><th style="background:#1e2340;color:#fff;">Pipe Specs</th><td>D = ${cur.p.D} mm · t = ${cur.p.t} mm · D/t = ${dtRatio} · L = ${cur.plen || "—"} mm · Girth Welds = ${cur.nweld ?? 0} · Active Welds = ${cur.aweld ?? 0}</td></tr>`
        + `<tr><th style="background:#1e2340;color:#fff;">Turning Roller Specs</th><td>Support = ${escHtml(cur.p.st)} · Mat = ${escHtml(cur.rmat)} · Dia = ${cur.rdia} mm · C-C = ${cur.cc_mm} mm · Contact Len = ${cur.cl_mm} mm · Min Sets = ${cur.minSets || "—"} · Actual Sets = ${cur.asets || "—"}</td></tr>`
        + `<tr><th style="background:#1e2340;color:#fff;">Predicted Ovality</th><td>Natural = ${Number(cur.natOval_mm).toFixed(2)} mm (${Number(cur.natOval_pct).toFixed(2)}%) | Supported = ${Number(cur.oval_mm).toFixed(2)} mm (${Number(cur.oval_pct).toFixed(2)}%) [Dv=${Number(cur.Dv).toFixed(2)}, Dh=${Number(cur.Dh).toFixed(2)} mm]</td></tr>`
        + `<tr><th style="background:#1e2340;color:#fff;">Field Measurement</th><td>${escHtml(measStr)}</td></tr>`
        + `</table>`;

      if (sec.comp && cur.comp) {
        body += `<h3>${secNo++}. Code Compliance Result</h3>`
          + `<table border="1" cellspacing="0" cellpadding="5" style="border-collapse:collapse;margin-bottom:14px;">`
          + `<thead><tr style="background:#1e2340;color:#fff;"><th>Standard</th><th>Ovality</th><th>Limit (mm)</th><th>Limit (%)</th><th>Margin</th><th>Result</th></tr></thead>`
          + `<tbody>${buildCompRowsHtml(cur.comp, true)}</tbody></table>`;
      }

      if (sec.cmp && Array.isArray(cur.compareList) && cur.compareList.length) {
        body += `<h3>${secNo++}. Support State Comparison</h3>`
          + `<table border="1" cellspacing="0" cellpadding="5" style="border-collapse:collapse;margin-bottom:14px;">`
          + `<thead><tr style="background:#1e2340;color:#fff;"><th>Support State</th><th>Dv (mm)</th><th>Dh (mm)</th><th>Oval (mm)</th><th>Oval (%)</th><th>vs Natural</th><th>API 2B</th><th>ISO 19902</th></tr></thead>`
          + `<tbody>${buildCompareRowsHtml(cur.compareList, true)}</tbody></table>`;
      }

      if (sec.diag) {
        body += `<h3>${secNo++}. Cross-Section &amp; Layout Summary</h3>`
          + `<table border="1" cellspacing="0" cellpadding="5" style="border-collapse:collapse;margin-bottom:14px;">`
          + `<tr><th style="background:#1e2340;color:#fff;">Cross-Section</th><td>Dv = ${Number(cur.Dv).toFixed(2)} mm · Dh = ${Number(cur.Dh).toFixed(2)} mm · Pred Oval = ${Number(cur.oval_mm).toFixed(2)} mm (${Number(cur.oval_pct).toFixed(2)}%)</td></tr>`
          + `<tr><th style="background:#1e2340;color:#fff;">Side View Layout</th><td>Pipe L = ${cur.plen || "—"} mm · Rec Sets = ${cur.minSets || "—"} · Actual Sets = ${cur.asets || "—"} · Girth Welds = ${cur.nweld ?? 0} (Active ${cur.aweld ?? 0})</td></tr>`
          + `</table>`;
      }

      if (sec.recs && Array.isArray(cur.recsList) && cur.recsList.length) {
        const recTrs = cur.recsList.map(it => `<tr><td style="font-weight:bold;text-align:center;">${escHtml(it.level)}</td><td>${escHtml(it.msg)}</td></tr>`).join("");
        body += `<h3>${secNo++}. Recommendations &amp; Preliminary Reinforcement</h3>`
          + `<table border="1" cellspacing="0" cellpadding="5" style="border-collapse:collapse;margin-bottom:10px;">`
          + `<thead><tr style="background:#1e2340;color:#fff;"><th>Level</th><th>Recommendation</th></tr></thead>`
          + `<tbody>${recTrs}</tbody></table>`;
        if (cur.reinfPlan && cur.reinfPlan.needed) {
          const rp = cur.reinfPlan;
          body += `<table border="1" cellspacing="0" cellpadding="5" style="border-collapse:collapse;margin-bottom:14px;">`
            + `<tr><th style="background:#7c2d12;color:#fff;">Application Strategy</th><td><b>${escHtml(rp.strategy || "")}</b> ${escHtml(cur.reinfGuideText || "")}</td></tr>`
            + `<tr><th style="background:#1e2340;color:#fff;">1. Stiffener Ring</th><td>${escHtml(rp.ring.profile)} · ${rp.ring.count} ea @${rp.ring.spacingMm} mm · I_req/I_prov = ${rp.ring.I_req_cm4}/${rp.ring.I_prov_cm4} cm⁴ · Est. Oval ~${rp.ring.estOvalMm} mm</td></tr>`
            + `<tr><th style="background:#1e2340;color:#fff;">2. Spider Brace</th><td>${rp.spider.arms}-Arm · ${escHtml(rp.spider.pipeSpec)} · L=${rp.spider.armLenMm} mm (λ=${rp.spider.slenderness}) · Push ${rp.spider.pushDeg}° / Pull ${rp.spider.pullDeg}°</td></tr>`
            + `<tr><th style="background:#1e2340;color:#fff;">3. Roller Support</th><td>${rp.support.recSets} sets @${rp.support.recSpanMm} mm${rp.support.recommendTR45 ? ` · TR2 45° → ${rp.support.tr45OvalMm} mm` : ""}</td></tr>`
            + `</table>`;
        }
      }

      if (sec.chk && cur.checklist) {
        const ck = cur.checklist;
        const ckRows = (ck.items || []).map((it, idx) =>
          `<tr><td>${idx + 1}</td><td><b>${escHtml(it.title)}</b></td><td>${escHtml(it.desc)}</td><td>${escHtml(it.val || "—")}</td></tr>`
        ).join("");
        body += `<h3>${secNo++}. Field Checklist &amp; Engineering Indicators</h3>`
          + `<table border="1" cellspacing="0" cellpadding="5" style="border-collapse:collapse;margin-bottom:8px;">`
          + `<tr><th style="background:#1e2340;color:#fff;">Indicators</th><td>γ_eff=${ck.ge}° · D/t=${ck.dt} · Brazier=${escHtml(ck.brazierRisk)} · P_max=${ck.pmax} MPa · Mcr=${ck.mcr} GN·m · Beam δ=${ck.beamDelta} mm</td></tr>`
          + `</table>`
          + `<table border="1" cellspacing="0" cellpadding="5" style="border-collapse:collapse;margin-bottom:14px;">`
          + `<thead><tr style="background:#1e2340;color:#fff;"><th>No</th><th>Item</th><th>Guideline</th><th>Value</th></tr></thead>`
          + `<tbody>${ckRows}</tbody></table>`;
      }
    }

    if (hasRecs) {
      const thHtml = recHeaders.map(h => `<th style="background:#1e2340;color:#fff;">${escHtml(h)}</th>`).join("");
      const trHtml = records.map((r, idx) => {
        const cols = buildRecordCells(r, idx);
        const tds = cols.map((c, ci) => {
          if (ci >= 17 && ci <= 20) {
            if (c === "AGREEMENT REQ.") {
              return `<td style="background:#fffbeb;color:#d97706;font-weight:bold;text-align:center;">${c}</td>`;
            }
            if (c === "PASS" || c === "FAIL") {
              return `<td style="${passBadgeStyle(c === "PASS", true)}">${c}</td>`;
            }
          }
          return `<td>${escHtml(c)}</td>`;
        }).join("");
        return `<tr>${tds}</tr>`;
      }).join("");
      body += `<h3>${secNo++}. Saved Records (${records.length})</h3>`
        + `<table border="1" cellspacing="0" cellpadding="4" style="border-collapse:collapse;"><thead><tr>${thHtml}</tr></thead><tbody>${trHtml}</tbody></table>`;
    }

    return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">`
      + `<head><meta charset="UTF-8"><style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;}th,td{border:1px solid #cbd5e1;padding:4px 7px;}</style></head>`
      + `<body>${body}</body></html>`;
  }

  function exportXLS(records, currentEntry, sections) {
    const hasRecs = Array.isArray(records) && records.length > 0;
    if (!hasRecs && !currentEntry) return false;
    const html = "\uFEFF" + buildXlsHtml(records, currentEntry, sections);
    const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `TubularOvality_Report_${formatStamp()}.xls`;
    a.click();
    URL.revokeObjectURL(url);
    return true;
  }

  function buildPdfHtml(records, currentEntry, sections) {
    const cur = currentEntry || null;
    const hasRecs = Array.isArray(records) && records.length > 0;
    const sec = Object.assign({ comp: true, cmp: true, diag: true, recs: true, chk: true }, sections || {});
    let secNo = 1;
    const overallPass = cur && cur.comp && cur.comp.API_2B && cur.comp.ISO_19902
      ? (cur.comp.API_2B.pass && cur.comp.ISO_19902.pass)
      : null;
    const statusBadge = overallPass === null
      ? `<span class="badge idle">SAVED LOG REPORT</span>`
      : overallPass
        ? `<span class="badge pass">✓ PASS (API 2B · ISO 19902)</span>`
        : `<span class="badge fail">⚠ FAIL (REVIEW REQUIRED)</span>`;

    let secHtml = "";
    const dmPdf = (cur && cur.docMeta) ? cur.docMeta : {};
    if (dmPdf.proj || dmPdf.pipeno || dmPdf.prep || dmPdf.rev) {
      secHtml += `
        <div class="sec">
          <table class="grid-tbl">
            <tr><th>Project Name</th><td><b>${escHtml(dmPdf.proj || "—")}</b></td><th>Pipe / Can No.</th><td><b>${escHtml(dmPdf.pipeno || "—")}</b></td></tr>
            <tr><th>Prepared by</th><td>${escHtml(dmPdf.prep || "—")}</td><th>Reviewed / Approved</th><td>${escHtml(dmPdf.rev || "—")}</td></tr>
          </table>
        </div>`;
    }
    if (cur && cur.p) {
      const dtRatio = cur.p.t > 0 ? (cur.p.D / cur.p.t).toFixed(2) : "—";
      const mParts = [];
      if (cur.dmax > 0 && cur.dmin > 0 && cur.dmax >= cur.dmin) {
        mParts.push(`<b>${Number(cur.meas_mm).toFixed(2)} mm (${Number(cur.meas_pct).toFixed(2)}%)</b> (D_min=${cur.dmin} · D_max=${cur.dmax})`);
      }
      if (cur.ml > 0 || cur.mm > 0 || cur.mr > 0) {
        mParts.push(`3-Sec: L=${cur.ml || "—"} / Mid=${cur.mm || "—"} / R=${cur.mr || "—"} mm`);
      }
      if (cur.mbef > 0 && cur.maft > 0) {
        const dw = cur.maft - cur.mbef;
        mParts.push(`Weld: ${cur.mbef}→${cur.maft} mm (<b>Δ=${dw >= 0 ? "+" : ""}${dw.toFixed(2)} mm</b>)`);
      }
      const measHtml = mParts.length ? mParts.join("<br>") : "Not entered";
      secHtml += `
        <div class="sec">
          <h3>${secNo++}. Tubular &amp; Turning Roller Specifications (${escHtml(cur.name || "Current-Analysis")})</h3>
          <table class="grid-tbl">
            <tr><th>Pipe OD (D)</th><td>${cur.p.D} mm</td><th>Wall Thickness (t)</th><td>${cur.p.t} mm (D/t = ${dtRatio})</td></tr>
            <tr><th>Pipe Length (L)</th><td>${cur.plen || "—"} mm</td><th>Girth / Active Welds</th><td>Total ${cur.nweld ?? 0} · Active ${cur.aweld ?? 0}</td></tr>
            <tr><th>Support Type</th><td>${escHtml(cur.p.st)}</td><th>Roller Material / Dia</th><td>${escHtml((cur.rmat || "steel").toUpperCase())} / Ø${cur.rdia} mm</td></tr>
            <tr><th>C-C / Contact Len</th><td>${cur.cc_mm} mm / ${cur.cl_mm} mm</td><th>Min Rec / Actual Sets</th><td><b>${cur.minSets || "—"} sets</b> / ${cur.asets || "—"} sets</td></tr>
            <tr><th>Natural / Supported</th><td>${Number(cur.natOval_mm).toFixed(2)} mm (${Number(cur.natOval_pct).toFixed(2)}%) / <b>${Number(cur.oval_mm).toFixed(2)} mm (${Number(cur.oval_pct).toFixed(2)}%)</b></td>
                <th>Field Measured</th><td>${measHtml}</td></tr>
          </table>
        </div>`;

      if (sec.comp && cur.comp) {
        secHtml += `
          <div class="sec">
            <h3>${secNo++}. Code Compliance Result</h3>
            <table>
              <thead><tr><th>Standard</th><th>Ovality</th><th>Limit (mm)</th><th>Limit (%)</th><th>Margin</th><th>Result</th></tr></thead>
              <tbody>${buildCompRowsHtml(cur.comp, false)}</tbody>
            </table>
          </div>`;
      }

      if (sec.cmp && Array.isArray(cur.compareList) && cur.compareList.length) {
        secHtml += `
          <div class="sec avoid-break">
            <h3>${secNo++}. Support State Comparison</h3>
            <table>
              <thead><tr><th>Support State</th><th>Dv (mm)</th><th>Dh (mm)</th><th>Oval (mm)</th><th>Oval (%)</th><th>vs Nat</th><th>API 2B</th><th>ISO 19902</th></tr></thead>
              <tbody>${buildCompareRowsHtml(cur.compareList, false)}</tbody>
            </table>
          </div>`;
      }

      if (sec.diag) {
        const safeCs = cur.csImg && /^data:image\//.test(cur.csImg) ? cur.csImg : "";
        const safeSv = cur.svImg && /^data:image\//.test(cur.svImg) ? cur.svImg : "";
        if (safeCs || safeSv) {
          secHtml += `
            <div class="sec avoid-break">
              <h3>${secNo++}. Cross-Section &amp; Side View Diagrams</h3>
              <div class="diag-grid">
                ${safeCs ? `<div class="diag-box"><div class="diag-cap">Cross-Section</div><img src="${safeCs}" alt="Cross-Section"/></div>` : ""}
                ${safeSv ? `<div class="diag-box"><div class="diag-cap">Side View — Roller Layout</div><img src="${safeSv}" alt="Side View"/></div>` : ""}
              </div>
            </div>`;
        }
      }

      if (sec.recs && Array.isArray(cur.recsList) && cur.recsList.length) {
        const recTrs = cur.recsList.map(it => `<tr><td style="width:65px;text-align:center;"><b>${escHtml(it.level)}</b></td><td>${escHtml(it.msg)}</td></tr>`).join("");
        let reinfHtml = "";
        if (cur.reinfPlan && cur.reinfPlan.needed) {
          const rp = cur.reinfPlan;
          const safeRCs = cur.reinfCsImg && /^data:image\//.test(cur.reinfCsImg) ? cur.reinfCsImg : "";
          const safeRSv = cur.reinfSvImg && /^data:image\//.test(cur.reinfSvImg) ? cur.reinfSvImg : "";
          reinfHtml = `
            <table class="grid-tbl" style="margin-top:8px;">
              <tr><th>Strategy</th><td colspan="3"><b>${escHtml(rp.strategy || "")}</b> ${escHtml(cur.reinfGuideText || "")}</td></tr>
              <tr><th>1. Stiffener Ring</th><td>${escHtml(rp.ring.profile)} · ${rp.ring.count}ea @${rp.ring.spacingMm}mm (Est. ~${rp.ring.estOvalMm}mm)</td>
                  <th>2. Spider Brace</th><td>${rp.spider.arms}-Arm · ${escHtml(rp.spider.pipeSpec)} (λ=${rp.spider.slenderness})</td></tr>
              <tr><th>3. Roller Support</th><td colspan="3">${rp.support.recSets} sets @${rp.support.recSpanMm}mm${rp.support.recommendTR45 ? ` · TR2 α=45° → ${rp.support.tr45OvalMm}mm` : ""}</td></tr>
            </table>`
            + ((safeRCs || safeRSv)
              ? `<div class="diag-grid" style="margin-top:8px;">`
                + (safeRCs ? `<div class="diag-box"><div class="diag-cap">Reinforcement Cross-Section</div><img src="${safeRCs}" alt="Reinforcement CS"/></div>` : "")
                + (safeRSv ? `<div class="diag-box"><div class="diag-cap">Reinforcement Side View</div><img src="${safeRSv}" alt="Reinforcement SV"/></div>` : "")
                + `</div>`
              : "");
        }
        secHtml += `
          <div class="sec avoid-break">
            <h3>${secNo++}. Recommendations &amp; Preliminary Reinforcement</h3>
            <table>
              <thead><tr><th>Level</th><th>Recommendation</th></tr></thead>
              <tbody>${recTrs}</tbody>
            </table>
            ${reinfHtml}
          </div>`;
      }

      if (sec.chk && cur.checklist) {
        const ck = cur.checklist;
        const ckRows = (ck.items || []).map((it, idx) =>
          `<tr><td style="width:32px;text-align:center;">${idx + 1}</td><td style="width:22%;"><b>${escHtml(it.title)}</b></td><td>${escHtml(it.desc)}</td><td style="width:18%;">${escHtml(it.val || "—")}</td></tr>`
        ).join("");
        secHtml += `
          <div class="sec avoid-break">
            <h3>${secNo++}. Field Checklist &amp; Engineering Indicators</h3>
            <table class="grid-tbl" style="margin-bottom:8px;">
              <tr><th>γ_eff / D/t</th><td>${ck.ge}° / ${ck.dt}</td><th>Brazier / P_max</th><td><b>${escHtml(ck.brazierRisk)}</b> / ${ck.pmax} MPa</td></tr>
              <tr><th>Mcr (Brazier)</th><td>${ck.mcr} GN·m</td><th>Beam δ</th><td>${ck.beamDelta} mm</td></tr>
            </table>
            <table>
              <thead><tr><th>No</th><th>Item</th><th>Guideline</th><th>Value</th></tr></thead>
              <tbody>${ckRows}</tbody>
            </table>
          </div>`;
      }
    }

    if (hasRecs) {
      const recRows = records.map((r, i) => {
        const comp = r.comp || {};
        const a2 = comp.API_2B ? (comp.API_2B.pass ? "PASS" : "FAIL") : "—";
        const iso = comp.ISO_19902 ? (comp.ISO_19902.pass ? "PASS" : "FAIL") : "—";
        return `<tr>`
          + `<td>${i + 1}</td>`
          + `<td><b>${escHtml(r.name)}</b></td>`
          + `<td>${r.p ? `${r.p.D}×${r.p.t}` : "—"}</td>`
          + `<td>${r.p ? escHtml(r.p.st) : "—"}</td>`
          + `<td>${r.oval_mm != null ? Number(r.oval_mm).toFixed(2) : "—"} / ${r.oval_pct != null ? Number(r.oval_pct).toFixed(2) : "—"}%</td>`
          + `<td>${r.meas_mm ? `${Number(r.meas_mm).toFixed(2)} (${Number(r.meas_pct).toFixed(2)}%)` : "—"}</td>`
          + `<td><span class="pill ${a2 === "PASS" ? "p" : "f"}">${a2}</span></td>`
          + `<td><span class="pill ${iso === "PASS" ? "p" : "f"}">${iso}</span></td>`
          + `</tr>`;
      }).join("");
      secHtml += `
        <div class="sec">
          <h3>${secNo++}. Saved Inspection Records (${records.length})</h3>
          <table>
            <thead><tr><th>No</th><th>Name</th><th>D×t</th><th>Support</th><th>Pred Oval</th><th>Measured</th><th>API 2B</th><th>ISO 19902</th></tr></thead>
            <tbody>${recRows}</tbody>
          </table>
        </div>`;
    }

    return `<!doctype html><html lang="ko"><head><meta charset="UTF-8"><title>TOA Engineering Report — ${formatStamp()}</title>`
      + `<style>`
      + `@page{size:A4 portrait;margin:12mm;}`
      + `*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;}`
      + `body{font-family:Inter,Arial,sans-serif;color:#1a2340;margin:0;padding:18px;font-size:11px;line-height:1.45;background:#f8fafc;}`
      + `.sheet{max-width:794px;margin:0 auto;background:#fff;padding:22px;border:1px solid #e2e6ef;border-radius:10px;}`
      + `.no-print{display:flex;justify-content:flex-end;gap:8px;max-width:794px;margin:0 auto 12px;}`
      + `.no-print button{padding:8px 14px;border-radius:7px;border:1px solid #cbd5e1;font-weight:700;cursor:pointer;font-size:12px;background:#fff;color:#1a2340;}`
      + `.no-print .pri{background:#377feb;color:#fff;border-color:#2366d1;}`
      + `.hdr{display:flex;justify-content:space-between;align-items:center;border-bottom:2.5px solid #377feb;padding-bottom:10px;margin-bottom:14px;}`
      + `.hdr h1{font-size:17px;margin:0;color:#1e2340;}.hdr p{margin:3px 0 0;font-size:10px;color:#64748b;}`
      + `.badge{padding:5px 11px;border-radius:7px;font-size:11px;font-weight:800;border:1px solid;}`
      + `.badge.pass{background:#f0fdf4;color:#16a34a;border-color:#86efac;}.badge.fail{background:#fef2f2;color:#dc2626;border-color:#fca5a5;}.badge.idle{background:#eff4ff;color:#2563eb;border-color:#bfdbfe;}`
      + `.sec{margin-bottom:14px;}.sec h3{font-size:12px;color:#1e2340;margin:0 0 6px;padding-left:7px;border-left:3px solid #377feb;}`
      + `table{width:100%;border-collapse:collapse;font-size:10.5px;}th,td{border:1px solid #dbe2ee;padding:5px 8px;text-align:left;}`
      + `thead th{background:#1e2340;color:#fff;font-size:10px;}.grid-tbl th{background:#f1f5f9;color:#475569;width:19%;}`
      + `.pill{display:inline-block;padding:1px 7px;border-radius:10px;font-size:9.5px;font-weight:700;}.pill.p{background:#dcfce7;color:#15803d;}.pill.f{background:#fee2e2;color:#b91c1c;}.pill.w{background:#fffbeb;color:#d97706;border:1px solid #fcd34d;}`
      + `.diag-grid{display:flex;gap:10px;align-items:flex-start;}.diag-box{flex:1;border:1px solid #dbe2ee;border-radius:6px;padding:6px;text-align:center;}`
      + `.diag-cap{font-size:9.5px;font-weight:700;color:#64748b;margin-bottom:4px;}.diag-box img{max-width:100%;height:auto;max-height:230px;}`
      + `.foot{margin-top:12px;padding-top:8px;border-top:1px solid #e2e6ef;font-size:9px;color:#64748b;}`
      + `.avoid-break{break-inside:avoid;}`
      + `@media print{body{background:#fff;padding:0;}.sheet{border:none;padding:0;}.no-print{display:none!important;}}`
      + `</style></head><body>`
      + `<div class="no-print"><button class="pri" onclick="window.print()">🖨 PDF 저장 / 인쇄</button><button onclick="window.close()">✕ 닫기</button></div>`
      + `<div class="sheet">`
      + `<div class="hdr"><div><h1>Tubular Ovality &amp; Roller Analysis — Engineering Report</h1><p>Generated: ${escHtml(new Date().toLocaleString())} · API 2B · ISO 19902 · API 5L · DNV-OS-C401</p></div>${statusBadge}</div>`
      + secHtml
      + `<div class="sec avoid-break" style="margin-top:14px;">`
      + `<table><thead><tr><th style="width:22%;">QC Sign-off</th><th style="width:26%;">Name</th><th style="width:20%;">Date</th><th style="width:32%;">Signature</th></tr></thead>`
      + `<tbody>`
      + `<tr><td><b>Prepared by</b></td><td>${escHtml(dmPdf.prep || "")}</td><td>${formatStamp()}</td><td style="height:24px;"></td></tr>`
      + `<tr><td><b>Reviewed by</b></td><td>${escHtml(dmPdf.rev || "")}</td><td></td><td style="height:24px;"></td></tr>`
      + `<tr><td><b>Approved by</b></td><td></td><td></td><td style="height:24px;"></td></tr>`
      + `</tbody></table></div>`
      + `<div class="foot">※ Unit-width linear elastic ring theory (I = t³/12) conceptual &amp; comparative engineering report. Final fabrication approval requires governing code verification and FEA / dimensional checks.</div>`
      + `</div></body></html>`;
  }

  function exportPDF(records, currentEntry, sections) {
    const hasRecs = Array.isArray(records) && records.length > 0;
    if (!hasRecs && !currentEntry) return false;
    const html = buildPdfHtml(records, currentEntry, sections);
    let handled = false;
    try {
      const win = (typeof window !== "undefined" && typeof window.open === "function") ? window.open("", "_blank") : null;
      if (win && win.document) {
        win.document.open();
        win.document.write(html);
        win.document.close();
        try { if (typeof win.focus === "function") win.focus(); } catch (e) {}
        setTimeout(() => { try { if (typeof win.print === "function") win.print(); } catch (e) {} }, 250);
        handled = true;
      }
    } catch (e) {}
    if (!handled && typeof document !== "undefined" && document.body && typeof document.createElement === "function") {
      const iframe = document.createElement("iframe");
      iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
      document.body.appendChild(iframe);
      const idoc = iframe.contentWindow && iframe.contentWindow.document;
      if (idoc) {
        idoc.open();
        idoc.write(html);
        idoc.close();
        setTimeout(() => {
          try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch (e) {}
          setTimeout(() => { try { iframe.remove(); } catch (e) {} }, 1000);
        }, 250);
        handled = true;
      }
    }
    return handled;
  }

  function buildSamplePdfHtml(sampleReinfImgs, lang = "ko") {
    const imgs = sampleReinfImgs || {};
    const safeRCs = imgs.reinfCsImg && /^data:image\//.test(imgs.reinfCsImg) ? imgs.reinfCsImg : "";
    const safeRSv = imgs.reinfSvImg && /^data:image\//.test(imgs.reinfSvImg) ? imgs.reinfSvImg : "";
    const stamp = formatStamp();
    const dict = (typeof I18N !== "undefined" && I18N[lang] && I18N[lang].betaPdf)
      ? I18N[lang].betaPdf
      : ((typeof I18N !== "undefined" && I18N.ko && I18N.ko.betaPdf) ? I18N.ko.betaPdf : {});
    const localeMap = { ko: "ko-KR", en: "en-US", zh: "zh-CN", es: "es-ES", ja: "ja-JP" };
    const genTime = new Date().toLocaleString(localeMap[lang] || "ko-KR");

    return `<!doctype html><html lang="${escHtml(lang)}"><head><meta charset="UTF-8"><title>${escHtml(dict.docTitle || "[SAMPLE] TOA Beta v0.5")} — ${stamp}</title>`
      + `<style>`
      + `@page{size:A4 portrait;margin:12mm;}`
      + `*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;}`
      + `body{font-family:Inter,Arial,sans-serif;color:#1a2340;margin:0;padding:18px;font-size:11px;line-height:1.45;background:#f8fafc;}`
      + `.sheet{position:relative;max-width:794px;margin:0 auto;background:#fff;padding:22px;border:1px solid #e2e6ef;border-radius:10px;overflow:hidden;}`
      + `.wm{position:fixed;top:46%;left:50%;transform:translate(-50%,-50%) rotate(-28deg);font-size:74px;font-weight:900;color:rgba(220,38,38,0.09);pointer-events:none;z-index:0;white-space:nowrap;}`
      + `.content{position:relative;z-index:1;}`
      + `.no-print{display:flex;justify-content:flex-end;gap:8px;max-width:794px;margin:0 auto 12px;}`
      + `.no-print button{padding:8px 14px;border-radius:7px;border:1px solid #cbd5e1;font-weight:700;cursor:pointer;font-size:12px;background:#fff;color:#1a2340;}`
      + `.no-print .pri{background:#377feb;color:#fff;border-color:#2366d1;}`
      + `.sample-banner{background:#fef3c7;border:1.5px solid #f59e0b;color:#92400e;border-radius:8px;padding:9px 12px;font-size:11px;font-weight:800;margin-bottom:12px;}`
      + `.hdr{display:flex;justify-content:space-between;align-items:center;border-bottom:2.5px solid #f59e0b;padding-bottom:10px;margin-bottom:14px;}`
      + `.hdr h1{font-size:16px;margin:0;color:#1e2340;}.hdr p{margin:3px 0 0;font-size:10px;color:#64748b;}`
      + `.badge{padding:5px 11px;border-radius:7px;font-size:11px;font-weight:900;background:#fef3c7;color:#b45309;border:1.5px solid #f59e0b;white-space:nowrap;}`
      + `.sec{margin-bottom:14px;}.sec h3{font-size:12px;color:#1e2340;margin:0 0 6px;padding-left:7px;border-left:3px solid #f59e0b;}`
      + `table{width:100%;border-collapse:collapse;font-size:10.5px;}th,td{border:1px solid #dbe2ee;padding:5px 8px;text-align:left;}`
      + `thead th{background:#1e2340;color:#fff;font-size:10px;}.grid-tbl th{background:#f1f5f9;color:#475569;width:19%;}`
      + `.pill{display:inline-block;padding:1px 7px;border-radius:10px;font-size:9.5px;font-weight:700;}.pill.p{background:#dcfce7;color:#15803d;}.pill.f{background:#fee2e2;color:#b91c1c;}.pill.w{background:#fffbeb;color:#d97706;border:1px solid #fcd34d;}`
      + `.diag-grid{display:flex;gap:10px;align-items:flex-start;}.diag-box{flex:1;border:1px solid #dbe2ee;border-radius:6px;padding:6px;text-align:center;}`
      + `.diag-cap{font-size:9.5px;font-weight:700;color:#64748b;margin-bottom:4px;}.diag-box img{max-width:100%;height:auto;max-height:220px;}`
      + `.foot{margin-top:12px;padding-top:8px;border-top:1px solid #e2e6ef;font-size:9.5px;color:#64748b;line-height:1.55;}`
      + `.avoid-break{break-inside:avoid;}`
      + `@media print{body{background:#fff;padding:0;}.sheet{border:none;padding:0;}.no-print{display:none!important;}}`
      + `</style></head><body>`
      + `<div class="wm">${escHtml(dict.wm || "[SAMPLE] BETA v0.5")}</div>`
      + `<div class="no-print"><button class="pri" onclick="window.print()">${escHtml(dict.printBtn || "Print PDF")}</button><button onclick="window.close()">${escHtml(dict.closeBtn || "Close")}</button></div>`
      + `<div class="sheet"><div class="content">`
      + `<div class="sample-banner">${escHtml(dict.banner || "")}</div>`
      + `<div class="hdr"><div><h1>${escHtml(dict.reportTitle || "")}</h1><p>TOA Beta v0.5 · ${escHtml(genTime)} · API 2B · ISO 19902 · API 5L · DNV-OS-C401</p></div><span class="badge">${escHtml(dict.badge || "[SAMPLE] BETA")}</span></div>`
      + `<div class="sec">`
      + `<h3>${escHtml(dict.sec1 || "")}</h3>`
      + `<table class="grid-tbl">`
      + `<tr><th>${escHtml(dict.lblProject || "Project")}</th><td>${escHtml(dict.projectVal || "")}</td><th>${escHtml(dict.lblPipeNo || "Pipe / Can No.")}</th><td>SAMPLE-MP-01 / CAN-03</td></tr>`
      + `<tr><th>${escHtml(dict.lblOD || "D")}</th><td>8,000 mm</td><th>${escHtml(dict.lblWT || "t")}</th><td>20 mm (D/t = 400.0)</td></tr>`
      + `<tr><th>${escHtml(dict.lblLen || "L")}</th><td>12,000 mm</td><th>${escHtml(dict.lblSupType || "Support")}</th><td>${escHtml(dict.supportVal || "③-B TR2 α=45°")}</td></tr>`
      + `<tr><th>${escHtml(dict.lblPredOval || "Predicted Ovality")}</th><td><b>38.40 mm (0.48%)</b></td><th>${escHtml(dict.lblNatOval || "Natural Ovality")}</th><td>142.10 mm (1.78%)</td></tr>`
      + `</table></div>`
      + `<div class="sec avoid-break">`
      + `<h3>${escHtml(dict.sec2 || "")}</h3>`
      + `<table><thead><tr><th>${escHtml(dict.thStd || "Standard")}</th><th>${escHtml(dict.thPred || "Predicted")}</th><th>${escHtml(dict.thLimMm || "Limit (mm)")}</th><th>${escHtml(dict.thLimPct || "Limit (%)")}</th><th>${escHtml(dict.thMargin || "Margin")}</th><th>${escHtml(dict.thRes || "Result")}</th></tr></thead><tbody>`
      + `<tr><td><b>API RP 2B</b></td><td>38.40 mm / 0.48%</td><td>80.00 mm</td><td>1.00%</td><td style="color:#15803d;font-weight:bold;">+0.52%</td><td><span class="pill p">PASS</span></td></tr>`
      + `<tr><td><b>ISO 19902</b></td><td>38.40 mm / 0.48%</td><td>40.00 mm</td><td>0.50%</td><td style="color:#15803d;font-weight:bold;">+0.02%</td><td><span class="pill p">PASS</span></td></tr>`
      + `<tr><td><b>API 5L</b></td><td>38.40 mm / 0.48%</td><td>Ref 120.00 mm</td><td>Ref 1.50%</td><td style="color:#d97706;font-weight:bold;">—</td><td><span class="pill w">AGREEMENT REQ.</span></td></tr>`
      + `<tr><td><b>DNV-OS-C401</b></td><td>38.40 mm / 0.48%</td><td>40.00 mm</td><td>0.50%</td><td style="color:#15803d;font-weight:bold;">+0.02%</td><td><span class="pill p">PASS</span></td></tr>`
      + `</tbody></table></div>`
      + `<div class="sec avoid-break">`
      + `<h3>${escHtml(dict.sec3 || "")}</h3>`
      + `<table><thead><tr><th>${escHtml(dict.thSup || "Support")}</th><th>Dv (mm)</th><th>Dh (mm)</th><th>Oval (mm)</th><th>Oval (%)</th><th>${escHtml(dict.thVsNat || "vs Natural")}</th><th>API 2B</th><th>ISO 19902</th></tr></thead><tbody>`
      + `<tr><td><b>${escHtml(dict.supNat || "① Natural")}</b></td><td>7928.95</td><td>8071.05</td><td>142.10</td><td><b>1.78%</b></td><td>100.00%</td><td><span class="pill f">FAIL</span></td><td><span class="pill f">FAIL</span></td></tr>`
      + `<tr><td><b>${escHtml(dict.supSad || "② 120° Saddle")}</b></td><td>7974.80</td><td>8025.20</td><td>50.40</td><td><b>0.63%</b></td><td>35.47%</td><td><span class="pill p">PASS</span></td><td><span class="pill f">FAIL</span></td></tr>`
      + `<tr><td><b>${escHtml(dict.supTr45 || "★ ③-B TR2 α=45°")}</b></td><td>7980.80</td><td>8019.20</td><td>38.40</td><td><b>0.48%</b></td><td>27.02%</td><td><span class="pill p">PASS</span></td><td><span class="pill p">PASS</span></td></tr>`
      + `</tbody></table></div>`
      + `<div class="sec avoid-break">`
      + `<h3>${escHtml(dict.sec4 || "")}</h3>`
      + `<table><thead><tr><th style="width:72px;">${escHtml(dict.thLevel || "Level")}</th><th>${escHtml(dict.thRec || "Recommendation")}</th></tr></thead><tbody>`
      + `<tr><td style="text-align:center;"><b>WA</b></td><td>${escHtml(dict.recWa || "")}</td></tr>`
      + `<tr><td style="text-align:center;"><b>IN</b></td><td>${escHtml(dict.recIn || "")}</td></tr>`
      + `</tbody></table>`
      + ((safeRCs || safeRSv)
        ? `<div class="diag-grid" style="margin-top:8px;">`
          + (safeRCs ? `<div class="diag-box"><div class="diag-cap">${escHtml(dict.csCap || "")}</div><img src="${safeRCs}" alt="Sample Reinforcement CS"/></div>` : "")
          + (safeRSv ? `<div class="diag-box"><div class="diag-cap">${escHtml(dict.svCap || "")}</div><img src="${safeRSv}" alt="Sample Reinforcement SV"/></div>` : "")
          + `</div>`
        : "")
      + `</div>`
      + `<div class="sec avoid-break">`
      + `<h3>${escHtml(dict.sec5 || "")}</h3>`
      + `<table><thead><tr><th style="width:22%;">${escHtml(dict.thRole || "Role")}</th><th style="width:26%;">${escHtml(dict.thName || "Name")}</th><th style="width:20%;">${escHtml(dict.thDate || "Date")}</th><th style="width:32%;">${escHtml(dict.thSign || "Signature")}</th></tr></thead><tbody>`
      + `<tr><td><b>${escHtml(dict.prepRole || "Prepared by")}</b></td><td>${escHtml(dict.prepVal || "")}</td><td>${stamp}</td><td style="height:24px;"></td></tr>`
      + `<tr><td><b>${escHtml(dict.revRole || "Reviewed by")}</b></td><td>${escHtml(dict.revVal || "")}</td><td></td><td style="height:24px;"></td></tr>`
      + `</tbody></table></div>`
      + `<div class="foot">${escHtml(dict.foot || "")}</div>`
      + `</div></div></body></html>`;
  }

  function exportSamplePDF(sampleReinfImgs, lang = "ko") {
    const html = buildSamplePdfHtml(sampleReinfImgs, lang);
    let handled = false;
    try {
      const win = (typeof window !== "undefined" && typeof window.open === "function") ? window.open("", "_blank") : null;
      if (win && win.document) {
        win.document.open();
        win.document.write(html);
        win.document.close();
        try { if (typeof win.focus === "function") win.focus(); } catch (e) {}
        setTimeout(() => { try { if (typeof win.print === "function") win.print(); } catch (e) {} }, 250);
        handled = true;
      }
    } catch (e) {}
    if (!handled && typeof document !== "undefined" && document.body && typeof document.createElement === "function") {
      const iframe = document.createElement("iframe");
      iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
      document.body.appendChild(iframe);
      const idoc = iframe.contentWindow && iframe.contentWindow.document;
      if (idoc) {
        idoc.open();
        idoc.write(html);
        idoc.close();
        setTimeout(() => {
          try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch (e) {}
          setTimeout(() => { try { iframe.remove(); } catch (e) {} }, 1000);
        }, 250);
        handled = true;
      }
    }
    return handled;
  }

  function getLastState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.LAST_STATE);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function setLastState(state) {
    try {
      localStorage.setItem(STORAGE_KEYS.LAST_STATE, JSON.stringify(state));
    } catch (e) {}
  }

  return {
    STORAGE_KEYS,
    PLAN_LIMITS,
    getPlan,
    setPlan,
    getPlanLimit,
    getRecords,
    saveRecords,
    addRecord,
    deleteRecord,
    clearRecords,
    importRecords,
    exportJSON,
    exportCSV,
    exportXLS,
    exportPDF,
    exportSamplePDF,
    getLastState,
    setLastState
  };
})();
window.DataStore = DataStore;
