/**
 * ═══════════════════════════════════════════════════════════════════
 *  VIGI-SKY SKYENGINE v1.2 — Moteur de planétarium 3D réutilisable
 * ═══════════════════════════════════════════════════════════════════
 *
 *  Moteur canvas 2D avec projection 3D perspective de la sphère céleste.
 *  Aucune dépendance. Données : window.SKY (sky-data.js : 5044 étoiles
 *  Yale BSC/Hipparcos, 89 constellations, 17 objets du ciel profond).
 *
 *  USAGE MINIMAL :
 *    <canvas id="sky"></canvas>
 *    <script src="/sky-engine/sky-data.js"></script>
 *    <script src="/sky-engine/sky-engine.js"></script>
 *    <script>
 *      const eng = new SkyEngine(document.getElementById('sky'), SKY);
 *      eng.start();
 *    </script>
 *
 *  API PUBLIQUE :
 *    eng.start() / eng.stop()              — boucle de rendu
 *    eng.flyTo(ra, dec, fov, ms) → Promise — vol caméra animé (easing)
 *    eng.set('constellations'|'labels'|'dsos'|'milkyway'|'meteors'|'planets', bool)
 *    eng.addMarker({ra, dec, label, color, size, pulse}) → id
 *    eng.clearMarkers()                    — pour overlays custom (OVNI, radiants…)
 *    eng.addLayer(name, fn(ctx, eng))      — couche de rendu custom par frame
 *    eng.removeLayer(name)
 *    eng.project(ra, dec) → {x, y, visible} — projection pour tes layers
 *    eng.pick(x, y) → {type:'star'|'dso'|'marker', ...} | null
 *    eng.tour(stops, {onStep, onEnd})      — visite guidée cinématique
 *      stops: [{ra, dec, fov, title, text, holdMs}]
 *    eng.stopTour()
 *    eng.onSelect = (obj) => {}            — callback clic objet
 *    eng.searchIndex() → [{name, ra, dec, type, fov}] — pour autocomplete
 *
 *  Réutilisable pour : overlay observations OVNI (addMarker), radiants de
 *  météores, position de l'étoile de naissance, trajectoires satellites
 *  (addLayer), mini-cartes embarquées (canvas de n'importe quelle taille).
 * ═══════════════════════════════════════════════════════════════════
 */
class SkyEngine {
  constructor(canvas, data, opts = {}) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.data = data;
    this.o = Object.assign({
      constellations: true, labels: true, dsos: true,
      milkyway: true, meteors: true, conLabels: true, planets: true, conNameKey: 'n',
      // Only draw the nearest constellation(s) to the view center (Stellarium-like declutter).
      nearConstellations: 1,
      bg: '#000000',
      nightVision: false,
      atmosphere: true,
      // Heavy equirect MW sampling is disabled on mobile; keep URL unused.
      milkywayUrl: null,
      // When true, skip opaque 2D atmosphere/MW — UniteSkyGL draws them behind.
      glBackdrop: false
    }, opts);
    this.focusTarget = null;
    this.viewLocked = false;
    this.cam = { yaw: 84, pitch: 10, fov: 70 };   // démarre sur Orion
    this.vel = { yaw: 0, pitch: 0 };
    // v1.3 — mode horizon (alt/az). 'equatorial' par défaut (compat v1.2).
    this.mode = 'equatorial';
    this.geo = { lat: 48.8566, lon: 2.3522 };     // Paris par défaut
    this.date = new Date();
    this.zenith = null;
    this.markers = [];
    this.layers = new Map();
    this.onSelect = null;
    this.onViewUnlock = null;
    this._flight = null;
    this._tour = null;
    this._meteors = [];
    this._running = false;
    this.skyState = { sunAlt: -90, starFade: 1, mwFade: 1, labelFade: 1, dayWash: 0, moonPhase: 0 };
    this._moonDiscCache = { phaseKey: -1, canvas: null };
    this._sunBody = null;
    this._moonBody = null;
    this.planetSprites = Object.create(null);

