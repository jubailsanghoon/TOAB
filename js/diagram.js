/**
 * TOA - Canvas Diagram Renderer (Cross-Section & Side View)
 */
const TOADiagram = (() => {
  function rRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function drawCrossSection(r, { rd = 600, theme = 'light', dmin = 0, dmax = 0, labels = {}, sampleTag = '' } = {}) {
    const cvs = document.getElementById('cvs');
    if (!cvs || !r) return;
    const ph = document.getElementById('td-ph');
    if (ph) ph.classList.add('hide');

    const ctx = cvs.getContext('2d');
    const W = cvs.width;
    const H = cvs.height;
    const dk = theme === 'dark';

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = dk ? '#1a2030' : '#f0f2f7';
    rRect(ctx, 0, 0, W, H, 12);
    ctx.fill();

    const D = r.p.D;
    const t = r.p.t;
    const halfD = D / 2;
    const Dv = r.Dv;
    const Dh = r.Dh;
    const natDv = r.natDv !== undefined ? r.natDv : (D - (r.natOval_mm || 0) / 2);
    const natDh = r.natDh !== undefined ? r.natDh : (D + (r.natOval_mm || 0) / 2);
    const hasMeas = Number.isFinite(dmin) && Number.isFinite(dmax) && dmin > 0 && dmax >= dmin;
    const measDv = hasMeas ? dmin : D;
    const measDh = hasMeas ? dmax : D;
    const measPct = hasMeas ? ((dmax - dmin) / D * 100) : 0;
    const st = (r.p.st || 'NATURAL').toUpperCase();

    const hasRol = st !== 'NATURAL' && st !== 'SADDLE120';
    const hasSad = st === 'SADDLE120';

    // 최대 반경 편차 기반 적응형 시각 배율 (미소 변형도 3개 원주선 구분 가능하도록 확장 후 안전 클램핑)
    const devs = [
      Math.abs(Dv - D) / 2, Math.abs(Dh - D) / 2,
      Math.abs(natDv - D) / 2, Math.abs(natDh - D) / 2
    ];
    if (hasMeas) {
      devs.push(Math.abs(measDv - D) / 2, Math.abs(measDh - D) / 2);
    }
    const maxAbsDev = Math.max(...devs, 0);
    const maxDevFrac = maxAbsDev / halfD;
    const exag = (maxDevFrac > 1e-6 && maxDevFrac < 0.14) ? Math.min(25, 0.16 / maxDevFrac) : 1.0;

    const exR = (dia, sc, RoPx) => {
      const raw = RoPx + ((dia - D) / 2) * exag * sc;
      return Math.max(Math.max(8, RoPx * 0.45), Math.min(RoPx * 1.38, raw));
    };

    const maxVisHalf = halfD * (1 + Math.min(0.38, maxDevFrac * exag));
    const scale = (W * 0.27) / Math.max(halfD, maxVisHalf);
    const Ro = Math.max(8, halfD * scale);
    const Rv = exR(Dv, scale, Ro);
    const Rh = exR(Dh, scale, Ro);
    const natRv = exR(natDv, scale, Ro);
    const natRh = exR(natDh, scale, Ro);
    const measRv = hasMeas ? exR(measDv, scale, Ro) : Ro;
    const measRh = hasMeas ? exR(measDh, scale, Ro) : Ro;
    const ti = Math.max(1.5, Math.min(Ro * 0.25, t * scale));
    const RolPx = Math.max(11, Math.min(34, (rd / 2) * scale));

    const maxUpR = Math.max(Ro, Rv, natRv, measRv);
    const maxDownR = Math.max(Ro, Rv, natRv, measRv);
    const cx = W / 2;
    const topSpace = maxUpR + 40;
    const botSpace = hasRol ? (maxDownR + RolPx * 2 + 24) : hasSad ? (Ro + 30) : (maxDownR + 18);
    const cy = Math.max(topSpace + 8, Math.min(H - 42 - botSpace, 8 + (H - 46 - botSpace + topSpace) / 2));

    // 0) 공칭 기준원 (D_nom) — 연한 회색 점선
    ctx.beginPath();
    ctx.arc(cx, cy, Ro, 0, Math.PI * 2);
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = dk ? 'rgba(255,255,255,.16)' : 'rgba(100,116,139,.32)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);

    // ② 지지상태 단면 채움 및 외/내경 원주선 (브랜드 블루 실선 #377feb)
    ctx.beginPath();
    ctx.ellipse(cx, cy, Rh, Rv, 0, 0, Math.PI * 2);
    ctx.ellipse(cx, cy, Math.max(1, Rh - ti), Math.max(1, Rv - ti), 0, 0, Math.PI * 2, true);
    ctx.fillStyle = dk ? 'rgba(55,127,235,.13)' : 'rgba(55,127,235,.08)';
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(cx, cy, Rh, Rv, 0, 0, Math.PI * 2);
    ctx.strokeStyle = '#377feb';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(1, Rh - ti), Math.max(1, Rv - ti), 0, 0, Math.PI * 2);
    ctx.strokeStyle = dk ? 'rgba(96,165,250,.4)' : 'rgba(55,127,235,.28)';
    ctx.lineWidth = 1.3;
    ctx.stroke();

    // ① 자연상태 예상 원주선 (코랄 레드 파선 #ef4444)
    ctx.beginPath();
    ctx.ellipse(cx, cy, natRh, natRv, 0, 0, Math.PI * 2);
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);

    // ③ 현장 실측 원주선 (에메랄드 그린 1점쇄선 #10b981, D_max >= D_min > 0 일 때 표시)
    if (hasMeas) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, measRh, measRv, 0, 0, Math.PI * 2);
      ctx.setLineDash([8, 3, 2, 3]);
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    function dl(x1, y1, x2, y2, c) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = c;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
    }
    const maxHoriz = Math.max(Rh, natRh, measRh);
    dl(cx - maxHoriz - 10, cy, cx + maxHoriz + 10, cy, 'rgba(55,127,235,.45)');
    dl(cx, cy - maxUpR - 10, cx, cy + maxDownR + 10, 'rgba(245,158,11,.45)');

    ctx.font = 'bold 9px Inter,sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#377feb';
    ctx.fillText('Dh=' + Dh.toFixed(2) + 'mm', cx + maxHoriz + 8, cy - 5);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f59e0b';
    ctx.fillText('Dv=' + Dv.toFixed(2) + 'mm', cx, cy - maxUpR - 12);
    ctx.fillStyle = dk ? 'rgba(255,255,255,.28)' : 'rgba(0,0,0,.28)';
    ctx.fillText('D nom.=' + D + 'mm', cx, cy + maxDownR + 12);

    function drawRoller(aDeg, lbl, isLeft) {
      const aRad = aDeg * Math.PI / 180;
      const side = isLeft ? -1 : 1;
      const ca = Math.PI / 2 + side * aRad;
      const cpx = cx + Rh * Math.cos(ca);
      const cpy = cy + Rv * Math.sin(ca);
      const nx = Math.cos(ca);
      const ny = Math.sin(ca);
      const rcx = cpx + nx * RolPx;
      const rcy = cpy + ny * RolPx;

      ctx.beginPath();
      ctx.arc(rcx + 2, rcy + 2, RolPx, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,.13)';
      ctx.fill();

      const g = ctx.createRadialGradient(rcx - RolPx * 0.28, rcy - RolPx * 0.28, RolPx * 0.08, rcx, rcy, RolPx);
      g.addColorStop(0, dk ? '#4a5888' : '#dde6ff');
      g.addColorStop(0.55, dk ? '#2a3558' : '#b8c8e8');
      g.addColorStop(1, dk ? '#1a2240' : '#8aa0cc');
      ctx.beginPath();
      ctx.arc(rcx, rcy, RolPx, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = dk ? '#5a6898' : '#7890cc';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(rcx, rcy, RolPx * 0.34, 0, Math.PI * 2);
      ctx.fillStyle = dk ? '#0d1117' : '#fff';
      ctx.fill();
      ctx.strokeStyle = dk ? '#3a4568' : '#99aac8';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(rcx, rcy, RolPx * 0.1, 0, Math.PI * 2);
      ctx.fillStyle = '#377feb';
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(cpx, cpy);
      ctx.lineTo(rcx, rcy);
      ctx.setLineDash([2, 2]);
      ctx.strokeStyle = 'rgba(245,158,11,.6)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.arc(cpx, cpy, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#f59e0b';
      ctx.fill();

      if (lbl) {
        ctx.font = 'bold 8px JetBrains Mono,monospace';
        ctx.fillStyle = dk ? 'rgba(255,255,255,.6)' : 'rgba(0,0,0,.48)';
        ctx.textAlign = isLeft ? 'right' : 'left';
        ctx.fillText(lbl, rcx + side * (RolPx + 4), rcy + 4);
        ctx.textAlign = 'left';
      }
    }

    function drawFloor() {
      const fy = cy + Math.max(Rv, Ro) + RolPx * 2 + 6;
      const fw = maxHoriz + RolPx + 20;
      ctx.beginPath();
      ctx.moveTo(cx - fw, fy);
      ctx.lineTo(cx + fw, fy);
      ctx.strokeStyle = dk ? 'rgba(255,255,255,.17)' : 'rgba(0,0,0,.13)';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      for (let hx = cx - fw; hx <= cx + fw; hx += 9) {
        ctx.beginPath();
        ctx.moveTo(hx, fy);
        ctx.lineTo(hx - 5, fy + 5);
        ctx.strokeStyle = dk ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.06)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    function drawSaddle() {
      const sh = 13;
      const sa = 60 * Math.PI / 180;
      const stA = Math.PI / 2 + sa;
      const enA = Math.PI / 2 - sa;
      ctx.beginPath();
      ctx.arc(cx, cy, Ro + sh, stA, enA, true);
      ctx.arc(cx, cy, Ro, enA, stA, false);
      ctx.closePath();
      const sg = ctx.createLinearGradient(cx, cy + Ro, cx, cy + Ro + sh);
      sg.addColorStop(0, dk ? 'rgba(99,102,241,.4)' : 'rgba(99,102,241,.2)');
      sg.addColorStop(1, dk ? 'rgba(67,56,202,.12)' : 'rgba(67,56,202,.06)');
      ctx.fillStyle = sg;
      ctx.fill();
      ctx.strokeStyle = dk ? 'rgba(99,102,241,.75)' : 'rgba(67,56,202,.55)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.font = 'bold 8px Inter,sans-serif';
      ctx.fillStyle = dk ? 'rgba(165,180,252,.85)' : 'rgba(67,56,202,.75)';
      ctx.textAlign = 'center';
      ctx.fillText('120° Saddle (2α=120°)', cx, cy + Ro + sh + 12);
      const fy = cy + Ro + sh + 5;
      const fw = Ro + 16;
      ctx.beginPath();
      ctx.moveTo(cx - fw, fy);
      ctx.lineTo(cx + fw, fy);
      ctx.strokeStyle = dk ? 'rgba(255,255,255,.17)' : 'rgba(0,0,0,.13)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.textAlign = 'left';
    }

    if (st === 'NATURAL') {
      ctx.beginPath();
      ctx.moveTo(cx, cy - maxUpR - 26);
      ctx.lineTo(cx, cy - maxUpR - 10);
      ctx.strokeStyle = dk ? 'rgba(255,255,255,.22)' : 'rgba(0,0,0,.16)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - 5, cy - maxUpR - 16);
      ctx.lineTo(cx, cy - maxUpR - 10);
      ctx.lineTo(cx + 5, cy - maxUpR - 16);
      ctx.fillStyle = dk ? 'rgba(255,255,255,.22)' : 'rgba(0,0,0,.16)';
      ctx.fill();
      ctx.font = '8px Inter,sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = dk ? 'rgba(255,255,255,.22)' : 'rgba(0,0,0,.16)';
      ctx.fillText('W', cx, cy - maxUpR - 29);
      ctx.textAlign = 'left';
    } else if (st === 'SADDLE120') {
      drawSaddle();
    } else if (st === 'TR2_491') {
      drawRoller(49.1, 'α=49.1°', true);
      drawRoller(49.1, 'α=49.1°', false);
      drawFloor();
    } else if (st === 'TR2_45') {
      drawRoller(45, 'α=45°', true);
      drawRoller(45, 'α=45°', false);
      drawFloor();
    } else if (st === 'TR2_30') {
      drawRoller(30, 'α=30°', true);
      drawRoller(30, 'α=30°', false);
      drawFloor();
    } else if (st === 'TR2_CUSTOM') {
      const a = r.p.a || 45;
      drawRoller(a, 'α=' + a + '°', true);
      drawRoller(a, 'α=' + a + '°', false);
      drawFloor();
    } else if (st === 'TR4_STD' || st === 'TR4_CUSTOM') {
      const a1 = st === 'TR4_STD' ? 22.5 : Math.min(r.p.a1 || 30, r.p.a2 || 60);
      const a2 = st === 'TR4_STD' ? 67.5 : Math.max(r.p.a1 || 30, r.p.a2 || 60);
      drawRoller(a1, 'α1=' + a1.toFixed(1) + '°', true);
      drawRoller(a2, 'α2=' + a2.toFixed(1) + '°', true);
      drawRoller(a1, 'α1=' + a1.toFixed(1) + '°', false);
      drawRoller(a2, 'α2=' + a2.toFixed(1) + '°', false);
      drawFloor();
      ctx.font = 'bold 8px JetBrains Mono,monospace';
      ctx.fillStyle = dk ? 'rgba(255,255,255,.42)' : 'rgba(0,0,0,.36)';
      ctx.textAlign = 'center';
      ctx.fillText('4-Roll TR4  α1=' + a1.toFixed(1) + '°  α2=' + a2.toFixed(1) + '°', cx, cy + Math.max(Rv, Ro) + RolPx * 2 + 20);
      ctx.textAlign = 'left';
    } else if (st === 'DOUBLE_ROLLER') {
      const ac = r.p.ac || 45;
      const gr = r.p.gr || 10;
      drawRoller(ac - gr, 'α' + (ac - gr).toFixed(1) + '°', true);
      drawRoller(ac + gr, 'α' + (ac + gr).toFixed(1) + '°', true);
      drawRoller(ac - gr, 'α' + (ac - gr).toFixed(1) + '°', false);
      drawRoller(ac + gr, 'α' + (ac + gr).toFixed(1) + '°', false);
      drawFloor();
      ctx.font = 'bold 8px JetBrains Mono,monospace';
      ctx.fillStyle = dk ? 'rgba(255,255,255,.42)' : 'rgba(0,0,0,.36)';
      ctx.textAlign = 'center';
      ctx.fillText('α_c=' + ac + '°  γ=±' + gr + '°', cx, cy + Math.max(Rv, Ro) + RolPx * 2 + 20);
      ctx.textAlign = 'left';
    }

    const pct = r.oval_pct;
    const pass = r.comp.API_2B.pass;
    let byTop = cy - maxUpR - 44;
    if (byTop < 8) byTop = 8;
    ctx.beginPath();
    rRect(ctx, cx - 70, byTop, 140, 24, 7);
    ctx.fillStyle = pass
      ? (dk ? 'rgba(22,163,74,.22)' : 'rgba(22,163,74,.12)')
      : (dk ? 'rgba(220,38,38,.22)' : 'rgba(220,38,38,.1)');
    ctx.fill();
    ctx.strokeStyle = pass ? 'rgba(22,163,74,.4)' : 'rgba(220,38,38,.32)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = 'bold 10px JetBrains Mono,monospace';
    ctx.fillStyle = pass ? '#16a34a' : '#dc2626';
    ctx.textAlign = 'center';
    ctx.fillText('Ovality = ' + pct.toFixed(2) + '%', cx, byTop + 16);
    ctx.textAlign = 'left';

    const lmap = {
      NATURAL: 'Free',
      SADDLE120: '120°Saddle',
      TR2_491: 'TR2 α49.1°',
      TR2_45: 'TR2 α45°',
      TR2_30: 'TR2 α30°',
      TR2_CUSTOM: 'TR2 Custom',
      TR4_STD: 'TR4 4-Roll (22.5°/67.5°)',
      TR4_CUSTOM: 'TR4 4-Roll Custom',
      DOUBLE_ROLLER: 'Double Roller (4-Roll)'
    };
    ctx.font = 'bold 9px Inter,sans-serif';
    ctx.fillStyle = dk ? 'rgba(99,102,241,.75)' : 'rgba(55,127,235,.8)';
    ctx.textAlign = 'right';
    ctx.fillText(lmap[st] || st, W - 10, 16);
    if (exag > 1.05) {
      ctx.textAlign = 'left';
      ctx.fillStyle = dk ? 'rgba(255,255,255,.4)' : 'rgba(0,0,0,.38)';
      ctx.fillText('Scale ×' + exag.toFixed(1), 10, 16);
    }

    // 하단 3색 원주선 범례 (자연상태 · 지지상태 · 현장 실측)
    const legY = H - 34;
    ctx.beginPath();
    rRect(ctx, 10, legY, W - 20, 26, 7);
    ctx.fillStyle = dk ? 'rgba(13,17,23,.7)' : 'rgba(255,255,255,.85)';
    ctx.fill();
    ctx.strokeStyle = dk ? 'rgba(255,255,255,.12)' : 'rgba(205,213,232,.9)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const legItems = [
      {
        col: '#ef4444',
        dash: [5, 3],
        txt: `${labels.nat || '자연상태'} ${(r.natOval_pct || 0).toFixed(2)}%`
      },
      {
        col: '#377feb',
        dash: [],
        txt: `${labels.sup || '지지상태'} ${(r.oval_pct || 0).toFixed(2)}%`
      },
      {
        col: hasMeas ? '#10b981' : (dk ? 'rgba(255,255,255,.32)' : '#9aa3bc'),
        dash: hasMeas ? [6, 2, 2, 2] : [2, 2],
        txt: `${labels.meas || '현장실측'} ${hasMeas ? measPct.toFixed(2) + '%' : '—'}`
      }
    ];
    const colW = (W - 28) / 3;
    legItems.forEach((it, idx) => {
      const lx = 16 + idx * colW;
      const ly = legY + 13;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx + 15, ly);
      ctx.setLineDash(it.dash);
      ctx.strokeStyle = it.col;
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = 'bold 9px Inter,sans-serif';
      ctx.fillStyle = dk ? '#e2e8f8' : '#1a2340';
      if (idx === 2 && !hasMeas) ctx.fillStyle = dk ? 'rgba(255,255,255,.38)' : '#9aa3bc';
      ctx.textAlign = 'left';
      ctx.fillText(it.txt, lx + 19, ly + 3);
    });
    ctx.textAlign = 'left';
    if (sampleTag) drawSampleWatermark(ctx, W, H, sampleTag);
  }

  function drawSideView(r, nSets, spanMm, pipeLenMm, nWelds, nActive = 0, info = {}, theme = 'light', labels = {}) {
    const cvs = document.getElementById('cvs-sv');
    if (!cvs || !r) return;
    const ctx = cvs.getContext('2d');
    const W = cvs.width;
    const H = cvs.height;
    const dk = theme === 'dark';

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = dk ? '#1a2030' : '#f0f2f7';
    rRect(ctx, 0, 0, W, H, 10);
    ctx.fill();

    const D = r.p.D;
    const t = r.p.t;
    const PAD_L = 54, PAD_R = 20, PAD_T = 60, PAD_B = 90;
    const drawW = W - PAD_L - PAD_R;
    const drawH = H - PAD_T - PAD_B;
    const scaleX = drawW / pipeLenMm;
    const pipeHpx = Math.min(drawH * 0.4, 80);
    const pipeY = PAD_T + drawH * 0.15;

    const id_ = D - 2 * t;
    const Ib = Math.PI * (Math.pow(D, 4) - Math.pow(id_, 4)) / 64;
    const w_n = 7.85e-5 * Math.PI * (D * D - id_ * id_) / 4;
    const span = pipeLenMm / (nSets + 1);
    const deflMm = 5 * w_n * Math.pow(span, 4) / (384 * 206000 * Ib);
    const deflPx = Math.min(deflMm * scaleX * 50, pipeHpx * 0.35);

    const xAt = mm => PAD_L + mm * scaleX;
    function pipeCenterY(xpx) {
      const xMm = (xpx - PAD_L) / scaleX;
      const supports = [0];
      for (let i = 1; i <= nSets; i++) supports.push(i * span);
      supports.push(pipeLenMm);
      let defl = 0;
      for (let s = 0; s < supports.length - 1; s++) {
        const x0 = supports[s], x1 = supports[s + 1], L0 = x1 - x0;
        if (xMm >= x0 && xMm <= x1) {
          const xv = xMm - x0;
          const raw = w_n / (24 * 206000 * Ib) * (Math.pow(xv, 4) - 2 * L0 * Math.pow(xv, 3) + Math.pow(L0, 3) * xv);
          const maxRaw = 5 * w_n * Math.pow(L0, 4) / (384 * 206000 * Ib);
          defl = (maxRaw > 0 ? raw / maxRaw : 0) * deflPx;
          break;
        }
      }
      return pipeY + pipeHpx / 2 + defl;
    }

    const nSeg = 200;
    function drawPipeOutline(offsetY) {
      ctx.beginPath();
      for (let i = 0; i <= nSeg; i++) {
        const xpx = PAD_L + (i / nSeg) * (pipeLenMm * scaleX);
        const y = pipeCenterY(xpx) + offsetY;
        if (i === 0) ctx.moveTo(xpx, y);
        else ctx.lineTo(xpx, y);
      }
    }

    ctx.beginPath();
    for (let i = 0; i <= nSeg; i++) {
      const xpx = PAD_L + (i / nSeg) * (pipeLenMm * scaleX);
      const yc = pipeCenterY(xpx);
      if (i === 0) ctx.moveTo(xpx, yc - pipeHpx / 2);
      else ctx.lineTo(xpx, yc - pipeHpx / 2);
    }
    for (let i = nSeg; i >= 0; i--) {
      const xpx = PAD_L + (i / nSeg) * (pipeLenMm * scaleX);
      const yc = pipeCenterY(xpx);
      ctx.lineTo(xpx, yc + pipeHpx / 2);
    }
    ctx.closePath();
    ctx.fillStyle = dk ? 'rgba(37,99,235,.14)' : 'rgba(37,99,235,.08)';
    ctx.fill();

    drawPipeOutline(-pipeHpx / 2);
    ctx.strokeStyle = '#377feb';
    ctx.lineWidth = 2;
    ctx.stroke();

    drawPipeOutline(+pipeHpx / 2);
    ctx.strokeStyle = '#377feb';
    ctx.lineWidth = 2;
    ctx.stroke();

    function drawCap(xpx) {
      const yc = pipeCenterY(xpx);
      ctx.beginPath();
      ctx.moveTo(xpx, yc - pipeHpx / 2);
      ctx.lineTo(xpx, yc + pipeHpx / 2);
      ctx.strokeStyle = '#377feb';
      ctx.lineWidth = 3;
      ctx.stroke();
      const ti_px = Math.max(3, Math.min(t * scaleX * 2, pipeHpx * 0.25));
      ctx.beginPath();
      ctx.moveTo(xpx, yc - pipeHpx / 2 + ti_px);
      ctx.lineTo(xpx, yc + pipeHpx / 2 - ti_px);
      ctx.strokeStyle = dk ? 'rgba(96,165,250,.5)' : 'rgba(37,99,235,.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    drawCap(PAD_L);
    drawCap(PAD_L + pipeLenMm * scaleX);

    const floorY = pipeY + pipeHpx / 2 + 44;
    ctx.beginPath();
    ctx.moveTo(PAD_L - 8, floorY);
    ctx.lineTo(PAD_L + pipeLenMm * scaleX + 8, floorY);
    ctx.strokeStyle = dk ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.14)';
    ctx.lineWidth = 2;
    ctx.stroke();
    for (let hx = PAD_L - 8; hx < PAD_L + pipeLenMm * scaleX + 8; hx += 10) {
      ctx.beginPath();
      ctx.moveTo(hx, floorY);
      ctx.lineTo(hx - 6, floorY + 6);
      ctx.strokeStyle = dk ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.06)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    const rollerW = Math.max(10, Math.min(22, pipeLenMm * scaleX * 0.025));
    const rollerH = 24;
    const settleEl = typeof document !== 'undefined' ? document.getElementById('i-settle') : null;
    const capEl = typeof document !== 'undefined' ? document.getElementById('i-rcap') : null;
    const settleMm = (info && info.settleMm !== undefined) ? +info.settleMm : (settleEl ? (+settleEl.value || 0) : 0);
    const capTon = (info && info.capTon !== undefined) ? +info.capTon : (capEl ? (+capEl.value || 0) : 0);
    const capKN = capTon > 0 ? capTon * 9.81 : 0;
    const cb = (typeof TOAEngine !== 'undefined' && typeof TOAEngine.continuousBeamReactions === 'function')
      ? TOAEngine.continuousBeamReactions(D, t, pipeLenMm, nSets, settleMm)
      : null;
    let overloadCount = 0;

    for (let i = 1; i <= nSets; i++) {
      const xMm = i * span;
      const xpx = xAt(xMm);
      const botY = pipeCenterY(xpx) + pipeHpx / 2;
      const rk = cb && cb.reactionsKN && cb.reactionsKN[i - 1] !== undefined ? cb.reactionsKN[i - 1] : null;
      const isLift = rk !== null && rk <= 0;
      const isOver = rk !== null && capKN > 0 && rk > capKN;
      if (isOver) overloadCount++;

      ctx.beginPath();
      ctx.moveTo(xpx, botY);
      ctx.lineTo(xpx, floorY - 2);
      ctx.strokeStyle = isLift ? 'rgba(220,38,38,.45)' : isOver ? 'rgba(220,38,38,.55)' : (dk ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.1)');
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);

      const ry = botY + 4;
      ctx.beginPath();
      ctx.moveTo(xpx - rollerW, ry + rollerH);
      ctx.lineTo(xpx - rollerW * 0.4, ry + 4);
      ctx.lineTo(xpx, ry);
      ctx.lineTo(xpx + rollerW * 0.4, ry + 4);
      ctx.lineTo(xpx + rollerW, ry + rollerH);
      ctx.strokeStyle = (isLift || isOver) ? '#dc2626' : (dk ? '#5a6898' : '#4a6098');
      ctx.lineWidth = (isLift || isOver) ? 2 : 1.5;
      ctx.stroke();

      const rr = Math.max(6, rollerW * 0.52);
      [-1, 1].forEach(side => {
        const rx = xpx + side * rollerW * 0.72;
        const ry2 = ry + rollerH * 0.6;
        ctx.beginPath();
        ctx.arc(rx + 1, ry2 + 1, rr, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,.12)';
        ctx.fill();

        const grd = ctx.createRadialGradient(rx - rr * 0.25, ry2 - rr * 0.25, rr * 0.05, rx, ry2, rr);
        grd.addColorStop(0, dk ? '#4a5888' : '#dde6ff');
        grd.addColorStop(0.6, dk ? '#2a3558' : '#b8c8e8');
        grd.addColorStop(1, dk ? '#1a2240' : '#8aa0cc');
        ctx.beginPath();
        ctx.arc(rx, ry2, rr, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();
        ctx.strokeStyle = (isLift || isOver) ? '#dc2626' : (dk ? '#5a6898' : '#7890cc');
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(rx, ry2, rr * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = dk ? '#0d1117' : '#fff';
        ctx.fill();
      });

      ctx.font = 'bold 10px Inter,sans-serif';
      ctx.fillStyle = (isLift || isOver) ? '#dc2626' : (dk ? 'rgba(255,255,255,.7)' : '#377feb');
      ctx.textAlign = 'center';
      ctx.fillText('S' + i, xpx, floorY + 14);
      if (rk !== null) {
        ctx.font = 'bold 8.5px JetBrains Mono,monospace';
        ctx.fillStyle = isLift ? '#dc2626' : isOver ? '#dc2626' : (dk ? '#94a3b8' : '#475569');
        const rTxt = isLift ? 'LIFT-OFF' : (isOver ? `${rk.toFixed(0)}kN!` : `${rk.toFixed(1)}kN`);
        ctx.fillText(rTxt, xpx, floorY + 25);
      }

      if (i === 1) {
        const x0 = PAD_L, x1 = xpx, dimY = pipeY - 18;
        ctx.beginPath();
        ctx.moveTo(x0 + 2, dimY);
        ctx.lineTo(x1 - 2, dimY);
        ctx.setLineDash([3, 2]);
        ctx.strokeStyle = dk ? 'rgba(245,158,11,.7)' : 'rgba(180,90,0,.6)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);

        [[x0 + 2, dimY, 'r'], [x1 - 2, dimY, 'l']].forEach(a => {
          ctx.beginPath();
          if (a[2] === 'r') {
            ctx.moveTo(a[0], a[1]); ctx.lineTo(a[0] + 5, a[1] - 3); ctx.lineTo(a[0] + 5, a[1] + 3);
          } else {
            ctx.moveTo(a[0], a[1]); ctx.lineTo(a[0] - 5, a[1] - 3); ctx.lineTo(a[0] - 5, a[1] + 3);
          }
          ctx.fillStyle = dk ? 'rgba(245,158,11,.7)' : 'rgba(180,90,0,.6)';
          ctx.fill();
        });
        ctx.font = 'bold 9px JetBrains Mono,monospace';
        ctx.fillStyle = dk ? 'rgba(245,158,11,.85)' : 'rgba(180,90,0,.75)';
        ctx.textAlign = 'center';
        ctx.fillText(Math.round(span) + 'mm', (x0 + x1) / 2, dimY - 4);
      }
    }
    ctx.textAlign = 'left';

    for (let w = 0; w < nWelds; w++) {
      const wxMm = nWelds === 1 ? pipeLenMm / 2 : (w + 1) * pipeLenMm / (nWelds + 1);
      const wxpx = xAt(wxMm);
      const wyc = pipeCenterY(wxpx);

      ctx.beginPath();
      ctx.moveTo(wxpx, wyc - pipeHpx / 2 - 4);
      ctx.lineTo(wxpx, wyc + pipeHpx / 2 + 4);
      ctx.setLineDash([5, 3]);
      ctx.strokeStyle = dk ? 'rgba(251,191,36,.7)' : 'rgba(180,100,0,.65)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.moveTo(wxpx - 5, wyc - pipeHpx / 2 - 10);
      ctx.lineTo(wxpx + 5, wyc - pipeHpx / 2 - 10);
      ctx.lineTo(wxpx, wyc - pipeHpx / 2 - 4);
      ctx.closePath();
      ctx.fillStyle = dk ? 'rgba(251,191,36,.8)' : 'rgba(200,110,0,.75)';
      ctx.fill();

      ctx.font = 'bold 9px Inter,sans-serif';
      ctx.fillStyle = dk ? 'rgba(251,191,36,.8)' : 'rgba(200,110,0,.8)';
      ctx.textAlign = 'center';
      ctx.fillText('W' + (w + 1), wxpx, wyc - pipeHpx / 2 - 13);
    }
    ctx.textAlign = 'left';

    ctx.font = 'bold 11px Inter,sans-serif';
    ctx.fillStyle = dk ? 'rgba(255,255,255,.7)' : 'rgba(30,40,70,.7)';
    ctx.textAlign = 'left';
    ctx.fillText('D=' + D + 'mm  L=' + (pipeLenMm / 1000).toFixed(1) + 'm  L/D=' + (pipeLenMm / D).toFixed(1), PAD_L, 18);

    ctx.textAlign = 'right';
    ctx.fillStyle = dk ? 'rgba(99,162,251,.85)' : 'rgba(37,99,235,.8)';
    ctx.fillText(nSets + ' sets @ ' + Math.round(span) + 'mm spacing', W - PAD_R, 18);
    ctx.textAlign = 'left';

    const deflMmShow = 5 * w_n * Math.pow(span, 4) / (384 * 206000 * Ib);
    ctx.font = '10px JetBrains Mono,sans-serif';
    ctx.fillStyle = deflMmShow > D * 0.001 ? (dk ? '#f87171' : '#dc2626') : (dk ? '#22c55e' : '#16a34a');
    ctx.textAlign = 'right';
    ctx.fillText('max δ=' + deflMmShow.toFixed(2) + 'mm (' + (deflMmShow / D * 100).toFixed(3) + '%D)', W - PAD_R, H - 8);
    ctx.textAlign = 'left';

    const legY = H - 28;
    ctx.fillStyle = dk ? 'rgba(150,180,255,.8)' : '#4a6098';
    ctx.fillRect(PAD_L, legY, 14, 10);
    ctx.font = '10px Inter,sans-serif';
    ctx.fillStyle = dk ? 'rgba(255,255,255,.6)' : 'rgba(0,0,0,.55)';
    ctx.fillText(labels.roller || '터닝롤러', PAD_L + 18, legY + 9);

    if (nWelds > 0) {
      ctx.strokeStyle = dk ? 'rgba(251,191,36,.7)' : 'rgba(180,100,0,.65)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 2]);
      ctx.beginPath();
      ctx.moveTo(PAD_L + 100, legY + 5);
      ctx.lineTo(PAD_L + 114, legY + 5);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = dk ? 'rgba(255,255,255,.6)' : 'rgba(0,0,0,.55)';
      ctx.fillText(labels.weld || '용접부', PAD_L + 118, legY + 9);
    }

    const infoEl = document.getElementById('sv-info');
    if (infoEl) {
      if (labels && labels.sampleInfoHtml) {
        infoEl.innerHTML = labels.sampleInfoHtml;
      } else {
        const govLd = pipeLenMm / D;
        const govLabel = info.govLabel || '구조 기준';
        const Ldfl = info.L_defl ? Math.round(info.L_defl) + 'mm' : '—';
        const shz = info.span_hertz ? Math.round(info.span_hertz) + 'mm' : '—';
        const plateEl = document.getElementById('i-platespan');
        const plateW = plateEl ? +plateEl.value || 0 : 0;
        let plateNote = '';
        if (plateW > 0 && info.L_defl && plateW < info.L_defl) {
          plateNote = `<span style="color:var(--gn)"> ✓ 플레이트 간격(${plateW}mm) &lt; 구조 허용 스팬(${Ldfl}) → 롤러 세트 수에 영향 없음</span>`;
        }
        const activeNote = nActive > 0
          ? `  <span style="color:var(--ac)">│ 진행 중 용접 ${nActive}개 → 최소 ${Math.max(nActive + 3, 4)}세트 (용접부 좌우 2세트 배치)</span>`
          : '';
        const cbNote = cb
          ? `<br><span style="color:${(cb.liftOff || overloadCount > 0) ? 'var(--rd)' : 'var(--tx2)'}">연속보 반력(Δh=${settleMm}mm): max <b>${cb.maxKN}kN</b> (편하중 ${cb.loadFactor}×)${cb.liftOff ? ' · <b>⚠ 들뜸(LIFT-OFF) 발생</b>' : ''}${capTon > 0 ? (overloadCount > 0 ? ` · <b>⚠ 정격용량(${capTon}t=${capKN.toFixed(0)}kN) 초과!</b>` : ` · 용량(${capTon}t) OK ✓`) : ''}</span>`
          : '';
        infoEl.innerHTML =
          (labels && labels.sampleTag ? `<span class="beta-sample-badge" style="margin:0 6px 0 0;">${labels.sampleTag}</span>` : '')
          + `<b>권장 세트 수: ${nSets}sets</b>  │  구조 스팬: ${Math.round(span)}mm  │  L/D = ${govLd.toFixed(1)}${activeNote}`
          + `<br><span style="color:var(--txl)">결정 기준: ${govLabel}  │  처짐 허용 스팬: ${Ldfl}  │  Hertz 허용 스팬: ${shz}  │  max δ: ${deflMmShow.toFixed(2)}mm (${(deflMmShow / D * 100).toFixed(3)}%D)</span>`
          + cbNote
          + (nWelds > 0 ? `<br><span style="color:var(--txl)">Girth Weld ${nWelds}개 균등 표시${plateW > 0 ? ` (플레이트 폭 참조: ${plateW}mm)` : ''}</span>` : '')
          + plateNote;
      }
    }
    if (labels && labels.sampleTag) drawSampleWatermark(ctx, W, H, labels.sampleTag);
  }

  function drawSampleWatermark(ctx, W, H, tagText) {
    if (!tagText) return;
    ctx.save();
    // 우측 상단 배지 (다국어 텍스트 길이에 맞춰 폭 자동 계산)
    ctx.font = 'bold 11px Inter, sans-serif';
    const bw = Math.max(72, Math.ceil(ctx.measureText(tagText).width) + 20);
    const bh = 22, bx = W - bw - 10, by = 10;
    ctx.fillStyle = 'rgba(245, 158, 11, 0.94)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tagText, bx + bw / 2, by + bh / 2);

    // 중앙 대각선 워터마크 (시인성 강화)
    ctx.translate(W / 2, H / 2);
    ctx.rotate(-Math.PI / 7);
    ctx.fillStyle = 'rgba(220, 38, 38, 0.24)';
    ctx.font = '900 42px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tagText, 0, 0);
    ctx.restore();
  }

  /**
   * 진원도 불합격 시 권고사항 탭 전용 보강 도면 (단면도: 보강링 + Spider Brace / 측면도: 보강링·스파이더·롤러 배치)
   */
  function drawReinforcement(cvsCs, cvsSv, plan, dark, sampleTag = '[샘플]') {
    if (!plan) return;
    const bg = dark ? '#111622' : '#f8fafc';
    const bdr = dark ? '#252e45' : '#dbe2ee';
    const tx = dark ? '#e2e8f8' : '#1a2340';
    const tx2 = dark ? '#94a3b8' : '#475569';
    const shellCol = dark ? '#60a5fa' : '#2563eb';
    const ringCol = '#f97316';
    const spiderCol = '#8b5cf6';
    const pushCol = '#16a34a';
    const pullCol = '#0284c7';
    const rollerCol = dark ? '#94a3b8' : '#334155';

    // ── 1) 보강 단면도 (Cross-Section: Stiffener Ring + Spider Brace) ──
    if (cvsCs && typeof cvsCs.getContext === 'function') {
      const ctx = cvsCs.getContext('2d');
      const W = cvsCs.width, H = cvsCs.height;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = bdr;
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

      const cx = W * 0.5, cy = H * 0.50;
      const Ro = Math.min(W, H) * 0.34;
      const Ri = Ro * 0.92;
      const Rring = Ro * 0.82;
      const Rhub = Ro * 0.14;

      // 축선
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = dark ? '#2a3550' : '#cbd5e1';
      ctx.beginPath();
      ctx.moveTo(cx - Ro - 24, cy); ctx.lineTo(cx + Ro + 24, cy);
      ctx.moveTo(cx, cy - Ro - 20); ctx.lineTo(cx, cy + Ro + 24);
      ctx.stroke();
      ctx.restore();

      // 강관 쉘 (외경~내경)
      ctx.beginPath();
      ctx.arc(cx, cy, Ro, 0, Math.PI * 2);
      ctx.arc(cx, cy, Ri, 0, Math.PI * 2, true);
      ctx.fillStyle = dark ? 'rgba(96,165,250,0.22)' : 'rgba(37,99,235,0.16)';
      ctx.fill();
      ctx.strokeStyle = shellCol;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, Ro, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, Ri, 0, Math.PI * 2); ctx.stroke();

      // 내부 보강링 (주황색 강조)
      ctx.beginPath();
      ctx.arc(cx, cy, Ri, 0, Math.PI * 2);
      ctx.arc(cx, cy, Rring, 0, Math.PI * 2, true);
      ctx.fillStyle = 'rgba(249,115,22,0.28)';
      ctx.fill();
      ctx.strokeStyle = ringCol;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, Rring, 0, Math.PI * 2); ctx.stroke();

      // Spider Brace 방사형 암
      const arms = plan.spider.arms || 6;
      const pushRad = ((plan.spider.pushDeg || 0) - 90) * Math.PI / 180; // 0°=수직(상하)
      const pullRad = ((plan.spider.pullDeg || 90) - 90) * Math.PI / 180;
      for (let i = 0; i < arms; i++) {
        const ang = pushRad + (i * 2 * Math.PI / arms);
        const x1 = cx + Rhub * Math.cos(ang), y1 = cy + Rhub * Math.sin(ang);
        const x2 = cx + Rring * Math.cos(ang), y2 = cy + Rring * Math.sin(ang);
        ctx.strokeStyle = spiderCol;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();

        // 턴버클 심볼 (암 중간 사각형)
        const xm = (x1 + x2) * 0.5, ym = (y1 + y2) * 0.5;
        ctx.save();
        ctx.translate(xm, ym);
        ctx.rotate(ang);
        ctx.fillStyle = bg;
        ctx.strokeStyle = spiderCol;
        ctx.lineWidth = 1.6;
        ctx.fillRect(-7, -3.5, 14, 7);
        ctx.strokeRect(-7, -3.5, 14, 7);
        ctx.restore();

        // 끝단 패드
        ctx.fillStyle = spiderCol;
        ctx.beginPath(); ctx.arc(x2, y2, 3, 0, Math.PI * 2); ctx.fill();
      }

      // 중앙 허브
      ctx.fillStyle = dark ? '#1e2538' : '#ede9fe';
      ctx.strokeStyle = spiderCol;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, Rhub, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

      // Push(확장) / Pull(인장) 방향 표시 화살표
      const drawDirArrow = (rad, outward, col, label) => {
        const rStart = outward ? Rring * 0.55 : Rring * 0.96;
        const rEnd = outward ? Rring * 0.94 : Rring * 0.58;
        const sx = cx + rStart * Math.cos(rad), sy = cy + rStart * Math.sin(rad);
        const ex = cx + rEnd * Math.cos(rad), ey = cy + rEnd * Math.sin(rad);
        ctx.strokeStyle = col;
        ctx.fillStyle = col;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
        const a = Math.atan2(ey - sy, ex - sx);
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - 7 * Math.cos(a - 0.45), ey - 7 * Math.sin(a - 0.45));
        ctx.lineTo(ex - 7 * Math.cos(a + 0.45), ey - 7 * Math.sin(a + 0.45));
        ctx.closePath();
        ctx.fill();
        if (label) {
          ctx.font = 'bold 9.5px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(label, cx + (Ro + 15) * Math.cos(rad), cy + (Ro + 15) * Math.sin(rad) + 3);
        }
      };
      drawDirArrow(pushRad, true, pushCol, `PUSH ${plan.spider.pushDeg}°`);
      drawDirArrow(pushRad + Math.PI, true, pushCol, '');
      drawDirArrow(pullRad, false, pullCol, `PULL ${plan.spider.pullDeg}°`);
      drawDirArrow(pullRad + Math.PI, false, pullCol, '');

      // 하단 45° 롤러 지지 표시
      const rRad = 12;
      [Math.PI / 2 - Math.PI / 4, Math.PI / 2 + Math.PI / 4].forEach(ra => {
        const rx = cx + (Ro + rRad) * Math.cos(ra);
        const ry = cy + (Ro + rRad) * Math.sin(ra);
        ctx.fillStyle = dark ? '#334155' : '#cbd5e1';
        ctx.strokeStyle = rollerCol;
        ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.arc(rx, ry, rRad, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      });

      // 상단·하단 주석
      ctx.fillStyle = tx;
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`Ring: ${plan.ring.profile}`, 12, 20);
      ctx.fillStyle = spiderCol;
      ctx.fillText(`Spider: ${arms}-Arm · ${plan.spider.pipeSpec}`, 12, 35);
      ctx.fillStyle = tx2;
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`D=${plan.D}mm  t=${plan.t}mm  (Target ≤ ${plan.targetLimitMm}mm)`, cx, H - 10);
      drawSampleWatermark(ctx, W, H, sampleTag);
    }

    // ── 2) 보강 측면도 (Side View: Ring + Spider + Roller Layout) ──
    if (cvsSv && typeof cvsSv.getContext === 'function') {
      const ctx = cvsSv.getContext('2d');
      const W = cvsSv.width, H = cvsSv.height;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = bdr;
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

      const padL = 42, padR = 32;
      const pipeW = W - padL - padR;
      const pipeH = 110;
      const py = H * 0.36;
      const L = plan.L || 6000;
      const toX = mm => padL + (mm / L) * pipeW;

      // 상단 범례
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = ringCol; ctx.fillRect(14, 14, 10, 10);
      ctx.fillStyle = tx; ctx.fillText(`Stiffener Ring (${plan.ring.count}ea, @${plan.ring.spacingMm}mm)`, 28, 23);
      ctx.fillStyle = spiderCol; ctx.fillRect(255, 14, 10, 10);
      ctx.fillStyle = tx; ctx.fillText(`Spider (${plan.spider.count}ea)`, 269, 23);
      ctx.fillStyle = rollerCol; ctx.fillRect(365, 14, 10, 10);
      ctx.fillStyle = tx; ctx.fillText(`Roller (${plan.support.recSets} sets)`, 379, 23);

      // 강관 본체
      ctx.fillStyle = dark ? 'rgba(96,165,250,0.14)' : 'rgba(37,99,235,0.08)';
      ctx.strokeStyle = shellCol;
      ctx.lineWidth = 2;
      ctx.fillRect(padL, py, pipeW, pipeH);
      ctx.strokeRect(padL, py, pipeW, pipeH);

      // 중심선
      ctx.save();
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = dark ? '#334155' : '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(padL - 8, py + pipeH / 2); ctx.lineTo(padL + pipeW + 8, py + pipeH / 2); ctx.stroke();
      ctx.restore();

      // 내부 보강링 위치 (주황 수직 바)
      (plan.ring.positionsMm || []).forEach((pos, idx) => {
        const x = toX(pos);
        ctx.strokeStyle = ringCol;
        ctx.lineWidth = 3.5;
        ctx.beginPath(); ctx.moveTo(x, py + 2); ctx.lineTo(x, py + pipeH - 2); ctx.stroke();
        ctx.fillStyle = ringCol;
        ctx.font = 'bold 9px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`R${idx + 1}`, x, py - 6);
      });

      // Spider Brace 위치 (보라 X 브레이스 표시)
      (plan.spider.positionsMm || []).forEach((pos, idx) => {
        const x = toX(pos);
        ctx.strokeStyle = spiderCol;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 6, py + 12); ctx.lineTo(x + 6, py + pipeH - 12);
        ctx.moveTo(x + 6, py + 12); ctx.lineTo(x - 6, py + pipeH - 12);
        ctx.stroke();
        ctx.fillStyle = spiderCol;
        ctx.font = 'bold 9px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`S${idx + 1}`, x, py - 18);
      });

      // 하단 권장 롤러 세트
      const rY = py + pipeH + 14;
      (plan.support.rollerPositionsMm || []).forEach((pos, idx) => {
        const x = toX(pos);
        ctx.fillStyle = dark ? '#334155' : '#cbd5e1';
        ctx.strokeStyle = rollerCol;
        ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.arc(x, rY, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = tx2;
        ctx.font = '9px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`#${idx + 1}`, x, rY + 22);
      });

      // 하단 간격 치수선 (전체 L 및 롤러 간격)
      const dimY = H - 36;
      ctx.strokeStyle = tx2;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padL, dimY); ctx.lineTo(padL + pipeW, dimY);
      ctx.moveTo(padL, dimY - 5); ctx.lineTo(padL, dimY + 5);
      ctx.moveTo(padL + pipeW, dimY - 5); ctx.lineTo(padL + pipeW, dimY + 5);
      ctx.stroke();
      ctx.fillStyle = tx;
      ctx.font = 'bold 10px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(
        `L = ${L}mm  |  Ring @${plan.ring.spacingMm}mm (End ${plan.ring.endOffsetMm}mm)  |  Roller @${plan.support.recSpanMm}mm`,
        padL + pipeW / 2, H - 14
      );
      drawSampleWatermark(ctx, W, H, sampleTag);
    }
  }

  return {
    drawCrossSection,
    drawSideView,
    drawReinforcement
  };
})();
window.TOADiagram = TOADiagram;
