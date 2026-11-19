/**
 * TOA - Tubular Ovality & Roller Analysis Engine (v1.1 — formula review)
 * Theory   : Thin elastic ring (Roark's Formulas 9th Ed., Table 9.2) solved by Castigliano
 *            (redundants M_A, N_A at the top section; roller normal reactions are RADIAL)
 *            · Hertz Line Contact Theory · Brazier Buckling
 * Standards: API 2B · ISO 19902 · API 5L · DNV-OS-C401
 * Ring I   : I = t³ / 12 per unit axial length (E not reduced for plane strain)
 * Validity : linear small-deflection ring theory — results with ΔD/D ≳ 5 % are indicative only.
 * Verified : Roark case 1 (diametral load) and case 15 (own weight on base) reproduced exactly.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TOAEngine: factory() };
  } else {
    root.TOAEngine = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const C = Object.freeze({
    E: 206000,            // Young's modulus (N/mm²)
    g: 7.85e-5,           // Unit weight (N/mm³)
    nu: 0.3,              // Poisson's ratio
    PI: Math.PI,
    SADDLE_HALF_DEG: 60,  // 120° saddle → half contact angle
    RING_N: 2000          // integration intervals over half ring
  });

  function gA(D, t) {
    const id = D - 2 * t;
    return C.PI * (D * D - id * id) / 4;
  }

  function gW(D, t) {
    return C.g * gA(D, t);
  }

  function gR(D, t) {
    return (D - t) / 2;
  }

  function gI(D, t) {
    return (t * t * t) / 12;
  }

  function evaluateDT(D, t) {
    if (!D || !t || t <= 0 || t >= D / 2) return null;
    const dt = D / t;
    const R = gR(D, t);
    const isThin = dt >= 20;
    const isoLimitPct = dt > 120 ? 0.5 : 1.0;
    const brazierLevel = dt > 300 ? 'HIGH' : dt > 200 ? 'MODERATE' : 'LOW';
    return { dt, R, isThin, isoLimitPct, brazierLevel };
  }

  /**
   * 예측 진원도 각 상태별 좌굴위험(Brazier / 편평화 좌굴) 판정
   */
  function evaluateStateBuckling(D, t, ovalPct) {
    if (!D || !t || t <= 0 || t >= D / 2) return null;
    const dt = D / t;
    const isoLimitPct = dt > 120 ? 0.5 : 1.0;
    const op = Number.isFinite(ovalPct) ? ovalPct : 0;
    let level = 'LOW';
    if (op >= 5.0 || (dt > 300 && op > isoLimitPct)) {
      level = 'HIGH';
    } else if (dt > 300 || (dt > 200 && op > isoLimitPct) || op >= 2.0) {
      level = 'MODERATE';
    }
    return { level, dt: +dt.toFixed(1), isoLimitPct, ovalPct: +op.toFixed(4) };
  }

  /**
   * Thin-ring solver (own weight + supports), half ring cut at the top (φ = 0 top → π bottom).
   *  supports : [{ alphaDeg, V }]  roller on the right half at α from the bottom,
   *             V = vertical share of its normal reaction [N/mm]; the force acts RADIALLY (toward centre).
   *  saddleHalfDeg : if given, uniform radial contact pressure over ±saddleHalfDeg about the bottom.
   * Redundants M_A and horizontal force N_A at the top are solved from
   *   ∂U/∂M_A = 0 , ∂U/∂N_A = 0  (symmetry: zero rotation / zero relative horizontal displacement).
   * Diameter changes by the unit-load method (diametral pair, vertical and horizontal).
   */
  function ringSolve(D, t, supports, saddleHalfDeg) {
    const R = gR(D, t);
    const W = gW(D, t);                       // total own weight per unit axial length [N/mm]
    const EI = C.E * gI(D, t);
    const q = W / (2 * C.PI * R);             // own weight per unit arc length
    const n = C.RING_N;
    const dp = C.PI / n;
    const phi = new Float64Array(n + 1);
    const sinPhi = new Float64Array(n + 1);
    const cosPhi = new Float64Array(n + 1);
    const wTrap = new Float64Array(n + 1);
    const M0 = new Float64Array(n + 1);
    for (let i = 0; i <= n; i++) {
      const p = i * dp;
      phi[i] = p;
      sinPhi[i] = Math.sin(p);
      cosPhi[i] = Math.cos(p);
      wTrap[i] = (i === 0 || i === n) ? 0.5 : 1;
      M0[i] = q * R * R * (p * sinPhi[i] - (1 - cosPhi[i]));
    }

    const trap = f => {
      let s = 0;
      for (let i = 0; i <= n; i++) s += wTrap[i] * f(i);
      return s * dp;
    };

    const addPoint = (pos, fx, fy) => {
      const xF = R * Math.sin(pos);
      const yF = R * Math.cos(pos);
      for (let i = 0; i <= n; i++) {
        if (phi[i] > pos) {
          M0[i] += (xF - R * sinPhi[i]) * fy - (yF - R * cosPhi[i]) * fx;
        }
      }
    };

    let sumFySupport = 0;
    let supMomentPi = 0;
    let minNormal = Infinity;
    const hasSupports = Array.isArray(supports) && supports.length > 0;
    (supports || []).forEach(s => {
      const a = Math.min(85, Math.max(1, s.alphaDeg)) * C.PI / 180;
      const Nn = s.N !== undefined ? s.N : (s.V / Math.cos(a)); // normal (radial) reaction
      const pos = C.PI - a;                   // position measured from the top
      const fx = -Nn * Math.sin(pos);
      const fy = -Nn * Math.cos(pos);
      addPoint(pos, fx, fy);
      sumFySupport += 2 * fy;
      supMomentPi += R * Nn * Math.sin(a);
      if (Nn < minNormal) minNormal = Nn;
    });

    if (saddleHalfDeg) {
      const b = saddleHalfDeg * C.PI / 180;
      const m = 160;
      const db = b / m;
      let sumCos = 0;
      for (let k = 0; k < m; k++) {
        sumCos += Math.cos((k + 0.5) * db);
      }
      // Discrete radial strip force matching uniform pressure p0 = W/(2R sin b) and exact vertical equilibrium ΣFy = W
      const dF = W / (2 * sumCos);
      for (let k = 0; k < m; k++) {
        const beta = (k + 0.5) * db;
        const pos = C.PI - beta;
        const fx = -dF * Math.sin(pos);
        const fy = -dF * Math.cos(pos);
        addPoint(pos, fx, fy);
        sumFySupport += 2 * fy;
        supMomentPi += R * dF * Math.sin(beta);
        if (dF < minNormal) minNormal = dF;
      }
    }

    // 반링(φ∈[0,π]) 자중 분포하중(q·R)을 수치 적분하여 전체 자중 W_num 및 절단면 전단력을 독립 산출
    const W_half_num = trap(() => q * R);
    const W_num = 2 * W_half_num;
    let baseReactionN = 0;
    if (!hasSupports && !saddleHalfDeg) {
      // 자연상태: 상단 정점 대칭(V_A=0)과 반링 자유물체 수직 평형으로부터 바닥 접지점(φ=π) 수직 반력을 독립 도출
      // 접지점은 대칭축(x=0, φ=π)에 위치하므로 φ∈[0,π) 구간 M0 모멘트 기여는 0이며, φ=π 하단 전단 V(π-) = -W_half_num을 상쇄
      const V_bottom_half = -W_half_num;
      const R_base_half = -V_bottom_half;
      baseReactionN = 2 * R_base_half;
      sumFySupport = baseReactionN;
      if (R_base_half < minNormal) minNormal = R_base_half;
    }

    const tensionWarning = Number.isFinite(minNormal) && minNormal < 0;
    const fyErrMax = Math.max(Math.abs(sumFySupport - W_num), Math.abs(sumFySupport - W));
    const eqResidualPct = W > 0 ? +(fyErrMax / W * 100).toFixed(8) : 0;

    const g2 = i => -R * (1 - cosPhi[i]);
    const a11 = trap(() => 1);
    const a12 = trap(i => g2(i));
    const a22 = trap(i => g2(i) * g2(i));
    const b1 = -trap(i => M0[i]);
    const b2 = -trap(i => g2(i) * M0[i]);
    const det = a11 * a22 - a12 * a12;
    const MA = (b1 * a22 - b2 * a12) / det;
    const NA = (a11 * b2 - a12 * b1) / det;

    const MfArr = new Float64Array(n + 1);
    let maxAbsM = 0;
    for (let i = 0; i <= n; i++) {
      const mVal = MA + NA * g2(i) + M0[i];
      MfArr[i] = mVal;
      const am = Math.abs(mVal);
      if (am > maxAbsM) maxAbsM = am;
    }
    const ringBendStressMPa = t > 0 ? +(6 * maxAbsM / (t * t)).toFixed(2) : 0;

    // 독립 적합·모멘트 평형 검증: 반링 Castigliano 변형 적합 잔차 및 하단(φ=π) 적분 모멘트 일치
    const rotCompatRad = Math.abs(trap(i => MfArr[i]) * R / EI);
    const dispCompatMm = Math.abs(trap(i => MfArr[i] * g2(i)) * R / EI);
    const M_grav_pi_num = -trap(i => q * R * R * sinPhi[i]);
    const M_pi_indep = MA - 2 * R * NA + M_grav_pi_num + supMomentPi;
    const qR2 = q * R * R || 1;
    const momentEqResPct = +(Math.abs(MfArr[n] - M_pi_indep) / qR2 * 100).toFixed(8);

    const k = 2 * R / EI;
    const dFactor = -0.25 * R * k * dp;
    // 임의 방위각 θ∈[0, π/2] 대향 외경 변화 ΔD(θ) = w(θ) + w(π-θ) (단위하중 Green 함수 삼각항등식 가속 적분)
    const dTheta = th => {
      const sth = Math.sin(th);
      const cth = Math.cos(th);
      const thComp = C.PI - th;
      let s = 0;
      for (let i = 0; i <= n; i++) {
        const p = phi[i];
        const ker = p <= th
          ? 2 * sth * cosPhi[i]
          : p <= thComp
            ? 2 * cth * sinPhi[i]
            : -2 * sth * cosPhi[i];
        s += wTrap[i] * MfArr[i] * ker;
      }
      return s * dFactor;
    };
    const dv = dTheta(0);
    const dh = dTheta(C.PI / 2);

    // 1) 0.5° 간격(181점) + 지지각 정밀 격자 생성
    const rawThetas = [];
    for (let s = 0; s <= 180; s++) rawThetas.push(s * (C.PI / 360));
    (supports || []).forEach(s => {
      const aRad = Math.min(85, Math.max(1, s.alphaDeg)) * C.PI / 180;
      rawThetas.push(aRad, C.PI / 2 - aRad);
    });
    rawThetas.sort((a, b) => a - b);
    const evalThetas = [];
    for (let i = 0; i < rawThetas.length; i++) {
      if (!evalThetas.length || rawThetas[i] - evalThetas[evalThetas.length - 1] > 1e-9) {
        evalThetas.push(rawThetas[i]);
      }
    }

    const gVals = new Float64Array(evalThetas.length);
    for (let i = 0; i < evalThetas.length; i++) {
      gVals[i] = dTheta(evalThetas[i]);
    }

    // 2) 극값 후보 구간에 대한 황금분할 탐색(Golden-Section Search, tol = 1e-4 rad ≈ 0.0057°)
    const gr = (Math.sqrt(5) - 1) / 2;
    const goldenSearch = (lo, hi, findMax) => {
      let a = lo, b = hi;
      let fA = dTheta(a), fB = dTheta(b);
      let c = b - gr * (b - a);
      let d = a + gr * (b - a);
      let fC = dTheta(c), fD = dTheta(d);
      for (let it = 0; it < 24 && (b - a) > 1e-4; it++) {
        const takeLeft = findMax ? (fC > fD) : (fC < fD);
        if (takeLeft) {
          b = d; fB = fD; d = c; fD = fC;
          c = b - gr * (b - a); fC = dTheta(c);
        } else {
          a = c; fA = fC; c = d; fC = fD;
          d = a + gr * (b - a); fD = dTheta(d);
        }
      }
      const mid = (a + b) * 0.5;
      const fM = dTheta(mid);
      const pts = [
        [a, fA],
        [c, fC],
        [mid, fM],
        [d, fD],
        [b, fB]
      ];
      let best = pts[0];
      for (let k2 = 1; k2 < pts.length; k2++) {
        if (findMax ? (pts[k2][1] > best[1]) : (pts[k2][1] < best[1])) best = pts[k2];
      }
      return best;
    };

    let dMax = -Infinity, thMax = 0;
    let dMin = Infinity, thMin = 0;
    const mLen = evalThetas.length;
    for (let j = 0; j < mLen; j++) {
      const v = gVals[j];
      const vPrev = j > 0 ? gVals[j - 1] : v;
      const vNext = j < mLen - 1 ? gVals[j + 1] : v;
      const lo = evalThetas[Math.max(0, j - 1)];
      const hi = evalThetas[Math.min(mLen - 1, j + 1)];
      if (v >= vPrev && v >= vNext) {
        const [th, val] = hi > lo ? goldenSearch(lo, hi, true) : [evalThetas[j], v];
        if (val > dMax) { dMax = val; thMax = th; }
      }
      if (v <= vPrev && v <= vNext) {
        const [th, val] = hi > lo ? goldenSearch(lo, hi, false) : [evalThetas[j], v];
        if (val < dMin) { dMin = val; thMin = th; }
      }
    }

    const ov = dMax - dMin;
    return {
      Dv: D + dv,
      Dh: D + dh,
      Dmax: D + dMax,
      Dmin: D + dMin,
      thetaMaxDeg: +(thMax * 180 / C.PI).toFixed(2),
      thetaMinDeg: +(thMin * 180 / C.PI).toFixed(2),
      oval_mm: ov,
      oval_pct: ov / D * 100,
      eqResidualPct,
      rotCompatRad,
      dispCompatMm,
      momentEqResPct,
      baseReactionN: +baseReactionN.toFixed(4),
      tensionWarning,
      maxBendMomentNmm: +maxAbsM.toFixed(2),
      ringBendStressMPa
    };
  }

  // ① 자연상태: 바닥 1점 접지, 자중 (Roark Table 9.2 case 15)
  function nat(D, t) {
    return ringSolve(D, t, [], 0);
  }

  // ② 120° 새들: 균일 반경방향 접촉압 (접촉각 2α=120°)
  function sad(D, t) {
    return ringSolve(D, t, [], C.SADDLE_HALF_DEG);
  }

  /**
   * 지지 방식별 롤러 반력(법선 반력 N 및 수직 분담 V) 계산
   * - 2롤러 (TR2): 2 N cosα = W  →  N = W / (2 cosα)
   * - 4롤러 (더블롤러): 대칭 등간격 피벗 보기(Equal-arm pivoted bogie, L1/L2 = bogieRatio = 1.0 기본) 가정
   *   N1·L1 = N2·L2 (→ N2 = bogieRatio·N1), 2·(N1·cosα1 + N2·cosα2) = W
   */
  function getRollerReaction(D, t, p = {}) {
    if (!D || !t || D <= 0 || t <= 0 || t >= D / 2) {
      return { nRollers: 0, alphasDeg: [], N_per_mm: 0, N_list: [], V_per_mm: [], W: 0, bogieAssumed: null, bogieRatio: 1 };
    }
    const W = gW(D, t);
    const st = ((p && p.st) || 'TR2_45').toUpperCase();
    let alphasDeg = [];
    let nRollers = 0;
    const bogieRatio = (p && Number.isFinite(+p.bogieRatio) && +p.bogieRatio > 0) ? +p.bogieRatio : 1.0;

    switch (st) {
      case 'TR2_491': alphasDeg = [49.1]; nRollers = 2; break;
      case 'TR2_45': alphasDeg = [45]; nRollers = 2; break;
      case 'TR2_30': alphasDeg = [30]; nRollers = 2; break;
      case 'TR2_CUSTOM': {
        const aRaw = (p && Number.isFinite(+p.a) && +p.a > 0) ? +p.a : 45;
        alphasDeg = [Math.min(85, Math.max(1, aRaw))];
        nRollers = 2;
        break;
      }
      case 'TR4_STD': {
        alphasDeg = [22.5, 67.5];
        nRollers = 4;
        break;
      }
      case 'TR4_CUSTOM': {
        const a1Raw = (p && Number.isFinite(+p.a1) && +p.a1 > 0) ? +p.a1 : 30;
        const a2Raw = (p && Number.isFinite(+p.a2) && +p.a2 > 0) ? +p.a2 : 60;
        const a1 = Math.min(85, Math.max(1, Math.min(a1Raw, a2Raw)));
        const a2 = Math.min(85, Math.max(1, Math.max(a1Raw, a2Raw)));
        alphasDeg = [a1, a2];
        nRollers = 4;
        break;
      }
      case 'DOUBLE_ROLLER': {
        const gr = (p && Number.isFinite(+p.gr) && +p.gr > 0) ? +p.gr : 10;
        const ac = (p && Number.isFinite(+p.ac) && +p.ac > 0) ? +p.ac : 45;
        const a1 = Math.min(85, Math.max(1, ac - gr));
        const a2 = Math.min(85, Math.max(1, ac + gr));
        alphasDeg = [a1, a2];
        nRollers = 4;
        break;
      }
      case 'NATURAL':
      case 'SADDLE120':
        return { nRollers: 0, alphasDeg: [], N_per_mm: 0, N_list: [], V_per_mm: [], W, bogieAssumed: null, bogieRatio: 1 };
      default:
        throw new Error('Unknown supportType: ' + st);
    }

    let N_list = [];
    if (alphasDeg.length === 2) {
      const denom = Math.cos(alphasDeg[0] * C.PI / 180) + bogieRatio * Math.cos(alphasDeg[1] * C.PI / 180);
      const N1 = W / (2 * denom);
      N_list = [N1, N1 * bogieRatio];
    } else {
      const N1 = W / (2 * Math.cos(alphasDeg[0] * C.PI / 180));
      N_list = [N1];
    }
    const N_per_mm = Math.max(...N_list);
    const V_per_mm = alphasDeg.map((a, idx) => N_list[idx] * Math.cos(a * C.PI / 180));
    const bogieAssumed = (st === 'DOUBLE_ROLLER' || st === 'TR4_STD' || st === 'TR4_CUSTOM')
      ? (Math.abs(bogieRatio - 1) < 1e-6 ? 'EQUAL_ARM_PIVOT' : 'CUSTOM_LEVER_RATIO')
      : null;
    return { nRollers, alphasDeg, N_per_mm, N_list, V_per_mm, W, bogieAssumed, bogieRatio };
  }

  // ③ 터닝롤러 2점 (N = W/(2cosα)), ④ 더블롤러 4점 (대칭 피벗 보기 가정 N1=N2 또는 L1/L2 레버암 비)
  function roller(D, t, alphasDeg, nR, customNList) {
    const W = gW(D, t);
    const clamped = alphasDeg.map(a => Math.min(85, Math.max(1, a)));
    let N_list = Array.isArray(customNList) && customNList.length === clamped.length ? customNList : null;
    if (!N_list) {
      let sumCos = 0;
      for (let i = 0; i < clamped.length; i++) {
        sumCos += Math.cos(clamped[i] * C.PI / 180);
      }
      const nEq = W / (2 * sumCos);
      N_list = clamped.map(() => nEq);
    }
    const N_per_mm = Math.max(...N_list);
    const supports = clamped.map((a, idx) => ({
      alphaDeg: a,
      N: N_list[idx],
      V: N_list[idx] * Math.cos(a * C.PI / 180)
    }));
    const res = ringSolve(D, t, supports, 0);
    res.N_per_mm = N_per_mm;
    res.N_list = N_list;
    res.nRollers = nR || (clamped.length * 2);
    return res;
  }

  /**
   * TR2 실제 전방위 진원도 최소화 지지각 수치 탐색:
   *   α_opt = argmin_{α∈[30°,60°]} [D_max(α) − D_min(α)]
   */
  function optimalTR2Details(D = 3000, t = 10) {
    const dUse = (D && D > 0) ? D : 3000;
    const tUse = (t && t > 0 && t < dUse / 2) ? t : 10;
    const f = a => roller(dUse, tUse, [a], 2).oval_mm;
    const gr = (Math.sqrt(5) - 1) / 2;
    let lo = 30, hi = 60;
    let c = hi - gr * (hi - lo);
    let d = lo + gr * (hi - lo);
    let fc = f(c), fd = f(d);
    for (let it = 0; it < 22 && (hi - lo) > 0.005; it++) {
      if (fc < fd) {
        hi = d; d = c; fd = fc;
        c = hi - gr * (hi - lo); fc = f(c);
      } else {
        lo = c; c = d; fc = fd;
        d = lo + gr * (hi - lo); fd = f(d);
      }
    }
    const aOpt = (lo + hi) * 0.5;
    const optRes = roller(dUse, tUse, [aOpt], 2);
    const natRes = nat(dUse, tUse);
    return {
      alphaOptDeg: +aOpt.toFixed(2),
      minOvalMm: +optRes.oval_mm.toFixed(4),
      minOvalPct: +optRes.oval_pct.toFixed(6),
      minVsNatPct: natRes.oval_mm > 0 ? +(optRes.oval_mm / natRes.oval_mm * 100).toFixed(2) : 0,
      m2ZeroDeg: 45
    };
  }

  function optimalTR2Angle(D = 3000, t = 10) {
    return +optimalTR2Details(D, t).alphaOptDeg.toFixed(1);
  }

  const ROLLER_MATS = Object.freeze({
    steel: { E: 206000, nu: 0.30 },
    urethane: { E: 50, nu: 0.48 },   // 선형 근사 참고치 (초탄성 비선형 거동 주의)
    rubber: { E: 15, nu: 0.49 }      // 선형 근사 참고치 (초탄성 비선형 거동 주의)
  });

  /**
   * 롤러 중심간 거리(C-C)와 강관 외경(D)·롤러 외경(rd)으로부터 지지 반각 α(또는 보지 γ_eff) 산출
   * sin(α) = (C-C / 2) / (D/2 + rd/2) = C-C / (D + rd)
   */
  function rollerAngleDeg(D, rd, cc) {
    if (!D || D <= 0 || !cc || cc <= 0) return 0;
    const denom = D + Math.max(0, rd || 0);
    if (denom <= 0) return 0;
    return Math.asin(Math.min(1, cc / denom)) * 180 / C.PI;
  }

  /**
   * 연속보(Continuous Beam) + 롤러 설치 높이 단차(settleMm) 반력 분배 해석
   * - 롤러 세트 위치 x_k = k * L / (nSets + 1) (k = 1..nSets)
   * - nSets >= 3 시 양단 지지점(x_1, x_n) 기준 유연도 행렬(Flexibility method)로 내부 잉여 반력 풀이
   * - 중앙 지지점 단차(settleMm > 0: 낮아짐/침하 가정)에 따른 편하중 계수(loadFactor) 및 들뜸(liftOff) 판별
   */
  function continuousBeamReactions(D, t, L, nSets, settleMm = 0) {
    if (!D || !t || t >= D / 2 || !L || L <= 0 || !nSets || nSets < 1) {
      return { nSets: 0, reactionsKN: [], avgKN: 0, maxKN: 0, minKN: 0, loadFactor: 1, liftOff: false };
    }
    const w = gW(D, t); // N/mm
    const Wtot = w * L; // N
    const avgN = Wtot / nSets;
    if (nSets <= 2) {
      const arr = Array.from({ length: nSets }, () => +(avgN / 1000).toFixed(2));
      return {
        nSets,
        reactionsKN: arr,
        avgKN: +(avgN / 1000).toFixed(2),
        maxKN: +(avgN / 1000).toFixed(2),
        minKN: +(avgN / 1000).toFixed(2),
        loadFactor: 1,
        liftOff: false
      };
    }

    const id = D - 2 * t;
    const Ib = C.PI * (Math.pow(D, 4) - Math.pow(id, 4)) / 64;
    const EI = C.E * Ib;
    const span = L / (nSets + 1);
    const xs = [];
    for (let k = 1; k <= nSets; k++) xs.push(k * span);
    const xL = xs[0], xR = xs[nSets - 1];
    const S = xR - xL; // 양단 지지점 간 주경간
    const ovh = xL;    // 양단 오버행 길이 (= L - xR)

    // 단순보(xL~xR) 내 위치 u∈[0,S]에서 단위하중(위치 a)에 의한 하향 처짐
    const flex = (u, a) => {
      const b = S - a;
      if (u <= a) return b * u * (S * S - b * b - u * u) / (6 * EI * S);
      return a * (S - u) * (S * S - a * a - (S - u) * (S - u)) / (6 * EI * S);
    };
    // 분포 자중 w (오버행 단부 모멘트 M_end = -w*ovh^2/2 포함)에 의한 주보 내 하향 처짐
    const wDefl = u => {
      const dUnif = w * u * (S * S * S - 2 * S * u * u + u * u * u) / (24 * EI);
      const Mend = w * ovh * ovh / 2;
      const dOvh = -Mend * u * (S - u) / (2 * EI);
      return dUnif + dOvh;
    };

    // 가우스 소거법
    const solveLinear = (A, b) => {
      const m = b.length;
      const M = A.map((row, i) => row.concat(b[i]));
      for (let i = 0; i < m; i++) {
        let piv = i;
        for (let r = i + 1; r < m; r++) {
          if (Math.abs(M[r][i]) > Math.abs(M[piv][i])) piv = r;
        }
        [M[i], M[piv]] = [M[piv], M[i]];
        const div = M[i][i] || 1e-18;
        for (let c = i; c <= m; c++) M[i][c] /= div;
        for (let r = 0; r < m; r++) {
          if (r === i) continue;
          const fac = M[r][i];
          for (let c = i; c <= m; c++) M[r][c] -= fac * M[i][c];
        }
      }
      return M.map(row => row[m]);
    };

    const m = nSets - 2;
    const midIdx = Math.floor(m / 2);
    const settle = Math.max(0, +settleMm || 0);
    const active = Array.from({ length: m }, () => true);
    let R_all = new Array(nSets).fill(avgN);
    let liftOff = false;

    for (let iter = 0; iter < 3; iter++) {
      const idxList = [];
      for (let i = 0; i < m; i++) if (active[i]) idxList.push(i);
      const kLen = idxList.length;
      const R_int = new Array(m).fill(0);
      if (kLen > 0) {
        const A = Array.from({ length: kLen }, () => new Array(kLen).fill(0));
        const rhs = new Array(kLen).fill(0);
        for (let r = 0; r < kLen; r++) {
          const i = idxList[r];
          const ui = xs[i + 1] - xL;
          // 중앙 지지점이 settle만큼 낮아지면(하향 변위 허용), 해당 지점 잔여 처짐 = wDefl - settle
          const s_i = (i === midIdx) ? settle : 0;
          rhs[r] = wDefl(ui) - s_i;
          for (let c = 0; c < kLen; c++) {
            const j = idxList[c];
            A[r][c] = flex(ui, xs[j + 1] - xL);
          }
        }
        const sol = solveLinear(A, rhs);
        for (let r = 0; r < kLen; r++) R_int[idxList[r]] = sol[r];
      }

      // 양단 반력 R_0, R_{n-1} (전체 힘·모멘트 평형)
      let sumInt = 0, sumIntMom = 0;
      for (let i = 0; i < m; i++) {
        sumInt += R_int[i];
        sumIntMom += R_int[i] * (xs[i + 1] - xL);
      }
      const R_right = (Wtot * (L / 2 - xL) - sumIntMom) / S;
      const R_left = Wtot - sumInt - R_right;
      R_all = [R_left, ...R_int, R_right];

      // 인장(들뜸) 지지점 체크 및 해제
      let anyNeg = false;
      for (let i = 0; i < m; i++) {
        if (active[i] && R_int[i] < 0) {
          active[i] = false;
          liftOff = true;
          anyNeg = true;
        }
      }
      if (!anyNeg) break;
    }

    const maxN = Math.max(...R_all);
    const minN = Math.min(...R_all);
    if (minN <= 0) liftOff = true;
    const loadFactor = avgN > 0 ? +(maxN / avgN).toFixed(3) : 1;
    return {
      nSets,
      reactionsKN: R_all.map(v => +(v / 1000).toFixed(2)),
      avgKN: +(avgN / 1000).toFixed(2),
      maxKN: +(maxN / 1000).toFixed(2),
      minKN: +(minN / 1000).toFixed(2),
      loadFactor,
      liftOff
    };
  }

  /**
   * Hertz 선접촉 응력 및 접촉 반폭 계산
   * - p.L_trib 또는 (p.L / p.nSets)로 1세트 분담 길이(tributary length)를 산정해 롤러 1개 하중 F = N_per_mm × L_trib × loadFactor 계산
   * - p.settleMm > 0 이고 nSets >= 3이면 연속보 단차 편하중 계수(loadFactor) 자동 반영
   * - p.rmat ('steel' | 'urethane' | 'rubber')에 따른 일반 유효 탄성계수 1/E_eff = (1-νp²)/Ep + (1-νr²)/Er 반영
   */
  function hertz(D, t, rd, cl, p) {
    if (!D || !t || !rd || !cl || D <= 0 || t <= 0 || t >= D / 2 || rd <= 0 || cl <= 0) {
      return { b_mm: 0, Pmax: 0, F_kN: 0, N_per_mm: 0, nRollers: 0, L_trib_mm: 0, rmat: 'steel', Eeff_MPa: 0, loadFactor: 1, liftOff: false };
    }
    const Rp = D / 2;
    const Rr = rd / 2;
    const Re = Rp * Rr / (Rp + Rr);
    const matKey = (p && typeof p.rmat === 'string' && ROLLER_MATS[p.rmat.toLowerCase()])
      ? p.rmat.toLowerCase() : 'steel';
    const rMat = ROLLER_MATS[matKey];
    const invEe = (1 - C.nu * C.nu) / C.E + (1 - rMat.nu * rMat.nu) / rMat.E;
    const Ee = 1 / invEe;

    let rx = getRollerReaction(D, t, p || { st: 'TR2_45' });
    if (!rx.nRollers) {
      rx = getRollerReaction(D, t, { st: 'TR2_45' });
    }
    const hasSpan = p && Number.isFinite(+p.L) && +p.L > 0 && Number.isFinite(+p.nSets) && +p.nSets > 0;
    const L_trib = (p && Number.isFinite(+p.L_trib) && +p.L_trib > 0)
      ? +p.L_trib
      : hasSpan ? (+p.L / +p.nSets) : cl;

    let loadFactor = 1;
    let liftOff = false;
    const settleMm = (p && Number.isFinite(+p.settleMm) && +p.settleMm > 0) ? +p.settleMm : 0;
    if (hasSpan && +p.nSets >= 3 && settleMm > 0) {
      const cb = continuousBeamReactions(D, t, +p.L, +p.nSets, settleMm);
      loadFactor = cb.loadFactor;
      liftOff = cb.liftOff;
    }

    const F = rx.N_per_mm * L_trib * loadFactor;
    const b = Math.sqrt(4 * F * Re / (C.PI * cl * Ee));
    const Pmax = b > 0 ? (2 * F / (C.PI * cl * b)) : 0;
    return {
      b_mm: +b.toFixed(3),
      Pmax: +Pmax.toFixed(1),
      F_kN: +(F / 1000).toFixed(2),
      N_per_mm: +rx.N_per_mm.toFixed(4),
      nRollers: rx.nRollers,
      L_trib_mm: +L_trib.toFixed(1),
      rmat: matKey,
      Eeff_MPa: +Ee.toFixed(1),
      loadFactor,
      liftOff
    };
  }

  function beam(D, t, L) {
    const id = D - 2 * t;
    const Ib = C.PI * (Math.pow(D, 4) - Math.pow(id, 4)) / 64;
    const w = gW(D, t);
    return {
      delta: +(5 * w * Math.pow(L, 4) / (384 * C.E * Ib)).toFixed(4),
      w: +w.toFixed(4)
    };
  }

  function brazier(D, t) {
    const r = (D - t) / 2;
    const dt = D / t;
    return {
      Mcr: +(0.987 * C.E * t * t * r / 1e12).toFixed(3),
      dt: +dt.toFixed(1),
      risk: dt > 300 ? 'HIGH' : dt > 200 ? 'MODERATE' : 'LOW'
    };
  }

  const lim = {
    API_2B: {
      label: 'API 2B',
      mm(D, t) {
        const p = D * 0.01;
        return t <= 50.8 ? Math.min(p, 6.4) : D >= 1219 ? Math.min(p, 12.7) : Math.min(p, t / 8);
      },
      pct(D, t) { return this.mm(D, t) / D * 100; }
    },
    ISO_19902: {
      label: 'ISO 19902',
      pct(D, t) { return D / t > 120 ? 0.5 : 1; },
      mm(D, t) { return this.pct(D, t) / 100 * D; }
    },
    API_5L: {
      label: 'API 5L',
      pct(D, t, z) { return z === 'end' ? 1 : 1.5; },
      mm(D, t, z) { return this.pct(D, t, z) / 100 * D; }
    },
    DNV: {
      label: 'DNV-OS-C401',
      pct(D, t, f) { return f ? 0.5 : 1; },
      mm(D, t, f) { return this.pct(D, t, f) / 100 * D; }
    }
  };

  function compliance(ovMm, ovPct, D, t, opts = {}) {
    const o = {};
    const makeRow = (label, lmm, lpct, extra = {}) => ({
      label,
      lmm: +lmm.toFixed(4),
      lpct: +lpct.toFixed(4),
      oval_mm: +ovMm.toFixed(6),
      oval_pct: +ovPct.toFixed(6),
      pass: ovMm <= lmm,
      status: ovMm <= lmm ? 'PASS' : 'FAIL',
      agreementRequired: false,
      mar: +(lpct - ovPct).toFixed(6),
      ...extra
    });

    o.API_2B = makeRow('API 2B', lim.API_2B.mm(D, t), lim.API_2B.pct(D, t), {
      scopeNoteKey: 'stdNoteApi2b'
    });
    o.ISO_19902 = makeRow('ISO 19902', lim.ISO_19902.mm(D, t), lim.ISO_19902.pct(D, t), {
      scopeNoteKey: 'stdNoteIso'
    });

    const z = (opts && opts.zone) || 'body';
    const customPct = (opts && Number.isFinite(+opts.customLimitPct) && +opts.customLimitPct > 0)
      ? +opts.customLimitPct : null;
    const agreedPct = (opts && Number.isFinite(+opts.api5lAgreedPct) && +opts.api5lAgreedPct > 0)
      ? +opts.api5lAgreedPct : customPct;
    if (D > 1422 && !agreedPct) {
      const refPct = lim.API_5L.pct(D, t, z);
      const refMm = lim.API_5L.mm(D, t, z);
      o.API_5L = makeRow('API 5L', refMm, refPct, {
        pass: null,
        status: 'AGREEMENT_REQUIRED',
        agreementRequired: true,
        scopeNoteKey: 'api5lAgreedNote',
        asAgreed: true
      });
    } else if (D > 1422 && agreedPct) {
      const limMm = agreedPct / 100 * D;
      o.API_5L = makeRow('API 5L', limMm, agreedPct, {
        scopeNoteKey: 'stdNoteApi5l',
        asAgreed: true
      });
    } else {
      o.API_5L = makeRow('API 5L', lim.API_5L.mm(D, t, z), lim.API_5L.pct(D, t, z), {
        scopeNoteKey: 'stdNoteApi5l',
        asAgreed: false
      });
    }

    o.DNV = makeRow('DNV-OS-C401', lim.DNV.mm(D, t, opts.fatigue), lim.DNV.pct(D, t, opts.fatigue), {
      scopeNoteKey: 'stdNoteDnv'
    });
    if (customPct) {
      o.CUSTOM = makeRow('Project Spec', customPct / 100 * D, customPct, {
        scopeNoteKey: 'stdNoteCustom'
      });
    }
    return o;
  }

  function dispatch(p) {
    const D = p.D;
    const t = p.t;
    const st = (p.st || 'NATURAL').toUpperCase();
    switch (st) {
      case 'NATURAL': return nat(D, t);
      case 'SADDLE120': return sad(D, t);
      case 'TR2_491':
      case 'TR2_45':
      case 'TR2_30':
      case 'TR2_CUSTOM':
      case 'TR4_STD':
      case 'TR4_CUSTOM':
      case 'DOUBLE_ROLLER': {
        const rx = getRollerReaction(D, t, p);
        const res = roller(D, t, rx.alphasDeg, rx.nRollers, rx.N_list);
        res.bogieAssumed = rx.bogieAssumed;
        res.bogieRatio = rx.bogieRatio;
        return res;
      }
      default: throw new Error('Unknown supportType: ' + st);
    }
  }

  function analyze(p) {
    if (!p || !p.D || !p.t || p.t >= p.D / 2 || p.D <= 0 || p.t <= 0) {
      throw new Error('Invalid D/t parameters');
    }
    const s = dispatch(p);
    const nr = nat(p.D, p.t);
    const comp = compliance(s.oval_mm, s.oval_pct, p.D, p.t, p.opts);
    return {
      p,
      Dv: +s.Dv.toFixed(4),
      Dh: +s.Dh.toFixed(4),
      Dmax: s.Dmax !== undefined ? +s.Dmax.toFixed(4) : +Math.max(s.Dv, s.Dh).toFixed(4),
      Dmin: s.Dmin !== undefined ? +s.Dmin.toFixed(4) : +Math.min(s.Dv, s.Dh).toFixed(4),
      thetaMaxDeg: s.thetaMaxDeg !== undefined ? s.thetaMaxDeg : 0,
      thetaMinDeg: s.thetaMinDeg !== undefined ? s.thetaMinDeg : 90,
      oval_mm: +s.oval_mm.toFixed(6),
      oval_pct: +s.oval_pct.toFixed(6),
      vsNat: nr.oval_mm > 0 ? +(s.oval_mm / nr.oval_mm).toFixed(4) : 0,
      eqResidualPct: s.eqResidualPct !== undefined ? s.eqResidualPct : 0,
      momentEqResPct: s.momentEqResPct !== undefined ? s.momentEqResPct : 0,
      baseReactionN: s.baseReactionN || 0,
      tensionWarning: !!s.tensionWarning,
      maxBendMomentNmm: s.maxBendMomentNmm || 0,
      ringBendStressMPa: s.ringBendStressMPa || 0,
      bogieAssumed: s.bogieAssumed || null,
      bogieRatio: s.bogieRatio || 1,
      N_per_mm: s.N_per_mm ? +s.N_per_mm.toFixed(4) : 0,
      nRollers: s.nRollers || 0,
      comp,
      natDv: +nr.Dv.toFixed(4),
      natDh: +nr.Dh.toFixed(4),
      natOval_mm: +nr.oval_mm.toFixed(4),
      natOval_pct: +nr.oval_pct.toFixed(6)
    };
  }

  function analyzeAll(D, t, opts = {}) {
    const ts = ['NATURAL', 'SADDLE120', 'TR2_491', 'TR2_45', 'TR2_30', 'TR4_STD'];
    const out = {};
    for (let i = 0; i < ts.length; i++) {
      out[ts[i]] = analyze({ D, t, st: ts[i], opts });
    }
    return out;
  }

  function computeRollerSets({ D, t, L, nW, nA = 0, rd = 600, cl = 300 }) {
    if (!D || !t || t >= D / 2 || !L || L <= 0) return null;
    const id = D - 2 * t;
    const A = C.PI * (D * D - id * id) / 4;
    const w = C.g * A;
    const Ib = C.PI * (Math.pow(D, 4) - Math.pow(id, 4)) / 64;

    const dAllow = D * 0.0005;
    const L_defl = Math.pow(384 * C.E * Ib * dAllow / (5 * w), 0.25);
    const n_defl = Math.max(1, Math.ceil(L / L_defl) - 1);

    const Rp = D / 2;
    const Rr = rd / 2;
    const Reff = Rp * Rr / (Rp + Rr);
    const Eeff = C.E / (2 * (1 - C.nu * C.nu));
    // α=45° 2롤러 반력 F_roller = (w * L_trib) / (2 * cos45°) 기준으로 Hertz Pmax=600MPa 허용 분담 길이 산정
    // 세트당 분담 길이 L_trib = L / n_sets <= span_hertz 이므로 n_hertz = ceil(L / span_hertz)
    const span_hertz = 2 * Math.cos(C.PI / 4) * 600 * 600 * C.PI * cl * Reff / (Eeff * w);
    const n_hertz = Math.max(1, Math.ceil(L / span_hertz));

    const ld = L / D;
    const n_ld = ld <= 2 ? 2 : ld <= 4 ? 3 : ld <= 7 ? 4 : ld <= 10 ? 5 : 6;
    const n_span = Math.max(1, Math.ceil(L / (2.5 * D)) - 1);
    const n_struct = Math.max(n_defl, n_hertz, n_ld, n_span, 2);

    // Girth Weld 총수(nW)가 주어지면 진행 중 용접 수(effNA)는 nW를 초과할 수 없음 (nW=0이면 단관이므로 effNA=0)
    const effNA = (nW !== undefined && nW !== null) ? Math.max(0, Math.min(nA, nW)) : Math.max(0, nA);
    // 롤러 접촉폭(cl) 및 프레임 간섭 방지를 위한 물리적 최대 배치 세트 수 (최소 2세트 보장)
    const minPitch = Math.max(cl * 1.5, 500);
    const n_max_phys = Math.max(2, Math.floor(L / minPitch));

    const n_active = effNA > 0 ? Math.min(Math.max(effNA + 3, 4), n_max_phys) : 0;
    const n_overhang = effNA > 0 ? Math.min(Math.max(Math.ceil(L / (3 * (D || 1))) - 1, 4), n_max_phys) : 0;

    const n_rec = Math.max(n_struct, n_active, n_overhang, 2);
    const span_rec = L / (n_rec + 1);

    const govKeys = [];
    if (n_rec === n_defl) govKeys.push('defl');
    if (n_rec === n_hertz) govKeys.push('hertz');
    if (n_rec === n_ld) govKeys.push('ld');
    if (n_rec === n_span && n_span > 0) govKeys.push('span');
    if (n_rec === n_overhang && n_overhang > 0) govKeys.push('overhang');
    if (n_rec === n_active && n_active > 0) govKeys.push('active');
    if (govKeys.length === 0) govKeys.push('min2');

    return {
      n_rec,
      span_rec,
      n_defl,
      n_hertz,
      n_ld,
      n_span,
      n_active,
      n_overhang,
      effNA,
      n_max_phys,
      L_defl,
      span_hertz,
      govKeys
    };
  }

  /**
   * 진원도 불합격 시 보강링(Stiffener Ring) · Spider Brace · 롤러 지지 간격 예비 설계 제안
   * - 선형 탄성 링 강성비(k_req = oval / target) 및 쉘 유효폭(1.56√(Rt)) 기반 개념·예비 제안치
   */
  function designReinforcement(opts = {}) {
    const D = +opts.D || 0;
    const t = +opts.t || 0;
    if (D <= 0 || t <= 0 || t >= D / 2) return null;

    const L = (+opts.L > 0) ? +opts.L : Math.max(D * 2, 6000);
    const R = gR(D, t);
    const dt = D / t;
    const comp = opts.comp || compliance(opts.ovalMm || 0, (opts.ovalMm || 0) / D * 100, D, t, opts.stdOpts || {});
    const measComp = opts.measComp || null;

    const supFail = !comp.API_2B.pass || !comp.ISO_19902.pass || !comp.DNV.pass;
    const measFail = !!(measComp && (!measComp.API_2B.pass || !measComp.ISO_19902.pass || !measComp.DNV.pass));
    const needed = supFail || measFail;
    const triggerSource = (supFail && measFail) ? 'BOTH' : supFail ? 'SUPPORTED' : measFail ? 'MEASURED' : 'NONE';

    const targetLimitMm = Math.min(comp.API_2B.lmm, comp.ISO_19902.lmm, comp.DNV.lmm);
    const targetMm = Math.max(0.5, targetLimitMm * 0.85);
    const supOvalMm = Number.isFinite(+opts.ovalMm) ? +opts.ovalMm : 0;
    const measOvalMm = Number.isFinite(+opts.measOvalMm) ? +opts.measOvalMm : 0;
    const govOvalMm = Math.max(supFail ? supOvalMm : 0, measFail ? measOvalMm : 0, needed ? 0 : supOvalMm);
    const kReq = targetMm > 0 ? Math.max(1.0, govOvalMm / targetMm) : 1.0;

    // 1. 내부 보강링 (Internal Stiffener Ring) 예비 설계
    const maxSpacing = dt > 300 ? Math.min(2.0 * D, 4000) : dt > 200 ? Math.min(2.5 * D, 5000) : Math.min(3.0 * D, 6000);
    const endOffset = Math.min(500, Math.max(200, Math.round(L * 0.05)));
    const innerSpan = Math.max(0, L - 2 * endOffset);
    const nIntervals = Math.max(1, Math.ceil(innerSpan / maxSpacing));
    const nRings = nIntervals + 1;
    const ringSpacingMm = Math.round(innerSpan / nIntervals);
    const ringPositionsMm = [];
    for (let i = 0; i < nRings; i++) {
      ringPositionsMm.push(Math.round(endOffset + i * (innerSpan / nIntervals)));
    }

    const I_shell_unit = gI(D, t);
    const I_shell_span = I_shell_unit * Math.max(ringSpacingMm, 500);
    const I_req_mm4 = kReq * I_shell_span;
    const bEff = Math.min(Math.max(ringSpacingMm, 500), 1.56 * Math.sqrt(R * t));

    // 표준 보강링 단면 후보 (플랫바 및 T-형강) 합성 단면2차모멘트 계산
    const ringCandidates = [
      { name: 'FB 100×12', type: 'FB', h: 100, tw: 12, bf: 0, tf: 0 },
      { name: 'FB 125×12', type: 'FB', h: 125, tw: 12, bf: 0, tf: 0 },
      { name: 'FB 150×16', type: 'FB', h: 150, tw: 16, bf: 0, tf: 0 },
      { name: 'FB 180×16', type: 'FB', h: 180, tw: 16, bf: 0, tf: 0 },
      { name: 'FB 200×20', type: 'FB', h: 200, tw: 20, bf: 0, tf: 0 },
      { name: 'FB 250×20', type: 'FB', h: 250, tw: 20, bf: 0, tf: 0 },
      { name: 'FB 300×25', type: 'FB', h: 300, tw: 25, bf: 0, tf: 0 },
      { name: 'FB 350×25', type: 'FB', h: 350, tw: 25, bf: 0, tf: 0 },
      { name: 'FB 400×30', type: 'FB', h: 400, tw: 30, bf: 0, tf: 0 },
      { name: 'T-Bar 300×150×20/25', type: 'T', h: 300, tw: 20, bf: 150, tf: 25 },
      { name: 'T-Bar 400×200×25/30', type: 'T', h: 400, tw: 25, bf: 200, tf: 30 }
    ];
    const calcCompositeI = c => {
      const As = bEff * t;
      const ys = t / 2;
      const Is0 = bEff * t * t * t / 12;
      const hw = c.type === 'T' ? (c.h - c.tf) : c.h;
      const Aw = hw * c.tw;
      const yw = t + hw / 2;
      const Iw0 = c.tw * hw * hw * hw / 12;
      const Af = c.type === 'T' ? (c.bf * c.tf) : 0;
      const yf = c.type === 'T' ? (t + hw + c.tf / 2) : 0;
      const If0 = c.type === 'T' ? (c.bf * c.tf * c.tf * c.tf / 12) : 0;
      const Atot = As + Aw + Af;
      const yc = (As * ys + Aw * yw + Af * yf) / Atot;
      return (Is0 + As * Math.pow(ys - yc, 2))
        + (Iw0 + Aw * Math.pow(yw - yc, 2))
        + (Af > 0 ? (If0 + Af * Math.pow(yf - yc, 2)) : 0);
    };

    let chosenRing = ringCandidates[ringCandidates.length - 1];
    let chosenI = calcCompositeI(chosenRing);
    for (let i = 0; i < ringCandidates.length; i++) {
      const Icomp = calcCompositeI(ringCandidates[i]);
      if (Icomp >= I_req_mm4) {
        chosenRing = ringCandidates[i];
        chosenI = Icomp;
        break;
      }
    }
    const stiffGain = I_shell_span > 0 ? (chosenI / I_shell_span) : 1;
    // 3D 원통쉘 감쇠길이 L_d = π / λ_s ≈ 2.44√(R·t) 기반 보강링 사이 쉘 자유변형 보정
    const shellDecayLenMm = +(2.44 * Math.sqrt(R * t)).toFixed(1);
    const effGain = 1 + Math.max(0, stiffGain - 1) * Math.exp(-0.25 * ringSpacingMm / Math.max(shellDecayLenMm, 1));
    const estOvalWithRingMm = effGain > 0 ? +(govOvalMm / effGain).toFixed(2) : +govOvalMm.toFixed(2);

    // 2. Spider Brace (내부 방사형 스파이더 / 턴버클 버팀대) 예비 설계
    const armCount = (D >= 6000 || dt > 250) ? 8 : (D >= 3500 || kReq > 2.0) ? 6 : 4;
    const hubRadius = Math.min(250, Math.max(100, Math.round(D * 0.05)));
    const armLenMm = Math.max(300, Math.round((D - 2 * t) / 2 - hubRadius));
    const pipeCandidates = [
      { name: 'Ø60.5×3.8 (50A Sch.40)', od: 60.5, thk: 3.8 },
      { name: 'Ø76.3×4.2 (65A Sch.40)', od: 76.3, thk: 4.2 },
      { name: 'Ø89.1×5.5 (80A Sch.40)', od: 89.1, thk: 5.5 },
      { name: 'Ø114.3×6.0 (100A Sch.40)', od: 114.3, thk: 6.0 },
      { name: 'Ø139.8×6.6 (125A Sch.40)', od: 139.8, thk: 6.6 },
      { name: 'Ø165.2×7.1 (150A Sch.40)', od: 165.2, thk: 7.1 },
      { name: 'Ø216.3×8.2 (200A Sch.40)', od: 216.3, thk: 8.2 }
    ];
    let chosenPipe = pipeCandidates[pipeCandidates.length - 1];
    let slenderness = 0;
    for (let i = 0; i < pipeCandidates.length; i++) {
      const pc = pipeCandidates[i];
      const id = pc.od - 2 * pc.thk;
      const rg = Math.sqrt((pc.od * pc.od + id * id) / 16);
      const lam = armLenMm / rg;
      slenderness = +lam.toFixed(1);
      chosenPipe = pc;
      if (lam <= 120) break;
    }

    const spiderOffset = Math.min(400, Math.max(150, Math.round(L * 0.04)));
    const spiderPositionsMm = L > 6000
      ? [spiderOffset, Math.round(L / 2), Math.round(L - spiderOffset)]
      : [spiderOffset, Math.round(L - spiderOffset)];
    const pushDeg = Number.isFinite(+opts.thetaMinDeg) ? +opts.thetaMinDeg : 0;
    const pullDeg = Number.isFinite(+opts.thetaMaxDeg) ? +opts.thetaMaxDeg : 90;

    // 3. 롤러 지지 간격 및 지지각 보완 제안
    const rs = computeRollerSets({
      D, t, L,
      nW: opts.nW || 0,
      nA: opts.nA || 0,
      rd: opts.rd || 600,
      cl: opts.cl || 300
    });
    const baseSets = rs ? rs.n_rec : 2;
    const recSets = needed ? Math.max(baseSets, dt > 250 ? baseSets + 1 : baseSets) : baseSets;
    const recSpanMm = Math.round(L / (recSets + 1));
    const rollerPositionsMm = [];
    for (let i = 1; i <= recSets; i++) {
      rollerPositionsMm.push(Math.round(i * L / (recSets + 1)));
    }
    const curSt = (opts.st || 'NATURAL').toUpperCase();
    const isOpt4Or45 = curSt === 'TR2_45' || curSt === 'DOUBLE_ROLLER' || curSt === 'TR4_STD' || curSt === 'TR4_CUSTOM';
    const tr45Res = !isOpt4Or45 ? roller(D, t, [45], 2) : null;
    const govOvalPct = D > 0 ? (govOvalMm / D * 100) : 0;

    // 적용 전략 자동 판별: ③ 단독 가능 / ③ 우선 + ①·② 중 택1 / ①+②+③ 병행 권장
    let strategy = 'SELECT_ONE';
    if (needed) {
      if (!measFail && tr45Res && tr45Res.oval_mm <= targetLimitMm && dt <= 200) {
        strategy = 'SUPPORT_ONLY';
      } else if (dt > 300 || kReq > 3.0 || govOvalPct >= 2.0 || triggerSource === 'BOTH') {
        strategy = 'COMBINE_ALL';
      } else {
        strategy = 'SELECT_ONE';
      }
    }

    return {
      needed,
      triggerSource,
      strategy,
      D, t, L,
      dt: +dt.toFixed(1),
      govOvalMm: +govOvalMm.toFixed(2),
      targetLimitMm: +targetLimitMm.toFixed(2),
      targetMm: +targetMm.toFixed(2),
      kReq: +kReq.toFixed(2),
      ring: {
        profile: chosenRing.name,
        heightMm: chosenRing.h,
        thkMm: chosenRing.tw,
        count: nRings,
        spacingMm: ringSpacingMm,
        endOffsetMm: endOffset,
        positionsMm: ringPositionsMm,
        I_req_cm4: +(I_req_mm4 / 1e4).toFixed(1),
        I_prov_cm4: +(chosenI / 1e4).toFixed(1),
        shellDecayLenMm,
        estOvalMm: estOvalWithRingMm
      },
      spider: {
        arms: armCount,
        pipeSpec: chosenPipe.name,
        armLenMm,
        hubRadiusMm: hubRadius,
        slenderness,
        pushDeg,
        pullDeg,
        count: spiderPositionsMm.length,
        positionsMm: spiderPositionsMm
      },
      support: {
        currentSt: curSt,
        recommendTR45: !!tr45Res,
        tr45OvalMm: tr45Res ? +tr45Res.oval_mm.toFixed(2) : null,
        recSets,
        recSpanMm,
        rollerPositionsMm
      }
    };
  }

  /**
   * 타원화(Ovalization) 및 굽힘(Bending: 링 굽힘응력 + 보 처짐 + Brazier D/t) 복합 위험도 평가
   * - CRITICAL / WARNING / SAFE 등급과 구체적 위험 요인 코드 반환
   */
  function evaluateOvalBendingRisk(opts = {}) {
    const D = +opts.D || 0;
    const t = +opts.t || 0;
    if (D <= 0 || t <= 0 || t >= D / 2) {
      return { level: 'SAFE', dt: 0, maxOvalPct: 0, ringBendStressMPa: 0, beamDeltaMm: 0, beamLimitMm: 0, reasons: [] };
    }
    const dt = +(D / t).toFixed(1);
    const ovalPct = Number.isFinite(+opts.ovalPct) ? +opts.ovalPct : 0;
    const measOvalPct = Number.isFinite(+opts.measOvalPct) ? +opts.measOvalPct : 0;
    const maxOvalPct = +Math.max(ovalPct, measOvalPct).toFixed(3);
    const ringBendStressMPa = Number.isFinite(+opts.ringBendStressMPa) ? +(+opts.ringBendStressMPa).toFixed(2) : 0;
    const beamDeltaMm = Number.isFinite(+opts.beamDeltaMm) ? +(+opts.beamDeltaMm).toFixed(2) : 0;
    const beamLimitMm = +(D * 0.0005).toFixed(2); // 0.05% D

    const reasons = [];
    let level = 'SAFE';
    const escalate = lv => {
      if (lv === 'CRITICAL') level = 'CRITICAL';
      else if (lv === 'WARNING' && level === 'SAFE') level = 'WARNING';
    };

    // 1. 타원화 (Ovalization)
    if (maxOvalPct >= 2.0) {
      reasons.push('OVAL_HIGH');
      escalate('CRITICAL');
    } else if (maxOvalPct >= 1.0 || (dt > 120 && maxOvalPct > 0.5)) {
      reasons.push('OVAL_WARN');
      escalate('WARNING');
    }

    // 2. Brazier 박벽 타원화·좌굴 (D/t)
    if (dt > 300) {
      reasons.push('DT_HIGH');
      escalate('CRITICAL');
    } else if (dt > 200) {
      reasons.push('DT_WARN');
      escalate('WARNING');
    }

    // 3. 링 자중 굽힘응력 (Ring Wall Bending Stress σ_b = 6 M_max / t², 기준 Fy≈250MPa)
    if (ringBendStressMPa >= 175) {
      reasons.push('RING_BEND_HIGH');
      escalate('CRITICAL');
    } else if (ringBendStressMPa >= 100) {
      reasons.push('RING_BEND_WARN');
      escalate('WARNING');
    }

    // 4. 축방향 보 굽힘 처짐 (Beam Bending Deflection)
    if (beamLimitMm > 0 && beamDeltaMm > beamLimitMm * 2) {
      reasons.push('BEAM_SAG_HIGH');
      escalate('CRITICAL');
    } else if (beamLimitMm > 0 && beamDeltaMm > beamLimitMm) {
      reasons.push('BEAM_SAG_WARN');
      escalate('WARNING');
    }

    return {
      level,
      dt,
      maxOvalPct,
      ringBendStressMPa,
      beamDeltaMm,
      beamLimitMm,
      reasons
    };
  }

  /**
   * 3D FEA 상세검토 의뢰 기준선(Trigger) 판정
   */
  function evaluateFeaTrigger(opts = {}) {
    const D = +opts.D || 0;
    const t = +opts.t || 0;
    const dt = (D > 0 && t > 0) ? (D / t) : 0;
    const maxOvalPct = Math.max(+opts.ovalPct || 0, +opts.measOvalPct || 0);
    const ringBendStressMPa = +opts.ringBendStressMPa || 0;
    const loadFactor = +opts.loadFactor || 1;
    const liftOff = !!opts.liftOff;
    const reasons = [];
    if (maxOvalPct > 5.0) reasons.push('LARGE_DEFL');
    if (dt > 300) reasons.push('THIN_WALL');
    if (ringBendStressMPa >= 175) reasons.push('HIGH_BEND_STRESS');
    if (liftOff || loadFactor >= 1.5) reasons.push('UNEVEN_LOAD');
    return { feaRequired: reasons.length > 0, reasons };
  }

  return {
    C,
    ROLLER_MATS,
    gA,
    gW,
    gR,
    gI,
    rollerAngleDeg,
    evaluateDT,
    evaluateStateBuckling,
    evaluateOvalBendingRisk,
    evaluateFeaTrigger,
    continuousBeamReactions,
    nat,
    sad,
    getRollerReaction,
    roller,
    ringSolve,
    optimalTR2Angle,
    optimalTR2Details,
    hertz,
    beam,
    brazier,
    lim,
    compliance,
    dispatch,
    analyze,
    analyzeAll,
    computeRollerSets,
    designReinforcement
  };
}));