    this._precompute();
    this._computePlanets();
    setInterval(() => this._computePlanets(), 120000);
    this._makeSprites();
    this._bindInput();
    this._resize();
    addEventListener('resize', () => this._resize());
  }

  /* ---------- précalculs ---------- */
  _precompute() {
    const S = this.data.stars, n = S.length;
    this.vec = new Float32Array(n * 3);
    const D = Math.PI / 180;
    for (let i = 0; i < n; i++) {
      const ra = S[i][0] * D, dec = S[i][1] * D, cd = Math.cos(dec);
      this.vec[i*3]   = cd * Math.cos(ra);
      this.vec[i*3+1] = cd * Math.sin(ra);
      this.vec[i*3+2] = Math.sin(dec);
    }
    // Voie lactée v1.1 : 3 bandes galactiques (b=-7,0,+7) + bulbe vers Sagittaire (l~0)
    this.mw = [];
    const ragp = 192.85948 * D, decgp = 27.12825 * D, lcp = 122.93192 * D;
    const galToEq = (l, b) => {
      const lr = l * D, br = b * D;
      const sinb = Math.sin(br), cosb = Math.cos(br);
      const sindec = sinb * Math.sin(decgp) + cosb * Math.cos(decgp) * Math.cos(lcp - lr);
      const dec = Math.asin(sindec);
      const y = cosb * Math.sin(lcp - lr);
      const x = sinb * Math.cos(decgp) - cosb * Math.sin(decgp) * Math.cos(lcp - lr);
      const ra = ragp + Math.atan2(y, x);
      return [(ra / D % 360 + 360) % 360, dec / D];
    };
    // Soft MW ribbon — mid plane + thin side bands (still ~60 draws, no equirect)
    for (const b of [-5, 0, 5]) {
      for (let l = 0; l < 360; l += 18) {
        const [ra, dec] = galToEq(l, b);
        const dl = Math.min(l, 360 - l);
        const bulge = (b === 0 ? 1.15 : 0.7) * (1 + 1.35 * Math.exp(-dl * dl / 1600));
        this.mw.push([ra, dec, bulge]);
      }
    }
    this.mwVec = new Float32Array(this.mw.length * 3);
    for (let i = 0; i < this.mw.length; i++) {
      const ra = this.mw[i][0] * D, dec = this.mw[i][1] * D, cd = Math.cos(dec);
      this.mwVec[i * 3] = cd * Math.cos(ra);
      this.mwVec[i * 3 + 1] = cd * Math.sin(ra);
      this.mwVec[i * 3 + 2] = Math.sin(dec);
    }
  }

  _starColor(bv) {
    // Slightly desaturated spectral colors — closer to naked-eye sky than neon UI hues.
    if (bv < 0)    return '#b8c8f0';
    if (bv < 0.3)  return '#d5def5';
    if (bv < 0.6)  return '#f2f2f6';
    if (bv < 1.0)  return '#f5eee4';
    if (bv < 1.5)  return '#efd8b4';
    return '#e8c48a';
  }

  _makeSprites() {
    // sprites pré-rendus : 5 couleurs × 6 tailles → drawImage ultra rapide
    this.sprites = {};
    const colors = ['#b8c8f0', '#d5def5', '#f2f2f6', '#f5eee4', '#efd8b4', '#e8c48a'];
    for (const col of colors) {
      const arr = [];
      for (let s = 0; s < 7; s++) {
        const r = 1.05 + s * 1.35, pad = r * 2.6, size = Math.ceil(pad * 2);
        const c = document.createElement('canvas');
        c.width = c.height = size;
        const x = c.getContext('2d');
        const g = x.createRadialGradient(pad, pad, 0, pad, pad, pad);
        g.addColorStop(0, 'rgba(255,255,255,0.98)');
        g.addColorStop(0.18, col);
        g.addColorStop(0.55, col + '99');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = g;
        x.fillRect(0, 0, size, size);
        arr.push(c);
      }
      this.sprites[col] = arr;
    }
    // Soft MW dust sprite — one cheap drawImage per sample (no equirect crops)
    const m = document.createElement('canvas');
    m.width = m.height = 128;
    const mx = m.getContext('2d');
    const mg = mx.createRadialGradient(64, 64, 0, 64, 64, 64);
    mg.addColorStop(0, 'rgba(230,222,205,0.22)');
    mg.addColorStop(0.35, 'rgba(195,190,178,0.1)');
    mg.addColorStop(0.7, 'rgba(150,155,165,0.035)');
    mg.addColorStop(1, 'rgba(0,0,0,0)');
    mx.fillStyle = mg;
    mx.fillRect(0, 0, 128, 128);
    this.mwSprite = m;
  }

  _smoothstep(e0, e1, x) {
    const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  }

  _moonPhaseFraction(date) {
    const newMoon = Date.UTC(2000, 0, 6, 18, 14, 0);
    const days = (date.getTime() - newMoon) / 86400000;
    const age = ((days % 29.530588853) + 29.530588853) % 29.530588853;
    return age / 29.530588853;
  }

  _updateSkyState() {
    const st = this.skyState;
    const date = (this.date instanceof Date && !isNaN(this.date.getTime())) ? this.date : new Date();
    st.moonPhase = this._moonPhaseFraction(date);

    let sunAlt = -90;
    const sun = this._sunBody;
    if (sun && this.zenith) {
      const D = Math.PI / 180;
      const r = sun.ra * D, d = sun.dec * D, cd = Math.cos(d);
      const vx = cd * Math.cos(r), vy = cd * Math.sin(r), vz = Math.sin(d);
      const z = this.zenith;
      const zdot = vx * z[0] + vy * z[1] + vz * z[2];
      sunAlt = Math.asin(Math.max(-1, Math.min(1, zdot))) * (180 / Math.PI);
    } else if (!this.zenith) {
      sunAlt = -90;
    }
    st.sunAlt = sunAlt;
    st.nightVision = !!this.o.nightVision || (this.o.bg === '#120202');
    if (!this.o.atmosphere) {
      // Dark-sky browse: no twilight wash
      st.starFade = 1;
      st.mwFade = 1;
      st.labelFade = 1;
      st.dayWash = 0;
      return;
    }
    st.starFade = 1 - this._smoothstep(-18, -4, sunAlt);
    st.mwFade = (1 - this._smoothstep(-16, -5, sunAlt)) * 0.95;
    st.labelFade = 1 - this._smoothstep(-14, -3, sunAlt);
    st.dayWash = this._smoothstep(-6, 10, sunAlt);
  }

  _renderAtmosphere(ctx, W, H) {
    const st = this.skyState;
    // WebGL backdrop owns the sky wash — keep 2D canvas clear for stars/planets.
    if (this.o.glBackdrop) {
      ctx.clearRect(0, 0, W, H);
      return;
    }
    if (!this.o.atmosphere) {
      ctx.fillStyle = st.nightVision ? '#120202' : (this.o.bg || '#000000');
      ctx.fillRect(0, 0, W, H);
      return;
    }
    const a = st.sunAlt;
    let zTop, zMid, zLow, zBot;
    if (st.nightVision) {
      zTop = '#090101'; zMid = '#120202'; zLow = '#1a0606'; zBot = '#220808';
    } else if (a < -18) {
      zTop = '#000000'; zMid = this.o.bg || '#000000'; zLow = '#050810'; zBot = '#0c1420';
    } else if (a < -12) {
      zTop = '#020410'; zMid = '#061028'; zLow = '#0e1c3a'; zBot = '#182848';
    } else if (a < -6) {
      zTop = '#081830'; zMid = '#102848'; zLow = '#243860'; zBot = '#3a4060';
    } else if (a < 0) {
      zTop = '#1c3a68'; zMid = '#4a5878'; zLow = '#d88850'; zBot = '#f0a868';
    } else if (a < 8) {
      zTop = '#4a90d8'; zMid = '#6eb0e8'; zLow = '#f2bc80'; zBot = '#f8d0a0';
    } else {
      zTop = '#5ba8e8'; zMid = '#82c0f0'; zLow = '#b0daf5'; zBot = '#cce8f8';
    }
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, zTop);
    bg.addColorStop(0.45, zMid);
    bg.addColorStop(0.8, zLow);
    bg.addColorStop(1, zBot);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Compact sun glow (arc only — avoid full-screen fillRect)
    if (this.mode === 'horizon' && a > -14 && a < 10 && this._sunBody) {
      const pr = this.project(this._sunBody.ra, this._sunBody.dec);
      if (pr && pr.visible) {
        const x = pr.x * this.dpr, y = pr.y * this.dpr;
        const R = Math.min(W, H) * (0.3 + 0.22 * st.dayWash);
        const g = ctx.createRadialGradient(x, y, 0, x, y, R);
        if (st.nightVision) {
          g.addColorStop(0, 'rgba(180,40,30,0.22)');
          g.addColorStop(1, 'rgba(0,0,0,0)');
        } else if (a < 0) {
          g.addColorStop(0, 'rgba(255,155,85,0.32)');
          g.addColorStop(1, 'rgba(0,0,0,0)');
        } else {
          g.addColorStop(0, 'rgba(255,242,205,0.5)');
          g.addColorStop(1, 'rgba(0,0,0,0)');
        }
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, R, 0, 7);
        ctx.fill();
      }
    }
  }

  _renderMilkyWay(ctx, W, H) {
    if (this.o.glBackdrop) return;
    const st = this.skyState;
    if (st.mwFade < 0.05) return;
    const sc = H / 700;
    const fovScale = Math.min(1.6, 70 / this.cam.fov);
    // Draw full sphere — including below the geometric horizon (Stellarium-style free look)
    ctx.globalAlpha = 0.5 * st.mwFade * (st.nightVision ? 0.5 : 1);
    const spr = this.mwSprite;
    const mv = this.mwVec;
    for (let i = 0; i < this.mw.length; i++) {
      const p = this._proj(mv[i * 3], mv[i * 3 + 1], mv[i * 3 + 2]);
      if (!p) continue;
      if (p[0] < -60 || p[0] > W + 60 || p[1] < -60 || p[1] > H + 60) continue;
      const w = this.mw[i][2];
      const size = (280 + 110 * w) * sc * fovScale;
      ctx.drawImage(spr, p[0] - size / 2, p[1] - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }

  _ensureMoonDisc(phase) {
    const key = Math.round(phase * 48);
    if (this._moonDiscCache.phaseKey === key && this._moonDiscCache.canvas) {
      return this._moonDiscCache.canvas;
    }
    const size = 64;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(size, size);
    const data = img.data;
    const cx = (size - 1) / 2, cy = (size - 1) / 2, radius = size * 0.46;
    // Waxing lit on the RIGHT (phase 0=new → 0.5=full → 1=new)
    const ang = phase * Math.PI * 2;
    let lx = Math.sin(ang), ly = 0, lz = Math.cos(ang);
    const len = Math.sqrt(lx * lx + ly * ly + lz * lz) || 1;
    lx /= len; ly /= len; lz /= len;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const dx = (x - cx) / radius, dy = (y - cy) / radius;
        const d2 = dx * dx + dy * dy;
        if (d2 > 1) { data[i + 3] = 0; continue; }
        const nz = Math.sqrt(Math.max(0, 1 - d2));
        const ndotl = Math.max(0, dx * lx + (-dy) * ly + nz * lz);
        const shade = Math.pow(ndotl, 0.85);
        const albedo = 0.82 + 0.18 * nz;
        const litR = 255 * albedo, litG = 243 * albedo, litB = 220 * albedo;
        const nightR = 18 + 16 * nz, nightG = 16 + 14 * nz, nightB = 14 + 12 * nz;
        data[i] = (nightR + (litR - nightR) * shade) | 0;
        data[i + 1] = (nightG + (litG - nightG) * shade) | 0;
        data[i + 2] = (nightB + (litB - nightB) * shade) | 0;
        data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    this._moonDiscCache = { phaseKey: key, canvas: c };
    return c;
  }

  _renderMoon(ctx) {
    const moon = this._moonBody;
    if (!moon) return;
    const pr = this.project(moon.ra, moon.dec);
    if (!pr.visible) return;
    const st = this.skyState;
    const alpha = Math.max(0.25, Math.min(1, 0.35 + 0.65 * st.starFade));
    const x = pr.x * this.dpr, y = pr.y * this.dpr;
    // Slightly larger when using photo so surface detail reads
    const hasSprite = !!this._spriteFor('Moon');
    const sz = Math.max(hasSprite ? 10 : 6, (0.52 / this.cam.fov) * this.cv.height * (hasSprite ? 1.35 : 1.1));
    ctx.globalAlpha = alpha;
    if (!this._drawBodySprite(ctx, 'Moon', x, y, sz)) {
      const disc = this._ensureMoonDisc(st.moonPhase);
      ctx.drawImage(disc, x - sz / 2, y - sz / 2, sz, sz);
    } else if (st.moonPhase > 0.02 && st.moonPhase < 0.98) {
      // Soft phase shade over photo (waxing lit on the right)
      const ang = st.moonPhase * Math.PI * 2;
      const kx = Math.cos(ang);
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, sz * 0.48, 0, 7);
      ctx.clip();
      const shade = ctx.createLinearGradient(x - sz * 0.5, y, x + sz * 0.5, y);
      if (kx >= 0) {
        shade.addColorStop(0, 'rgba(0,0,0,0.72)');
        shade.addColorStop(0.45, 'rgba(0,0,0,0.55)');
        shade.addColorStop(0.62, 'rgba(0,0,0,0)');
      } else {
        shade.addColorStop(0.38, 'rgba(0,0,0,0)');
        shade.addColorStop(0.55, 'rgba(0,0,0,0.55)');
        shade.addColorStop(1, 'rgba(0,0,0,0.72)');
      }
      ctx.fillStyle = shade;
      ctx.fillRect(x - sz * 0.55, y - sz * 0.55, sz * 1.1, sz * 1.1);
      ctx.restore();
    }
    if (st.labelFade > 0.2 || !this.o.atmosphere) {
      ctx.globalAlpha = Math.max(0.55, st.labelFade);
      ctx.font = `600 ${Math.round(12 * this.dpr)}px system-ui, sans-serif`;
      ctx.textAlign = 'left';
      ctx.lineWidth = 3 * this.dpr;
      ctx.strokeStyle = st.nightVision ? 'rgba(40,8,6,0.85)' : 'rgba(5, 6, 16, 0.85)';
      ctx.strokeText('Moon', x + sz * 0.55 + 4 * this.dpr, y + 4 * this.dpr);
      ctx.fillStyle = st.nightVision ? '#f0a090' : '#e7eefc';
      ctx.fillText('Moon', x + sz * 0.55 + 4 * this.dpr, y + 4 * this.dpr);
    }
    ctx.globalAlpha = 1;
  }

  _resize() {
    // Cap DPR harder on mobile — 2× fills kill fillrate with MW + stars
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    this.cv.width = this.cv.clientWidth * dpr;
    this.cv.height = this.cv.clientHeight * dpr;
    this.dpr = dpr;
  }

  /* ---------- projection ---------- */
  _basis() {
    const D = Math.PI / 180;
    const y = this.cam.yaw * D, p = this.cam.pitch * D;
    const cy = Math.cos(y), sy = Math.sin(y), cp = Math.cos(p), sp = Math.sin(p);
    // base caméra (repère courant : équatorial OU horizontal selon le mode)
    let F = [cp * cy, cp * sy, sp];
    let R = [-sy, cy, 0];
    let U = [-sp * cy, -sp * sy, cp];
    // v1.3 — mode horizon : yaw=azimut (depuis le Nord vers l'Est), pitch=hauteur.
    // On exprime la base (calculée dans le repère horizontal N/E/Up) en coordonnées
    // équatoriales, pour que la projection des étoiles reste inchangée (coût nul).
    if (this.mode === 'horizon') {
      const H = this._horizFrame();           // {N, E, Z} en coords équatoriales
      const toEq = v => [
        H.N[0] * v[0] + H.E[0] * v[1] + H.Z[0] * v[2],
        H.N[1] * v[0] + H.E[1] * v[1] + H.Z[1] * v[2],
        H.N[2] * v[0] + H.E[2] * v[1] + H.Z[2] * v[2]
      ];
      F = toEq(F); R = toEq(R); U = toEq(U);
      this.zenith = H.Z;                       // pour le culling sous l'horizon
    } else {
      this.zenith = null;
    }
    this.F = F; this.R = R; this.U = U;
    this.fl = (this.cv.height / 2) / Math.tan(this.cam.fov * D / 2);
  }

  /* ---------- v1.3 : repère horizontal (alt/az) ---------- */
  // Temps sidéral local (degrés) pour la date + longitude observateur.
  _lst() {
    const d = this.date.getTime() / 86400000 + 2440587.5 - 2451545.0;
    const gmst = 280.46061837 + 360.98564736629 * d;     // degrés
    return (((gmst + this.geo.lon) % 360) + 360) % 360;
  }
  // Vecteurs Nord / Est / Zénith du repère horizontal, exprimés en coords équatoriales.
  _horizFrame() {
    const D = Math.PI / 180;
    const phi = this.geo.lat * D, th = this._lst() * D;
    const cphi = Math.cos(phi), sphi = Math.sin(phi), cth = Math.cos(th), sth = Math.sin(th);
    return {
      N: [-sphi * cth, -sphi * sth, cphi],   // point Nord de l'horizon (vers le pôle)
      E: [-sth, cth, 0],                      // Est (étoile qui se lève)
      Z: [cphi * cth, cphi * sth, sphi]       // zénith (dec=lat, ra=LST)
    };
  }

  _proj(vx, vy, vz) {
    const z = vx * this.F[0] + vy * this.F[1] + vz * this.F[2];
    if (z < 0.02) return null;
    const x = vx * this.R[0] + vy * this.R[1] + vz * this.R[2];
    const yy = vx * this.U[0] + vy * this.U[1] + vz * this.U[2];
    return [this.cv.width / 2 + x * this.fl / z, this.cv.height / 2 - yy * this.fl / z, z];
  }

  /** Projection inverse v1.2 : point écran (px CSS) → coordonnées célestes {ra, dec}. */
  unproject(px, py) {
    this._basis();
    const x = (px * this.dpr - this.cv.width / 2) / this.fl;
    const y = (this.cv.height / 2 - py * this.dpr) / this.fl;
    // rayon caméra → monde : v = R*x + U*y + F*1 (normalisé)
    const vx = this.R[0] * x + this.U[0] * y + this.F[0];
    const vy = this.R[1] * x + this.U[1] * y + this.F[1];
    const vz = this.R[2] * x + this.U[2] * y + this.F[2];
    const n = Math.hypot(vx, vy, vz);
    const R2D = 180 / Math.PI;
    return {
      ra: ((Math.atan2(vy / n, vx / n) * R2D) % 360 + 360) % 360,
      dec: Math.asin(vz / n) * R2D
    };
  }

  /** Distance angulaire (degrés) entre deux points célestes. */
  static angularDist(ra1, dec1, ra2, dec2) {
    const D = Math.PI / 180;
    const a = Math.sin(dec1 * D) * Math.sin(dec2 * D) +
              Math.cos(dec1 * D) * Math.cos(dec2 * D) * Math.cos((ra1 - ra2) * D);
    return Math.acos(Math.max(-1, Math.min(1, a))) / D;
  }

  /** Projection publique RA/Dec (degrés) → écran. Pour les layers custom. */
  project(ra, dec) {
    const D = Math.PI / 180, r = ra * D, d = dec * D, cd = Math.cos(d);
    const p = this._proj(cd * Math.cos(r), cd * Math.sin(r), Math.sin(d));
    if (!p) return { x: 0, y: 0, visible: false };
    return { x: p[0] / this.dpr, y: p[1] / this.dpr, visible: p[0] >= 0 && p[0] <= this.cv.width && p[1] >= 0 && p[1] <= this.cv.height };
  }

  /* ---------- interaction ---------- */
  _bindInput() {
    const cv = this.cv;
    let drag = null, pinch0 = 0, moved = 0;
    const pos = e => e.touches ? [e.touches[0].clientX, e.touches[0].clientY] : [e.clientX, e.clientY];

    const down = e => {
      if (e.touches && e.touches.length === 2) {
        pinch0 = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        return;
      }
      drag = pos(e); moved = 0;
      this.vel.yaw = this.vel.pitch = 0;
      // v1.1.1 : un simple clic ne tue plus le vol/la visite — seul un vrai drag (voir move)
    };
    const move = e => {
      if (e.touches && e.touches.length === 2) {
        const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        this.cam.fov = Math.max(8, Math.min(110, this.cam.fov * pinch0 / d));
        pinch0 = d;
        e.preventDefault();
        return;
      }
      if (!drag) return;
      // Unite: AR pointing owns the view. Focus-lock keeps pan until the user drags;
      // pinch zoom above still works while locked.
      if (this.arActive) {
        e.preventDefault();
        return;
      }
      const p = pos(e);
      const k = this.cam.fov / (this.cv.clientHeight);
      // Unite: grab-the-sky. Drag right moves the sky with the finger (camera looks left).
      // Upstream added the horizontal delta, which felt reversed. Vertical was already correct.
      const dy = (drag[0] - p[0]) * k, dp = (p[1] - drag[1]) * k;
      if (this.viewLocked) {
        if ((Math.abs(dy) + Math.abs(dp)) <= 0.18) {
          e.preventDefault();
          return;
        }
        this.viewLocked = false;
        if (typeof this.onViewUnlock === 'function') this.onViewUnlock();
      }
      // v1.1.1 : vrai drag détecté -> on interrompt vol + visite proprement (promesse résolue, UI notifiée)
      if (moved === 0 && (Math.abs(dy) + Math.abs(dp)) > 0.15) { this._cancelFlight(); this.stopTour(); }
      this.cam.yaw = ((this.cam.yaw + dy) % 360 + 360) % 360;
      this.cam.pitch = Math.max(-89, Math.min(89, this.cam.pitch + dp));
      this.vel.yaw = dy; this.vel.pitch = dp;
      moved += Math.abs(dy) + Math.abs(dp);
      drag = p;
      e.preventDefault();
    };
    const up = e => {
      if (drag && moved < 0.5 && this.onSelect) {
        const r = cv.getBoundingClientRect();
        const px = (e.changedTouches ? e.changedTouches[0].clientX : e.clientX) - r.left;
        const py = (e.changedTouches ? e.changedTouches[0].clientY : e.clientY) - r.top;
        const hit = this.pick(px, py);
        if (hit) this.onSelect(hit);
      }
      drag = null;
    };
    cv.addEventListener('mousedown', down);
    cv.addEventListener('mousemove', move);
    addEventListener('mouseup', up);
    cv.addEventListener('touchstart', down, { passive: false });
    cv.addEventListener('touchmove', move, { passive: false });
    cv.addEventListener('touchend', up);
    cv.addEventListener('wheel', e => {
      this.cam.fov = Math.max(8, Math.min(110, this.cam.fov * (e.deltaY > 0 ? 1.12 : 0.89)));
      e.preventDefault();
    }, { passive: false });
  }

  /** Trouve l'objet le plus proche d'un point écran (px CSS). */
  pick(px, py) {
    const x = px * this.dpr, y = py * this.dpr;
    let best = null, bd = 36 * this.dpr;
    // Prefer major bodies first (Stellarium Web–style hit priority)
    if (this.o.planets && this.planetPos) {
      for (const pl of this.planetPos) {
        const pr = this.project(pl.ra, pl.dec);
        if (!pr.visible) continue;
        const d = Math.hypot(pr.x * this.dpr - x, pr.y * this.dpr - y);
        const hitR = (pl.n === 'Sun' || pl.n === 'Moon' ? 40 : 34) * this.dpr;
        if (d < hitR && d < bd) {
          bd = d;
          best = { type: 'planet', name: pl.n, ra: pl.ra, dec: pl.dec, sym: pl.sym };
        }
      }
    }
    const S = this.data.stars;
    for (let i = 0; i < S.length; i++) {
      if (S[i][2] > 5.2 && !this.data.names[i]) continue;
      const p = this._proj(this.vec[i*3], this.vec[i*3+1], this.vec[i*3+2]);
      if (!p) continue;
      const d = Math.hypot(p[0] - x, p[1] - y);
      if (d < bd) { bd = d; best = { type: 'star', i, name: this.data.names[i] || null, ra: S[i][0], dec: S[i][1], mag: S[i][2], bv: S[i][3] }; }
    }
    if (this.o.dsos) for (const d of this.data.dsos) {
      const pr = this.project(d.ra, d.dec);
      if (pr.visible && Math.hypot(pr.x - px, pr.y - py) < 26) best = { type: 'dso', ...d };
    }
    for (const m of this.markers) {
      const pr = this.project(m.ra, m.dec);
      if (pr.visible && Math.hypot(pr.x - px, pr.y - py) < 26) best = { type: 'marker', ...m };
    }
    // Constellation centers — only if nothing closer was hit
    if (!best && this.o.constellations && this.data.connames) {
      let cBest = null, cd = 52;
      for (const [id, c] of Object.entries(this.data.connames)) {
        const pr = this.project(c.ra, c.dec);
        if (!pr.visible) continue;
        const d = Math.hypot(pr.x - px, pr.y - py);
        if (d < cd) {
          cd = d;
          cBest = {
            type: 'constellation',
            id,
            name: c[this.o.conNameKey] || c.n,
            ra: c.ra,
            dec: c.dec,
            fov: 48
          };
        }
      }
      if (cBest) best = cBest;
    }
    return best;
  }

  /* ---------- markers & layers (extensibilité) ---------- */
  addMarker(m) { const id = Date.now() + Math.random(); this.markers.push({ color: '#22d3ee', size: 10, pulse: true, ...m, _id: id }); return id; }
  clearMarkers() { this.markers = []; }
  addLayer(name, fn) { this.layers.set(name, fn); }
  removeLayer(name) { this.layers.delete(name); }
  set(k, v) { this.o[k] = v; }

  /** Register cutout PNGs for major bodies (name → Image/Canvas). */
  setPlanetSprites(map) {
    this.planetSprites = map && typeof map === 'object' ? map : Object.create(null);
    return this;
  }

  _spriteFor(name) {
    const img = this.planetSprites && this.planetSprites[name];
    if (!img) return null;
    const w = img.naturalWidth || img.width || 0;
    const h = img.naturalHeight || img.height || 0;
    if (w < 2 || h < 2) return null;
    return img;
  }

  _drawBodySprite(ctx, name, x, y, baseSz) {
    const img = this._spriteFor(name);
    if (!img) return false;
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    const aspect = w / h;
    let dw = baseSz, dh = baseSz;
    if (aspect > 1.2) {
      dw = baseSz * Math.min(2.1, aspect);
      dh = baseSz;
    } else if (aspect < 0.85) {
      dw = baseSz;
      dh = baseSz / Math.max(0.55, aspect);
    }
    ctx.drawImage(img, x - dw / 2, y - dh / 2, dw, dh);
    return true;
  }

  /* ---------- v1.3 : API mode horizon (alt/az) ---------- */
  /**
   * Bascule en vue "horizon" : le ciel tel qu'on le voit depuis un lieu/heure.
   * @param {number} lat  latitude observateur (degrés, +N)
   * @param {number} lon  longitude observateur (degrés, +E)
   * @param {Date}   [date]  instant d'observation (défaut : maintenant)
   * Le yaw devient l'azimut (0=Nord, 90=Est) et le pitch la hauteur.
   */
  setHorizon(lat, lon, date) {
    this.geo = { lat: lat, lon: lon };
    if (date) this.date = date;
    this.mode = 'horizon';
    // Unite: free look — do not clamp above the horizon; user can explore below landscape.
    return this;
  }
  /** Repasse en vue équatoriale classique (RA/Dec). */
  setEquatorial() { this.mode = 'equatorial'; this.zenith = null; return this; }
  /** Change l'instant d'observation (utile pour un curseur de temps). */
  setDate(date) { this.date = date; this._computePlanets(); return this; }
  /** Oriente la caméra vers un azimut/hauteur (mode horizon). */
  lookAtAltAz(azDeg, altDeg, fov) {
    this.cam.yaw = ((azDeg % 360) + 360) % 360;
    this.cam.pitch = Math.max(-89, Math.min(89, altDeg));
    if (fov) this.cam.fov = fov;
    return this;
  }

  /**
   * v1.3 — Mode AR : l'orientation de l'appareil pilote la caméra.
   * Lève le téléphone vers le ciel → les étoiles s'affichent par-dessus.
   * Nécessite le mode horizon (setHorizon). Gère la permission iOS 13+.
   * @param {function} [onState] rappel avec 'on' | 'denied' | 'unsupported'
   */
  enableAR(onState) {
    const notify = s => { if (onState) onState(s); };
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) { notify('unsupported'); return this; }
    if (this.mode !== 'horizon') this.setHorizon(this.geo.lat, this.geo.lon, new Date());
    const handler = (e) => {
      // cap (azimut) : compas iOS si dispo, sinon alpha inversé
      let heading = (e.webkitCompassHeading != null) ? e.webkitCompassHeading
                  : (e.alpha != null ? (360 - e.alpha) : null);
      if (heading == null || e.beta == null) return;
      // hauteur : téléphone vertical (beta≈90)→horizon ; à plat écran vers le haut (beta≈0)→zénith
      const alt = Math.max(-8, Math.min(90, 90 - Math.abs(e.beta)));
      this.cam.fov = 65;
      this.lookAtAltAz(heading, alt);
    };
    const attach = () => {
      addEventListener('deviceorientationabsolute', handler, true);
      addEventListener('deviceorientation', handler, true);
      this._arHandler = handler; this.arActive = true; this.vel.yaw = this.vel.pitch = 0;
      notify('on');
    };
    // iOS 13+ : permission explicite requise (dans un geste utilisateur)
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission()
        .then(st => st === 'granted' ? attach() : notify('denied'))
        .catch(() => notify('denied'));
    } else { attach(); }
    return this;
  }
  /** Quitte le mode AR (réactive le drag manuel). */
  disableAR() {
    if (this._arHandler) {
      removeEventListener('deviceorientationabsolute', this._arHandler, true);
      removeEventListener('deviceorientation', this._arHandler, true);
      this._arHandler = null;
    }
    this.arActive = false;
    return this;
  }

  /* ---------- vol caméra ---------- */
  _cancelFlight() {
    if (this._flight) { const d = this._flight.done; this._flight = null; if (d) d(); }
  }

  flyTo(ra, dec, fov = 30, ms = 2200) {
    this._cancelFlight();   // v1.1.1 : jamais de promesse orpheline
    return new Promise(res => {
      let dy = ra - this.cam.yaw;
      if (dy > 180) dy -= 360;
      if (dy < -180) dy += 360;
      this._flight = {
        t0: performance.now(), ms,
        y0: this.cam.yaw, p0: this.cam.pitch, f0: this.cam.fov,
        dy, dp: dec - this.cam.pitch, df: fov - this.cam.fov,
        done: res
      };
    });
  }

  /* ---------- visite guidée ---------- */
  tour(stops, opts = {}) {
    this.stopTour();
    this._tour = { stops, i: 0, opts, alive: true };
    const step = async () => {
      const T = this._tour;
      if (!T || !T.alive || T.i >= stops.length) {
        if (opts.onEnd) opts.onEnd();
        this._tour = null;
        return;
      }
      const s = stops[T.i];
      if (opts.onStep) opts.onStep(s, T.i);
      await this.flyTo(s.ra, s.dec, s.fov || 25, s.flyMs || 2600);
      if (!T.alive) return;
      setTimeout(() => { if (T.alive) { T.i++; step(); } }, s.holdMs || 4200);
    };
    step();
  }
  stopTour() {
    if (this._tour) {
      this._tour.alive = false;
      const cb = this._tour.opts && this._tour.opts.onAbort;
      this._tour = null;
      if (cb) cb();   // v1.1.1 : l UI peut se nettoyer (carte, bouton, audio)
    }
  }

  /** Index pour autocomplete recherche. */
  searchIndex() {
    const out = [];
    const S = this.data.stars;
    for (const [i, n] of Object.entries(this.data.names)) out.push({ name: n, ra: S[i][0], dec: S[i][1], type: 'étoile', fov: 25 });
    for (const [id, c] of Object.entries(this.data.connames)) out.push({ name: c[this.o.conNameKey] || c.n, ra: c.ra, dec: c.dec, type: 'constellation', fov: 55 });
    for (const d of this.data.dsos) out.push({ name: d.n, ra: d.ra, dec: d.dec, type: d.t, fov: 18 });
    return out;
  }

  /* ---------- boucle de rendu ---------- */
  start() { if (!this._running) { this._running = true; this._loop(); } }
  stop() { this._running = false; }

  _loop() {
    if (!this._running) return;
    const now = performance.now();

    // vol en cours
    if (this._flight) {
      const F = this._flight, t = Math.min(1, (now - F.t0) / F.ms);
      // Soft ease-in-out (quint) — slower acceleration / deceleration than cubic.
      const e = t < 0.5
        ? 16 * t * t * t * t * t
        : 1 - Math.pow(-2 * t + 2, 5) / 2;
      this.cam.yaw = ((F.y0 + F.dy * e) % 360 + 360) % 360;
      this.cam.pitch = F.p0 + F.dp * e;
      this.cam.fov = F.f0 + F.df * e;
      if (t >= 1) { const d = F.done; this._flight = null; d(); }
    } else if (!this.arActive && !this.viewLocked) {
      // inertie (désactivée en mode AR / focus-lock)
      this.cam.yaw = ((this.cam.yaw + this.vel.yaw) % 360 + 360) % 360;
      this.cam.pitch = Math.max(-89, Math.min(89, this.cam.pitch + this.vel.pitch));
      this.vel.yaw *= 0.965; this.vel.pitch *= 0.965;
    }

    this._render(now);
    requestAnimationFrame(() => this._loop());
  }

  _render(now) {
    const ctx = this.ctx, W = this.cv.width, H = this.cv.height;
    this._basis();
    this._updateSkyState();
    const st = this.skyState;

    this._renderAtmosphere(ctx, W, H);
    if (this.o.milkyway) this._renderMilkyWay(ctx, W, H);

    // lignes constellations — only the nearest to the look direction (declutter)
    if (this.o.constellations && st.labelFade > 0.08) {
      const D = Math.PI / 180;
      const F = this.F;
      const nearIds = new Set();
      const ranked = [];
      for (const [id, c] of Object.entries(this.data.connames)) {
        const r = c.ra * D, d = c.dec * D, cd = Math.cos(d);
        const vx = cd * Math.cos(r), vy = cd * Math.sin(r), vz = Math.sin(d);
        const dot = vx * F[0] + vy * F[1] + vz * F[2];
        ranked.push({ id, dot });
      }
      ranked.sort((a, b) => b.dot - a.dot);
      const keep = Math.max(1, this.o.nearConstellations || 1);
      const minDot = Math.cos((Math.min(80, this.cam.fov * 0.7)) * D);
      for (let i = 0; i < ranked.length && nearIds.size < keep; i++) {
        // Always keep the single nearest; extras must sit roughly in the FOV.
        if (i === 0 || ranked[i].dot >= minDot) nearIds.add(ranked[i].id);
      }

      // Quiet pencil lines — not purple game overlays
      const lineA = 0.18 * st.labelFade;
      ctx.strokeStyle = st.nightVision
        ? `rgba(255,120,90,${lineA * 0.9})`
        : `rgba(210,220,235,${lineA})`;
      ctx.lineWidth = Math.max(0.7, this.dpr * 0.65);
      for (const con of this.data.conlines) {
        if (!nearIds.has(con.id)) continue;
        for (const line of con.l) {
          let prev = null;
          for (const [ra, dec] of line) {
            const r = ra * D, d = dec * D, cd = Math.cos(d);
            const p = this._proj(cd * Math.cos(r), cd * Math.sin(r), Math.sin(d));
            if (p && prev) {
              ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(p[0], p[1]); ctx.stroke();
            }
            prev = p;
          }
        }
      }
      // noms — only for the nearest constellation(s)
      if (this.o.conLabels && this.cam.fov > 22) {
        ctx.fillStyle = st.nightVision
          ? `rgba(255,150,120,${0.42 * st.labelFade})`
          : `rgba(220,228,240,${0.42 * st.labelFade})`;
        ctx.font = `500 ${Math.round(11 * this.dpr)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        for (const id of nearIds) {
          const c = this.data.connames[id];
          if (!c) continue;
          const p = this.project(c.ra, c.dec);
          if (p.visible) ctx.fillText((c[this.o.conNameKey] || c.n).toUpperCase(), p.x * this.dpr, p.y * this.dpr);
        }
      }
    }

    // étoiles (sprites par buckets)
    const S = this.data.stars;
    const zoomBoost = Math.sqrt(70 / this.cam.fov);
    const Zh = this.zenith;   // v1.3 : non-null en mode horizon
    const Zh0 = Zh ? Zh[0] : 0, Zh1 = Zh ? Zh[1] : 0, Zh2 = Zh ? Zh[2] : 0;
    const dprPx = this.dpr;
    const skyFade = st.starFade;
    let lastAlpha = 1;
    if (skyFade > 0.02) for (let i = 0; i < S.length; i++) {
      // Atmosphere extinction near/above horizon only — keep stars below the horizon
      let extinct = 1;
      if (Zh) {
        const zdot = this.vec[i*3]*Zh0 + this.vec[i*3+1]*Zh1 + this.vec[i*3+2]*Zh2;
        if (zdot >= 0) {
          extinct = zdot < 0.35 ? Math.max(0.22, zdot * 1.7) : 1;
          if (extinct < 0.35 && S[i][2] > 4.2) continue;
        } else {
          extinct = 0.88; // slight dim under the horizon line
        }
      }
      // Twilight: cull faint stars first
      if (skyFade < 0.85 && S[i][2] > 2.2 + skyFade * 3.2) continue;
      const p = this._proj(this.vec[i*3], this.vec[i*3+1], this.vec[i*3+2]);
      if (!p || p[0] < -20 || p[0] > W + 20 || p[1] < -20 || p[1] > H + 20) continue;
      const mag = S[i][2];
      const col = this._starColor(S[i][3]);
      if (mag < 4.6) {
        const bucket = Math.max(0, Math.min(6, Math.round((4.6 - mag) * 1.15)));
        const sp = this.sprites[col][bucket];
        let sz = sp.width * 0.48 * zoomBoost * dprPx / 2;
        let alpha = extinct * skyFade;
        // Soft scintillation only for a few brightest stars
        if (mag < 0.8 && extinct > 0.7 && skyFade > 0.7) {
          sz *= 0.97 + 0.03 * Math.sin(now / 240 + i);
          alpha *= 0.94 + 0.06 * Math.sin(now / 280 + i * 1.3);
        }
        alpha = alpha < 0.08 ? 0.08 : (alpha > 1 ? 1 : alpha);
        if (alpha !== lastAlpha) { ctx.globalAlpha = alpha; lastAlpha = alpha; }
        ctx.drawImage(sp, p[0] - sz / 2, p[1] - sz / 2, sz, sz);
      } else {
        const faintAlpha = (1 - (mag - 4.6) * 0.5) * extinct * 0.85 * skyFade;
        if (faintAlpha < 0.14) continue;
        if (faintAlpha !== lastAlpha) { ctx.globalAlpha = faintAlpha; lastAlpha = faintAlpha; }
        ctx.fillStyle = col;
        ctx.fillRect(p[0], p[1], dprPx, dprPx);
      }
    }
    if (lastAlpha !== 1) ctx.globalAlpha = 1;

    // noms d'étoiles brillantes — quieter when focused (Stellarium Web)
    if (this.o.labels && st.labelFade > 0.12) {
      let maxMag = this.cam.fov > 60 ? 1.15 : this.cam.fov > 35 ? 2.0 : 2.6;
      if (this.viewLocked) maxMag = this.cam.fov > 28 ? 0.9 : 1.6;
      ctx.globalAlpha = st.labelFade;
      ctx.fillStyle = st.nightVision ? 'rgba(255,170,140,0.62)' : 'rgba(232,238,248,0.62)';
      ctx.font = `${Math.round(10.5 * this.dpr)}px system-ui, sans-serif`;
      ctx.textAlign = 'left';
      const cx = W * 0.5, cy = H * 0.5;
      const maxDist = Math.min(W, H) * (this.viewLocked ? 0.55 : 0.42);
      for (const [i, n] of Object.entries(this.data.names)) {
        if (S[i][2] > maxMag) continue;
        const p = this._proj(this.vec[i*3], this.vec[i*3+1], this.vec[i*3+2]);
        if (!p || p[0] < 0 || p[0] > W || p[1] < 0 || p[1] > H) continue;
        if (Math.hypot(p[0] - cx, p[1] - cy) > maxDist && this.cam.fov > 36) continue;
        ctx.fillText(n, p[0] + 8 * this.dpr, p[1] - 6 * this.dpr);
      }
      ctx.globalAlpha = 1;
    }

    // objets du ciel profond — quiet marks, no neon rings
    if (this.o.dsos && this.cam.fov < 70 && st.starFade > 0.35) {
      ctx.textAlign = 'left';
      for (const d of this.data.dsos) {
        const D = Math.PI / 180, r = d.ra * D, dd = d.dec * D, cd = Math.cos(dd);
        const p = this._proj(cd * Math.cos(r), cd * Math.sin(r), Math.sin(dd));
        if (!p || p[0] < 0 || p[0] > W || p[1] < 0 || p[1] > H) continue;
        const col = st.nightVision
          ? 'rgba(255,140,110,0.5)'
          : (d.t === 'galaxie' ? 'rgba(210,190,220,0.45)' : d.t === 'nébuleuse' ? 'rgba(170,210,185,0.45)' : 'rgba(170,195,220,0.45)');
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.55 * st.starFade;
        ctx.beginPath(); ctx.arc(p[0], p[1], 1.6 * this.dpr, 0, 7); ctx.fill();
        if (this.cam.fov < 45) {
          ctx.font = `${Math.round(10 * this.dpr)}px system-ui, sans-serif`;
          ctx.fillText(d.n, p[0] + 8 * this.dpr, p[1] + 3 * this.dpr);
        }
        ctx.globalAlpha = 1;
      }
    }

    // markers custom (OVNI, radiants, étoile de naissance…)
    for (const m of this.markers) {
      const pr = this.project(m.ra, m.dec);
      if (!pr.visible) continue;
      const x = pr.x * this.dpr, y = pr.y * this.dpr;
      const puls = m.pulse ? 1 + 0.25 * Math.sin(now / 300) : 1;
      ctx.strokeStyle = m.color; ctx.lineWidth = 1.5 * this.dpr;
      ctx.beginPath(); ctx.arc(x, y, m.size * this.dpr * puls, 0, 7); ctx.stroke();
      if (m.label) {
        ctx.fillStyle = m.color;
        ctx.font = `600 ${Math.round(11 * this.dpr)}px Inter, sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText(m.label, x + (m.size + 6) * this.dpr, y + 4 * this.dpr);
      }
    }

    // étoiles filantes
    if (this.o.meteors && st.starFade > 0.45) {
      if (Math.random() < 0.006 && this._meteors.length < 2) {
        const a = Math.random() * Math.PI * 2;
        this._meteors.push({ x: Math.random() * W, y: Math.random() * H * 0.6, dx: Math.cos(a) * 14, dy: Math.sin(a) * 14 + 6, life: 1 });
      }
      for (const m of this._meteors) {
        const g = ctx.createLinearGradient(m.x, m.y, m.x - m.dx * 5, m.y - m.dy * 5);
        g.addColorStop(0, `rgba(255,255,255,${m.life * st.starFade})`);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = g; ctx.lineWidth = 1.6 * this.dpr;
        ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x - m.dx * 5, m.y - m.dy * 5); ctx.stroke();
        m.x += m.dx; m.y += m.dy; m.life -= 0.025;
      }
      this._meteors = this._meteors.filter(m => m.life > 0);
    }

    // planètes v1.1 (Moon drawn as Lambert disc separately)
    if (this.o.planets) this._renderPlanets(ctx, now);
    if (this.o.planets) this._renderMoon(ctx);

    // horizon v1.3 (ligne, sol, points cardinaux)
    if (this.mode === 'horizon') this._renderHorizon(ctx);

    // layers custom
    for (const fn of this.layers.values()) fn(ctx, this);
  }

  /* ---------- v1.3 : horizon, sol et points cardinaux ---------- */
  _renderHorizon(ctx) {
    const D = Math.PI / 180, H = this._horizFrame();
    const W = this.cv.width, Ht = this.cv.height;
    // un point du cercle d'horizon (altitude 0) pour un azimut donné → écran
    const ringPt = (azDeg) => {
      const a = azDeg * D, hx = Math.cos(a), hy = Math.sin(a);  // N=+x, E=+y, alt0 → z=0
      const v = [
        H.N[0]*hx + H.E[0]*hy, H.N[1]*hx + H.E[1]*hy, H.N[2]*hx + H.E[2]*hy
      ];
      return this._proj(v[0], v[1], v[2]);
    };
    const pts = [];
    for (let az = 0; az <= 360; az += 3) {
      const p = ringPt(az);
      if (p) pts.push(p);
    }
    ctx.save();
    const st = this.skyState || { dayWash: 0, nightVision: false };
    // Translucent ground so stars / MW / constellations stay visible below the horizon
    const nadir = this._proj(-H.Z[0], -H.Z[1], -H.Z[2]);
    if (pts.length > 8) {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      if (nadir) {
        const towardBottom = nadir[1] >= Ht * 0.5;
        if (towardBottom) {
          ctx.lineTo(W + 2, Ht + 2);
          ctx.lineTo(-2, Ht + 2);
        } else {
          ctx.lineTo(W + 2, -2);
          ctx.lineTo(-2, -2);
        }
      } else {
        ctx.lineTo(W + 2, Ht + 2);
        ctx.lineTo(-2, Ht + 2);
      }
      ctx.closePath();
      if (st.nightVision) ctx.fillStyle = 'rgba(22,6,6,0.28)';
      else if (st.dayWash > 0.5) ctx.fillStyle = 'rgba(55,75,50,0.22)';
      else ctx.fillStyle = 'rgba(6,8,12,0.28)';
      ctx.fill();
    }
    // Soft horizon — thin haze, not a bright UI stroke
    ctx.strokeStyle = st.nightVision
      ? 'rgba(255,100,80,0.28)'
      : (st.dayWash > 0.4 ? 'rgba(90,120,140,0.28)' : 'rgba(150,170,190,0.28)');
    ctx.lineWidth = this.dpr * 1.05;
    ctx.beginPath();
    let started = false;
    for (let az = 0; az <= 360; az += 3) {
      const p = ringPt(az);
      if (!p) { started = false; continue; }
      if (!started) { ctx.moveTo(p[0], p[1]); started = true; }
      else ctx.lineTo(p[0], p[1]);
    }
    ctx.stroke();
    // points cardinaux
    const card = [[0,'N'],[45,'NE'],[90,'E'],[135,'SE'],[180,'S'],[225,'SO'],[270,'O'],[315,'NO']];
    const cardEn = {NE:'NE',SE:'SE',SO:'SW',NO:'NW',N:'N',E:'E',S:'S',O:'W'};
    ctx.font = `600 ${Math.round(12 * this.dpr)}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const [az, lbl] of card) {
      const p = ringPt(az);
      if (!p) continue;
      const txt = this.o.conNameKey === 'e' ? cardEn[lbl] : lbl;
      if (st.nightVision) {
        ctx.fillStyle = (lbl.length === 1) ? 'rgba(255,140,110,0.6)' : 'rgba(220,100,80,0.35)';
      } else {
        ctx.fillStyle = (lbl.length === 1) ? 'rgba(200,210,220,0.55)' : 'rgba(160,175,190,0.32)';
      }
      ctx.fillText(txt, p[0], p[1] - 12 * this.dpr);
    }
    ctx.restore();
  }

  /* ---------- planètes v1.1 (algorithme Paul Schlyter, précision ~1°) ---------- */
  _computePlanets() {
    // Unite: follow the observer time from setDate/setHorizon. Upstream used the clock only.
    const now = (this.date instanceof Date && !isNaN(this.date.getTime())) ? this.date : new Date();
    const y = now.getUTCFullYear(), m = now.getUTCMonth() + 1, dd = now.getUTCDate();
    const h = now.getUTCHours() + now.getUTCMinutes() / 60;
    const d = 367 * y - Math.floor(7 * (y + Math.floor((m + 9) / 12)) / 4) + Math.floor(275 * m / 9) + dd - 730530 + h / 24;
    const D = Math.PI / 180, R = 180 / Math.PI;
    const rev = a => ((a % 360) + 360) % 360;
    const ecl = (23.4393 - 3.563e-7 * d) * D;

    const kepler = (M, e) => {
      let E = M + e * Math.sin(M) * (1 + e * Math.cos(M));
      for (let k = 0; k < 5; k++) E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
      return E;
    };
    const helio = (N, i, w, a, e, M) => {
      const E = kepler(M, e);
      const xv = a * (Math.cos(E) - e), yv = a * Math.sqrt(1 - e * e) * Math.sin(E);
      const v = Math.atan2(yv, xv), r = Math.hypot(xv, yv);
      const xh = r * (Math.cos(N) * Math.cos(v + w) - Math.sin(N) * Math.sin(v + w) * Math.cos(i));
      const yh = r * (Math.sin(N) * Math.cos(v + w) + Math.cos(N) * Math.sin(v + w) * Math.cos(i));
      const zh = r * (Math.sin(v + w) * Math.sin(i));
      return [xh, yh, zh, r, v];
    };

    // Soleil
    const ws = rev(282.9404 + 4.70935e-5 * d) * D, es = 0.016709 - 1.151e-9 * d, Ms = rev(356.0470 + 0.9856002585 * d) * D;
    const Es = kepler(Ms, es);
    const xvs = Math.cos(Es) - es, yvs = Math.sqrt(1 - es * es) * Math.sin(Es);
    const vs = Math.atan2(yvs, xvs), rs = Math.hypot(xvs, yvs);
    const lonsun = vs + ws;
    const xs = rs * Math.cos(lonsun), ys = rs * Math.sin(lonsun);

    const toRaDec = (xg, yg, zg) => {
      const xe = xg, ye = yg * Math.cos(ecl) - zg * Math.sin(ecl), ze = yg * Math.sin(ecl) + zg * Math.cos(ecl);
      return [rev(Math.atan2(ye, xe) * R), Math.atan2(ze, Math.hypot(xe, ye)) * R];
    };

    const P = [];
    // Soleil
    { const [ra, dec] = toRaDec(xs, ys, 0); P.push({ n: 'Sun', ra, dec, color: '#fff7d6', size: 13, sym: '☉' }); }
    // Lune (géocentrique)
    {
      const N = rev(125.1228 - 0.0529538083 * d) * D, i = 5.1454 * D, w = rev(318.0634 + 0.1643573223 * d) * D;
      const a = 60.2666, e = 0.054900, M = rev(115.3654 + 13.0649929509 * d) * D;
      const [xh, yh, zh] = helio(N, i, w, a, e, M);
      const [ra, dec] = toRaDec(xh, yh, zh);
      P.push({ n: 'Moon', ra, dec, color: '#e8eaf0', size: 12, sym: '☾' });
    }
    // Planètes (éléments Schlyter)
    const EL = [
      ['Mercury', 48.3313 + 3.24587e-5 * d, 7.0047 + 5e-8 * d, 29.1241 + 1.01444e-5 * d, 0.387098, 0.205635 + 5.59e-10 * d, 168.6562 + 4.0923344368 * d, '#cdb89e', 5, '☿'],
      ['Venus',   76.6799 + 2.46590e-5 * d, 3.3946 + 2.75e-8 * d, 54.8910 + 1.38374e-5 * d, 0.723330, 0.006773 - 1.302e-9 * d, 48.0052 + 1.6021302244 * d, '#f5e9c9', 9, '♀'],
      ['Mars',   49.5574 + 2.11081e-5 * d, 1.8497 - 1.78e-8 * d, 286.5016 + 2.92961e-5 * d, 1.523688, 0.093405 + 2.516e-9 * d, 18.6021 + 0.5240207766 * d, '#ff9466', 7, '♂'],
      ['Jupiter', 100.4542 + 2.76854e-5 * d, 1.3030 - 1.557e-7 * d, 273.8777 + 1.64505e-5 * d, 5.20256, 0.048498 + 4.469e-9 * d, 19.8950 + 0.0830853001 * d, '#f0d9b5', 10, '♃'],
      ['Saturn', 113.6634 + 2.38980e-5 * d, 2.4886 - 1.081e-7 * d, 339.3939 + 2.97661e-5 * d, 9.55475, 0.055546 - 9.499e-9 * d, 316.9670 + 0.0334442282 * d, '#e8d3a3', 9, '♄'],
      ['Uranus', 74.0005 + 1.3978e-5 * d, 0.7733 + 1.9e-8 * d, 96.6612 + 3.0565e-5 * d, 19.18171 - 1.55e-8 * d, 0.047318 + 7.45e-9 * d, 142.5905 + 0.011725806 * d, '#b7efe9', 6, '♅'],
      ['Neptune', 131.7806 + 3.0173e-5 * d, 1.7700 - 2.55e-7 * d, 272.8461 - 6.027e-6 * d, 30.05826 + 3.313e-8 * d, 0.008606 + 2.15e-9 * d, 260.2471 + 0.005995147 * d, '#7eb6ff', 6, '♆'],
    ];
    for (const [n, Nd, id_, wd, a, e, Md, color, size, sym] of EL) {
      const [xh, yh, zh] = helio(rev(Nd) * D, id_ * D, rev(wd) * D, a, e, rev(Md) * D);
      const [ra, dec] = toRaDec(xh + xs, yh + ys, zh);  // héliocentrique → géocentrique
      P.push({ n, ra, dec, color, size, sym });
    }
    this.planetPos = P;
    this._sunBody = null;
    this._moonBody = null;
    for (let i = 0; i < P.length; i++) {
      if (P[i].n === 'Sun') this._sunBody = P[i];
      else if (P[i].n === 'Moon') this._moonBody = P[i];
    }
  }

  _renderPlanets(ctx, now) {
    if (!this.planetPos) return;
    const st = this.skyState || { starFade: 1, labelFade: 1, dayWash: 0, nightVision: false };
    const boost = { Venus: 1.45, Jupiter: 1.7, Mars: 1.4, Saturn: 1.85, Mercury: 1.2, Uranus: 1.25, Neptune: 1.25 };
    for (const pl of this.planetPos) {
      if (pl.n === 'Moon') continue; // photo / Lambert in _renderMoon
      // Hide planets in bright day except Sun
      if (pl.n !== 'Sun' && st.starFade < 0.12) continue;
      const pr = this.project(pl.ra, pl.dec);
      if (!pr.visible) continue;
      const x = pr.x * this.dpr, y = pr.y * this.dpr;
      const hasSprite = !!this._spriteFor(pl.n);
      let sz = pl.size * this.dpr * Math.sqrt(70 / this.cam.fov) * (hasSprite ? 0.85 : 0.55) * (boost[pl.n] || 1);
      if (pl.n === 'Sun') {
        sz = Math.max(sz, (0.53 / this.cam.fov) * this.cv.height * (0.9 + 0.4 * st.dayWash));
      }
      // When zoomed in (Stellarium-style focus), grow photo so surface shows
      if (hasSprite && this.cam.fov < 28) {
        sz = Math.max(sz, (1.1 / this.cam.fov) * this.cv.height * (pl.n === 'Saturn' ? 0.85 : 0.55));
      }
      ctx.globalAlpha = pl.n === 'Sun' ? 1 : Math.max(0.4, st.starFade);
      if (!this._drawBodySprite(ctx, pl.n, x, y, sz)) {
        const g = ctx.createRadialGradient(x, y, 0, x, y, sz * 2.2);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.3, pl.color);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, sz * 2.2, 0, 7); ctx.fill();
      }
      // Always label major bodies with clean name (Stellarium Web style)
      if (st.labelFade > 0.15 || pl.n === 'Sun' || !this.o.atmosphere) {
        const label = pl.n;
        const labelX = x + sz * (pl.n === 'Saturn' ? 1.1 : 0.7) + 4 * this.dpr;
        ctx.font = `600 ${Math.round(12 * this.dpr)}px system-ui, sans-serif`;
        ctx.textAlign = 'left';
        ctx.lineWidth = 3 * this.dpr;
        ctx.strokeStyle = st.nightVision ? 'rgba(40,8,6,0.85)' : 'rgba(5, 6, 16, 0.85)';
        ctx.strokeText(label, labelX, y + 4 * this.dpr);
        ctx.fillStyle = st.nightVision ? '#f0a090' : '#e7eefc';
        ctx.fillText(label, labelX, y + 4 * this.dpr);
      }
      ctx.globalAlpha = 1;
    }
  }
}
SkyEngine.VERSION = '1.4.6-unite';
if (typeof module !== 'undefined') module.exports = SkyEngine;
