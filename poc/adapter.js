(function () {
  'use strict';

  // Matches SkyEngine v1.3.2 constructor defaults. The engine has no reset method.
  var INITIAL_CAM = { yaw: 84, pitch: 10, fov: 88 };
  var DEFAULT_SKY_FOV = 88;
  var ENTER_START_FOV = 78;
  var FOCUS_FOV = {
    sun: 8,
    moon: 6,
    planet: 12,
    star: 18,
    constellation: 50,
    dso: 20,
    marker: 18
  };
  var FOCUS_FLY_MS = 1600;
  var PLANET_FLY_MS = 1800;
  var M4_CATALOGUE_ID = 'NGC 6121';
  var FIELDS = [
    ['type', 'Catalogue type'],
    ['name', 'Name'],
    ['n', 'Catalogue name'],
    ['id', 'Catalogue id'],
    ['ra', 'Right ascension (degrees)'],
    ['dec', 'Declination (degrees)'],
    ['mag', 'Magnitude'],
    ['bv', 'B−V'],
    ['sym', 'Symbol'],
    ['t', 'Deep-sky type']
  ];

  var statusEl = document.getElementById('status');
  var diagEl = document.getElementById('diag');
  var searchForm = document.getElementById('search-form');
  var searchInput = document.getElementById('search');
  var resultsEl = document.getElementById('results');
  var noResultsEl = document.getElementById('no-results');
  var resetButton = document.getElementById('reset');
  var latInput = document.getElementById('lat');
  var lonInput = document.getElementById('lon');
  var whenInput = document.getElementById('when');
  var horizonButton = document.getElementById('horizon');
  var objectEl = document.getElementById('object');
  var metaEl = document.getElementById('meta');
  var objectNoteEl = document.getElementById('object-note');
  var objectPlanetDeckEl = document.getElementById('object-planet-deck');
  var objectSwipeHintEl = document.getElementById('object-swipe-hint');
  var objectPagerEl = document.getElementById('object-pager');
  var clearButton = document.getElementById('clear-selection');
  var locateButton = document.getElementById('locate');
  var pointButton = document.getElementById('point');
  var nowButton = document.getElementById('now');
  var nowFabBtn = document.getElementById('now-fab');
  var reticleEl = document.getElementById('reticle');
  var objectTitleEl = document.getElementById('object-title');
  var objectThumbEl = document.getElementById('object-thumb');
  var objectOpenBtn = document.getElementById('object-open');
  var objectKnowHandle = document.getElementById('object-know-handle');
  var toggleGridBtn = document.getElementById('toggle-grid');
  var toggleLinesBtn = document.getElementById('toggle-lines');
  var toggleMilkyBtn = document.getElementById('toggle-milkyway');
  var toggleAtmosphereBtn = document.getElementById('toggle-atmosphere');
  var toggleDsosBtn = document.getElementById('toggle-dsos');
  var toggleNightBtn = document.getElementById('toggle-night');
  var focusTitleEl = document.getElementById('focus-title');
  var fovHudTextEl = document.getElementById('fov-hud-text');
  var compassRoseEl = document.getElementById('compass-rose');
  var compassDegEl = document.getElementById('compass-deg');
  var PLANET_IMAGE = {
    Sun: 'assets/celestial/images/Sun.png',
    Moon: 'assets/celestial/images/Moon.png',
    Mercury: 'assets/celestial/images/Mercury.png',
    Venus: 'assets/celestial/images/Venus.png',
    Earth: 'assets/celestial/images/earth.svg',
    Mars: 'assets/celestial/images/Mars.png',
    Jupiter: 'assets/celestial/images/Jupiter.png',
    Saturn: 'assets/celestial/images/Saturn.png',
    Uranus: 'assets/celestial/images/Uranus.png',
    Neptune: 'assets/celestial/images/Neptune.png'
  };
  var DSO_IMAGE = {
    Andromeda: 'assets/celestial/images/Andromeda.png',
    'M31': 'assets/celestial/images/Andromeda.png',
    Sombrero: 'assets/celestial/images/Sombrero.png',
    'M104': 'assets/celestial/images/Sombrero.png',
    Triangulum: 'assets/celestial/images/Triangulum.png',
    'M33': 'assets/celestial/images/Triangulum.png',
    Pinwheel: 'assets/celestial/images/Pinwheel.png',
    'M101': 'assets/celestial/images/Pinwheel.png'
  };
  var searchSheet = document.getElementById('search-sheet');
  var layersSheet = document.getElementById('layers-sheet');
  var searchOpen = document.getElementById('search-open');
  var searchClose = document.getElementById('search-close');
  var layersOpen = document.getElementById('layers-open');
  var layersClose = document.getElementById('layers-close');
  var menuBtn = document.getElementById('menu-btn');
  var tabBar = document.getElementById('tab-bar');
  var pendingObject = null;

  var PLANET_NAMES = {
    Soleil: 'Sun',
    Lune: 'Moon',
    Mercure: 'Mercury',
    'Vénus': 'Venus',
    Saturne: 'Saturn'
  };
  var AIM_SMOOTH_SECONDS = 0.09;
  var CARDINALS = [
    { az: 0, label: 'N' },
    { az: 45, label: 'NE' },
    { az: 90, label: 'E' },
    { az: 135, label: 'SE' },
    { az: 180, label: 'S' },
    { az: 225, label: 'SW' },
    { az: 270, label: 'W' },
    { az: 315, label: 'NW' }
  ];
  var statusHideTimer = 0;
  var currentTab = 'learn';
  var locationStarted = false;
  var astroReady = false;

  var engine = null;
  var horizonOn = false;
  var pointingOn = false;
  var liveTime = true;
  var sawAbsoluteOrientation = false;
  var watchId = null;
  var searchIndex = [];
  var aimTarget = null;
  var aimView = null;
  var aimFrame = 0;
  var lastAimTime = 0;
  var lastGuideTime = 0;
  var guideLock = null;
  var guideLockKey = '';
  var guideSentence = '';
  var guideDismissed = false;
  var objectSheetUserClosed = false;
  var viewLocked = false;
  var planetDeckIndex = -1;
  var planetDeckSyncing = false;
  var planetDeckScrollTimer = 0;
  var gridOn = false;
  var linesOn = true;
  var milkyOn = true;
  var atmosphereOn = true;
  var dsosOn = true;
  var nightMode = false;
  var landscapeAtmosHintShown = false;
  var autoPointTriggered = false;
  var skyTiltMs = 0;
  var lastTiltSample = 0;
  var SKY_TILT_ALT = 28;
  var SKY_TILT_HOLD_MS = 700;
  var fovHudEl = null;
  var lastFovPaint = 0;
  var enterZoomTimer = 0;
  var objectRevealTimer = 0;

  function log(line) {
    if (!diagEl) return;
    diagEl.textContent += line + '\n';
  }

  function setStatus(text) {
    if (!statusEl) return;
    if (statusHideTimer) clearTimeout(statusHideTimer);
    if (!text) {
      statusEl.textContent = '';
      statusEl.classList.remove('is-visible');
      return;
    }
    // Keep Stellarium-like HUD quiet — short tips only.
    statusEl.textContent = text;
    statusEl.classList.add('is-visible');
    statusHideTimer = setTimeout(function () {
      statusEl.classList.remove('is-visible');
    }, 2800);
  }

  function formatClockText(date) {
    var d = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
    var hours = String(d.getHours()).padStart(2, '0');
    var minutes = String(d.getMinutes()).padStart(2, '0');
    return hours + ':' + minutes;
  }

  function setFocusTitle() {
    // Header always shows observer time. Object names use status / object sheet.
    if (focusTitleEl) focusTitleEl.textContent = formatClockText(currentObserverDate());
  }

  function planetImageSrc(name) {
    var key = PLANET_NAMES[name] || name;
    return PLANET_IMAGE[key] || 'assets/celestial/images/star-default.svg';
  }

  function loadPlanetSprites(eng) {
    if (!eng || typeof eng.setPlanetSprites !== 'function') return;
    var map = {};
    var pending = 0;
    var names = Object.keys(PLANET_IMAGE);
    function maybeDone() {
      if (pending > 0) return;
      eng.setPlanetSprites(map);
    }
    names.forEach(function (name) {
      var src = PLANET_IMAGE[name];
      if (!src || src.indexOf('.png') === -1) return;
      pending += 1;
      var img = new Image();
      img.decoding = 'async';
      img.onload = function () {
        map[name] = img;
        pending -= 1;
        maybeDone();
      };
      img.onerror = function () {
        pending -= 1;
        maybeDone();
      };
      img.src = src;
    });
    if (pending === 0) maybeDone();
  }

  function bodyImageSrc(obj) {
    if (!obj) return 'assets/celestial/images/star-default.svg';
    var name = obj.name || obj.n || '';
    if (isPlanetLike(obj) || PLANET_IMAGE[PLANET_NAMES[name] || name]) {
      return planetImageSrc(name);
    }
    if (DSO_IMAGE[name]) return DSO_IMAGE[name];
    var upper = String(name).toUpperCase();
    if (DSO_IMAGE[upper]) return DSO_IMAGE[upper];
    // Match catalogue labels like "M31 Andromeda"
    var keys = Object.keys(DSO_IMAGE);
    for (var i = 0; i < keys.length; i += 1) {
      if (String(name).toLowerCase().indexOf(keys[i].toLowerCase()) !== -1) {
        return DSO_IMAGE[keys[i]];
      }
    }
    if (window.__uniteCelestial && typeof window.__uniteCelestial.lookupSync === 'function') {
      var entry = window.__uniteCelestial.lookupSync(obj);
      if (entry && entry.image) return entry.image;
    }
    return 'assets/celestial/images/star-default.svg';
  }

  function openSheet(sheet) {
    // Search / layers should own the overlay — close the info card if it is open.
    if (objectEl && !objectEl.hidden) {
      hideObjectSheet();
      setViewLocked(false);
    }
    if (searchSheet) searchSheet.hidden = sheet !== searchSheet;
    if (layersSheet) layersSheet.hidden = sheet !== layersSheet;
    if (sheet === searchSheet && searchInput) {
      setTimeout(function () { searchInput.focus(); }, 50);
    }
  }

  function closeSheets() {
    if (searchSheet) searchSheet.hidden = true;
    if (layersSheet) layersSheet.hidden = true;
  }

  function setTabActive(tab) {
    currentTab = tab;
    if (!tabBar) return;
    var buttons = tabBar.querySelectorAll('.tab-btn');
    for (var i = 0; i < buttons.length; i += 1) {
      var active = buttons[i].getAttribute('data-tab') === tab;
      buttons[i].classList.toggle('is-active', active);
      buttons[i].setAttribute('aria-current', active ? 'page' : 'false');
    }
  }

  function forceSkyResize() {
    if (!engine || !engine.cv) return;
    var canvas = engine.cv;
    // While #astro-mode was display:none the canvas can be 0×0 — size from the viewport.
    var w = Math.max(canvas.clientWidth || 0, window.innerWidth || 0, 1);
    var h = Math.max(canvas.clientHeight || 0, window.innerHeight || 0, 1);
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    engine.dpr = dpr;
    window.dispatchEvent(new Event('resize'));
  }

  function ensureSkyVisible() {
    if (!engine) return;
    if (!Number.isFinite(engine.cam.fov) || engine.cam.fov < 8) {
      engine.cam.fov = DEFAULT_SKY_FOV;
    }
    engine.set('labels', true);
    engine.set('planets', true);
    engine.set('constellations', linesOn);
    engine.set('conLabels', linesOn);
    engine.set('nearConstellations', 5);
  }

  function enterAstroWalk(hint) {
    document.body.classList.remove('astro-enter', 'astro-enter-active');
    document.body.classList.add('mode-astro');
    // Soft enter without leaving opacity stuck at 0 on some WebViews.
    var mode = document.getElementById('astro-mode');
    if (mode) {
      mode.classList.remove('is-entering', 'is-visible');
      void mode.offsetWidth;
      mode.classList.add('is-entering');
      window.requestAnimationFrame(function () {
        mode.classList.add('is-visible');
      });
      window.setTimeout(function () {
        mode.classList.remove('is-entering');
      }, 480);
    }
    setTabActive('sky');
    closeSheets();
    setViewLocked(false);
    autoPointTriggered = false;
    skyTiltMs = 0;
    lastTiltSample = 0;
    objectSheetUserClosed = false;
    forceSkyResize();
    window.setTimeout(forceSkyResize, 40);
    window.setTimeout(forceSkyResize, 200);
    ensureSkyVisible();
    setFocusTitle();
    if (!locationStarted) {
      locationStarted = true;
      useMyLocation();
    } else if (!horizonOn) {
      var observer = readObserver();
      if (observer) {
        applyHorizon(observer.lat, observer.lon, observer.date);
        engine.lookAtAltAz(180, 40, ENTER_START_FOV);
      }
    }
    playEnterZoomOut();
    if (hint) setStatus('Guiding to ' + hint + '…');
    else setStatus('');
  }

  function exitAstroWalk() {
    if (pointingOn) setPointing(false);
    setViewLocked(false);
    if (enterZoomTimer) {
      window.clearTimeout(enterZoomTimer);
      enterZoomTimer = 0;
    }
    closeSheets();
    hideObjectSheet();
    autoPointTriggered = false;
    skyTiltMs = 0;
    objectSheetUserClosed = false;
    var mode = document.getElementById('astro-mode');
    if (mode) mode.classList.remove('is-entering', 'is-visible');
    document.body.classList.remove('mode-astro', 'astro-enter', 'astro-enter-active');
    setTabActive('home');
    setFocusTitle();
  }

  function playEnterZoomOut() {
    if (!engine) return;
    if (enterZoomTimer) {
      window.clearTimeout(enterZoomTimer);
      enterZoomTimer = 0;
    }
    var yaw = Number.isFinite(engine.cam.yaw) ? engine.cam.yaw : 180;
    var pitch = Math.max(28, Number.isFinite(engine.cam.pitch) ? engine.cam.pitch : 40);
    engine.lookAtAltAz(yaw, pitch, ENTER_START_FOV);
    // Let the canvas settle after tab layout, then ease out to the wide sky.
    enterZoomTimer = window.setTimeout(function () {
      enterZoomTimer = 0;
      if (!engine || !document.body.classList.contains('mode-astro')) return;
      if (viewLocked || pointingOn) return;
      engine.flyTo(yaw, pitch, DEFAULT_SKY_FOV, 1100);
    }, 90);
  }

  function setViewLocked(on) {
    viewLocked = !!on;
    if (engine) {
      engine.viewLocked = viewLocked;
      if (viewLocked) {
        engine.vel.yaw = 0;
        engine.vel.pitch = 0;
      } else if (!pendingObject) {
        engine.focusTarget = null;
      }
    }
  }

  function focusFovFor(obj) {
    if (!obj) return 26;
    var name = obj.name || obj.n || '';
    if (name === 'Sun' || name === 'Soleil') return FOCUS_FOV.sun;
    if (name === 'Moon' || name === 'Lune') return FOCUS_FOV.moon;
    if (Number.isFinite(obj.fov) && obj.type !== 'planet') return obj.fov;
    var type = obj.type || 'star';
    if (type === 'étoile' || type === 'etoile') return FOCUS_FOV.star;
    if (type === 'planet') return FOCUS_FOV.planet;
    return FOCUS_FOV[type] || 26;
  }

  function syncFocusRing(obj) {
    if (!engine) return;
    if (!obj || !Number.isFinite(obj.ra) || !Number.isFinite(obj.dec)) {
      engine.focusTarget = null;
      return;
    }
    var ra = obj.ra;
    var dec = obj.dec;
    var name = obj.name || obj.n || '';
    if ((obj.type === 'planet' || name === 'Sun' || name === 'Moon') && engine.planetPos) {
      for (var i = 0; i < engine.planetPos.length; i += 1) {
        var pl = engine.planetPos[i];
        if (pl.n === name || pl.n === (PLANET_NAMES[name] || name)) {
          ra = pl.ra;
          dec = pl.dec;
          name = pl.n;
          break;
        }
      }
    }
    engine.focusTarget = { ra: ra, dec: dec, name: name };
  }

  function strokeEllipse(ctx, rx, ry) {
    ctx.beginPath();
    if (typeof ctx.ellipse === 'function') {
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    } else {
      ctx.save();
      ctx.scale(1, ry / rx);
      ctx.arc(0, 0, rx, 0, Math.PI * 2);
      ctx.restore();
    }
    ctx.stroke();
  }

  function drawFocusRing(ctx, eng) {
    var t = eng.focusTarget;
    if (!t || !Number.isFinite(t.ra) || !Number.isFinite(t.dec)) return;
    // Keep planets live under the ring
    if (t.name && eng.planetPos) {
      for (var i = 0; i < eng.planetPos.length; i += 1) {
        if (eng.planetPos[i].n === t.name) {
          t.ra = eng.planetPos[i].ra;
          t.dec = eng.planetPos[i].dec;
          break;
        }
      }
    }
    var pr = eng.project(t.ra, t.dec);
    if (!pr.visible) return;
    var x = pr.x * eng.dpr;
    var y = pr.y * eng.dpr;
    var rx = Math.max(14, 22 * eng.dpr * Math.sqrt(70 / eng.cam.fov));
    var ry = rx * 0.72;
    var pulse = 1 + 0.06 * Math.sin(Date.now() / 420);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(pulse, pulse);
    ctx.strokeStyle = nightMode ? 'rgba(255,140,110,0.75)' : 'rgba(120,180,255,0.8)';
    ctx.lineWidth = Math.max(1.2, 1.6 * eng.dpr);
    strokeEllipse(ctx, rx, ry);
    ctx.strokeStyle = nightMode ? 'rgba(255,140,110,0.25)' : 'rgba(120,180,255,0.28)';
    ctx.lineWidth = Math.max(2.5, 3.2 * eng.dpr);
    strokeEllipse(ctx, rx * 1.35, ry * 1.35);
    ctx.restore();
  }

  /** Lock pan and fly so the target sits at screen center, zoomed in. */
  function lockAndFocusObject(obj, durationMs, opts) {
    if (!engine || !obj) return;
    var ra = obj.ra;
    var dec = obj.dec;
    if (obj.type === 'planet' && engine.planetPos) {
      for (var p = 0; p < engine.planetPos.length; p += 1) {
        if (engine.planetPos[p].n === (obj.name || obj.n) ||
            engine.planetPos[p].n === (PLANET_NAMES[obj.name || obj.n] || obj.name || obj.n)) {
          ra = engine.planetPos[p].ra;
          dec = engine.planetPos[p].dec;
          break;
        }
      }
    }
    if (!Number.isFinite(ra) || !Number.isFinite(dec)) return;
    if (pointingOn) setPointing(false);
    setViewLocked(true);
    syncFocusRing(Object.assign({}, obj, { ra: ra, dec: dec }));
    var fov = focusFovFor(obj);
    var ms = Number.isFinite(durationMs) ? durationMs : FOCUS_FLY_MS;
    var sheetOpen = objectEl && !objectEl.hidden;
    var clearCard = (opts && opts.clearCard) || sheetOpen;
    var offset = clearCard ? Math.max(4, Math.min(12, fov * 0.15)) : 0;
    if (horizonOn) {
      var horizontal = raDecToAltAz(ra, dec, Number(latInput.value), Number(lonInput.value), currentObserverDate());
      var alt = Math.max(-89, Math.min(89, horizontal.alt - offset));
      engine.flyTo(horizontal.az, alt, fov, ms);
    } else {
      engine.flyTo(ra, Math.max(-89, Math.min(89, dec - offset)), fov, ms);
    }
  }

  function openKnowMoreForPending() {
    if (!pendingObject) return;
    if (window.__uniteCelestial && typeof window.__uniteCelestial.openKnowMore === 'function') {
      window.__uniteCelestial.openKnowMore(pendingObject);
    }
  }

  function bindKnowMoreDrag() {
    if (!objectKnowHandle) return;
    var startX = 0;
    var startY = 0;
    var tracking = false;

    function resetHandle() {
      objectKnowHandle.classList.remove('is-pulling');
      tracking = false;
    }

    function onStart(event) {
      if (!pendingObject) return;
      var point = event.touches ? event.touches[0] : event;
      if (!point) return;
      tracking = true;
      startX = point.clientX;
      startY = point.clientY;
      objectKnowHandle.classList.add('is-pulling');
      if (event.cancelable) event.preventDefault();
    }

    function onMove(event) {
      if (!tracking) return;
      var point = event.touches ? event.touches[0] : event;
      if (!point) return;
      var dy = startY - point.clientY;
      var dx = Math.abs(point.clientX - startX);
      if (dy > 28) objectKnowHandle.classList.add('is-pulling');
      if (dy > 70 && dy > dx * 1.25) {
        resetHandle();
        openKnowMoreForPending();
      }
      if (event.cancelable) event.preventDefault();
    }

    function onEnd() {
      resetHandle();
    }

    objectKnowHandle.addEventListener('touchstart', onStart, { passive: false });
    objectKnowHandle.addEventListener('touchmove', onMove, { passive: false });
    objectKnowHandle.addEventListener('touchend', onEnd);
    objectKnowHandle.addEventListener('touchcancel', onEnd);
    objectKnowHandle.addEventListener('mousedown', onStart);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    objectKnowHandle.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openKnowMoreForPending();
      }
    });
  }

  function syncAstroCardClass() {
    var open = !!(objectEl && !objectEl.hidden && objectEl.classList.contains('is-open'));
    document.body.classList.toggle('astro-card-open', open);
    document.body.classList.toggle(
      'astro-planet-card',
      open && !!(objectEl && objectEl.classList.contains('is-planet-mode'))
    );
  }

  function hideObjectSheet() {
    if (objectRevealTimer) {
      window.clearTimeout(objectRevealTimer);
      objectRevealTimer = 0;
    }
    if (objectEl) {
      objectEl.classList.remove('is-open', 'is-planet-mode');
      objectEl.hidden = true;
    }
    if (objectPlanetDeckEl) objectPlanetDeckEl.hidden = true;
    if (objectSwipeHintEl) objectSwipeHintEl.hidden = true;
    if (objectPagerEl) {
      objectPagerEl.hidden = true;
      objectPagerEl.replaceChildren();
    }
    syncAstroCardClass();
  }

  function showObjectSheet() {
    if (!pendingObject) return;
    objectSheetUserClosed = false;
    renderObject(pendingObject);
    if (objectEl) {
      objectEl.hidden = false;
      window.requestAnimationFrame(function () {
        objectEl.classList.add('is-open');
        syncAstroCardClass();
      });
    } else {
      syncAstroCardClass();
    }
  }

  function scheduleObjectSheet(ms) {
    if (objectRevealTimer) window.clearTimeout(objectRevealTimer);
    if (pendingObject) {
      document.body.classList.add('astro-card-open');
      document.body.classList.toggle('astro-planet-card', isPlanetLike(pendingObject));
    }
    var delay = Math.max(240, Math.round((Number.isFinite(ms) ? ms : FOCUS_FLY_MS) * 0.58));
    objectRevealTimer = window.setTimeout(function () {
      objectRevealTimer = 0;
      if (!pendingObject || objectSheetUserClosed) return;
      showObjectSheet();
    }, delay);
  }

  function isPlanetLike(obj) {
    if (!obj) return false;
    if (obj.type === 'planet') return true;
    var name = String(obj.name || obj.n || '');
    var english = PLANET_NAMES[name] || name;
    var list = listSolarBodies();
    for (var i = 0; i < list.length; i += 1) {
      if (list[i].name === english || list[i].name === name) return true;
    }
    return false;
  }

  function listSolarBodies() {
    if (!engine || !engine.planetPos) return [];
    return engine.planetPos.map(function (planet) {
      var name = PLANET_NAMES[planet.n] || planet.n;
      return {
        type: 'planet',
        name: name,
        n: name,
        ra: planet.ra,
        dec: planet.dec,
        sym: planet.sym,
        color: planet.color,
        fov: FOCUS_FOV.planet
      };
    });
  }

  function solarBodyIndex(obj) {
    var list = listSolarBodies();
    var name = PLANET_NAMES[obj.name || obj.n] || obj.name || obj.n;
    for (var i = 0; i < list.length; i += 1) {
      if (list[i].name === name) return i;
    }
    return -1;
  }

  function updatePlanetPager(index, total) {
    if (!objectPagerEl) return;
    objectPagerEl.replaceChildren();
    if (total < 2) {
      objectPagerEl.hidden = true;
      return;
    }
    objectPagerEl.hidden = false;
    for (var i = 0; i < total; i += 1) {
      var dot = document.createElement('span');
      if (i === index) dot.className = 'is-active';
      objectPagerEl.appendChild(dot);
    }
  }

  function buildPlanetDeck(selectedObj) {
    if (!objectPlanetDeckEl) return -1;
    var list = listSolarBodies();
    objectPlanetDeckEl.replaceChildren();
    list.forEach(function (planet) {
      var card = document.createElement('article');
      card.className = 'object-planet-card';
      card.setAttribute('role', 'group');
      card.setAttribute('aria-label', planet.name);
      card.innerHTML =
        '<div class="object-planet-card-head">' +
          '<img class="object-planet-card-img" src="' + planetImageSrc(planet.name) + '" alt="" width="48" height="48">' +
          '<div>' +
            '<h3>' + planet.name + '</h3>' +
            '<p>Solar System</p>' +
          '</div>' +
        '</div>' +
        '<dl class="object-planet-card-meta">' +
          '<dt>RA</dt><dd>' + formatValue('ra', planet.ra) + '</dd>' +
          '<dt>Dec</dt><dd>' + formatValue('dec', planet.dec) + '</dd>' +
        '</dl>';
      objectPlanetDeckEl.appendChild(card);
    });
    objectPlanetDeckEl.hidden = list.length === 0;
    if (objectSwipeHintEl) objectSwipeHintEl.hidden = list.length < 2;
    var index = solarBodyIndex(selectedObj);
    if (index < 0) index = 0;
    updatePlanetPager(index, list.length);
    return index;
  }

  function scrollPlanetDeckTo(index, smooth) {
    if (!objectPlanetDeckEl) return;
    var card = objectPlanetDeckEl.children[index];
    if (!card) return;
    planetDeckSyncing = true;
    card.scrollIntoView({
      behavior: smooth ? 'smooth' : 'auto',
      inline: 'center',
      block: 'nearest'
    });
    window.setTimeout(function () { planetDeckSyncing = false; }, smooth ? 420 : 80);
  }

  function nearestPlanetDeckIndex() {
    if (!objectPlanetDeckEl || !objectPlanetDeckEl.children.length) return -1;
    var deckRect = objectPlanetDeckEl.getBoundingClientRect();
    var center = deckRect.left + deckRect.width / 2;
    var best = 0;
    var bestDist = Infinity;
    for (var i = 0; i < objectPlanetDeckEl.children.length; i += 1) {
      var rect = objectPlanetDeckEl.children[i].getBoundingClientRect();
      var mid = rect.left + rect.width / 2;
      var dist = Math.abs(mid - center);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    return best;
  }

  function focusSolarBodyAt(index, fly) {
    var list = listSolarBodies();
    if (!list.length) return;
    var i = ((index % list.length) + list.length) % list.length;
    var focused = list[i];
    planetDeckIndex = i;
    setPendingObject(focused);
    setFocusTitle();
    if (objectTitleEl) objectTitleEl.textContent = focused.name;
    updatePlanetPager(i, list.length);
    if (fly !== false) lockAndFocusObject(focused, PLANET_FLY_MS, { clearCard: true });
    setStatus(focused.name);
  }

  function onPlanetDeckScroll() {
    if (planetDeckSyncing || !objectPlanetDeckEl || objectPlanetDeckEl.hidden) return;
    if (planetDeckScrollTimer) window.clearTimeout(planetDeckScrollTimer);
    planetDeckScrollTimer = window.setTimeout(function () {
      planetDeckScrollTimer = 0;
      var index = nearestPlanetDeckIndex();
      if (index < 0 || index === planetDeckIndex) {
        updatePlanetPager(index, objectPlanetDeckEl.children.length);
        return;
      }
      focusSolarBodyAt(index, true);
    }, 90);
  }

  function setObjectPlanetMode(on) {
    if (!objectEl) return;
    objectEl.classList.toggle('is-planet-mode', !!on);
    if (!on) {
      if (objectPlanetDeckEl) {
        objectPlanetDeckEl.hidden = true;
        objectPlanetDeckEl.replaceChildren();
      }
      if (objectSwipeHintEl) objectSwipeHintEl.hidden = true;
      if (objectPagerEl) {
        objectPagerEl.hidden = true;
        objectPagerEl.replaceChildren();
      }
      planetDeckIndex = -1;
    }
  }

  /** Info card stays off until the user taps the info button. */
  function openObjectSheetFromInfoButton() {
    if (!pendingObject) {
      setStatus('Select a star or planet first.');
      return;
    }
    showObjectSheet();
    lockAndFocusObject(pendingObject, 520, { clearCard: true });
  }

  function dismissObjectSheet() {
    objectSheetUserClosed = true;
    guideDismissed = true;
    hideObjectSheet();
    setViewLocked(false);
    if (metaEl) metaEl.replaceChildren();
    if (objectNoteEl) {
      objectNoteEl.hidden = true;
      objectNoteEl.textContent = '';
    }
    if (objectThumbEl) objectThumbEl.hidden = true;
    if (!pointingOn) setFocusTitle();
  }

  function setToggleState(button, on) {
    if (!button) return;
    button.classList.toggle('is-on', !!on);
    button.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  function drawSkyGrid(ctx, eng) {
    if (!gridOn || !eng || typeof eng.project !== 'function') return;
    ctx.save();
    ctx.strokeStyle = nightMode ? 'rgba(255, 90, 70, 0.28)' : 'rgba(140, 180, 255, 0.26)';
    ctx.lineWidth = Math.max(1, (eng.dpr || 1) * 0.7);
    var ra;
    var dec;
    var step;
    // Meridians (RA)
    for (ra = 0; ra < 360; ra += 30) {
      ctx.beginPath();
      var started = false;
      for (dec = -80; dec <= 80; dec += 4) {
        var p = eng.project(ra, dec);
        if (!p || !p.visible) {
          started = false;
          continue;
        }
        var x = p.x * (eng.dpr || 1);
        var y = p.y * (eng.dpr || 1);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }
    // Parallels (Dec)
    for (dec = -60; dec <= 60; dec += 30) {
      ctx.beginPath();
      started = false;
      for (ra = 0; ra <= 360; ra += 4) {
        var q = eng.project(ra % 360, dec);
        if (!q || !q.visible) {
          started = false;
          continue;
        }
        var qx = q.x * (eng.dpr || 1);
        var qy = q.y * (eng.dpr || 1);
        if (!started) {
          ctx.moveTo(qx, qy);
          started = true;
        } else {
          ctx.lineTo(qx, qy);
        }
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function applyLines(on) {
    linesOn = !!on;
    if (engine) {
      engine.set('constellations', linesOn);
      engine.set('conLabels', linesOn);
      // Star / planet / DSO names stay on even if constellation lines are off.
      engine.set('labels', true);
      engine.set('planets', true);
    }
    setToggleState(toggleLinesBtn, linesOn);
  }

  function applyGrid(on) {
    gridOn = !!on;
    setToggleState(toggleGridBtn, gridOn);
  }

  function applyMilkyWay(on) {
    milkyOn = !!on;
    if (engine) engine.set('milkyway', milkyOn);
    setToggleState(toggleMilkyBtn, milkyOn);
  }

  function applyAtmosphere(on) {
    atmosphereOn = !!on;
    if (engine) engine.set('atmosphere', atmosphereOn);
    setToggleState(toggleAtmosphereBtn, atmosphereOn);
  }

  function applyDsos(on) {
    dsosOn = !!on;
    if (engine) engine.set('dsos', dsosOn);
    setToggleState(toggleDsosBtn, dsosOn);
  }

  function applyNightMode(on) {
    nightMode = !!on;
    document.body.classList.toggle('night-sky', nightMode);
    if (engine) {
      engine.set('bg', nightMode ? '#120202' : '#000000');
      engine.set('nightVision', nightMode);
    }
    setToggleState(toggleNightBtn, nightMode);
  }

  function zoomTowardObject(factor) {
    if (!engine || !pendingObject) return;
    var next = Math.max(8, Math.min(110, engine.cam.fov * factor));
    centerOnPending(next);
  }

  function centerOnPending(fov) {
    if (!engine || !pendingObject) return;
    var useFov = Number.isFinite(fov) ? fov : focusFovFor(pendingObject);
    var sheetOpen = objectEl && !objectEl.hidden;
    pendingObject.fov = useFov;
    if (sheetOpen) {
      lockAndFocusObject(pendingObject, 700);
      return;
    }
    var ra = pendingObject.ra;
    var dec = pendingObject.dec;
    if (!Number.isFinite(ra) || !Number.isFinite(dec)) return;
    if (pointingOn) setPointing(false);
    if (horizonOn) {
      var horizontal = raDecToAltAz(ra, dec, Number(latInput.value), Number(lonInput.value), currentObserverDate());
      engine.flyTo(horizontal.az, Math.max(-89, Math.min(89, horizontal.alt)), useFov, 700);
    } else {
      engine.flyTo(ra, dec, useFov, 700);
    }
  }

  /** Close overlays first; return true if something was closed. Leaving Astro Walk is handled by app.js. */
  function handleBack() {
    if (window.__uniteCelestial && typeof window.__uniteCelestial.handleBack === 'function') {
      if (window.__uniteCelestial.handleBack()) return true;
    }
    if (!document.body.classList.contains('mode-astro')) return false;
    if (searchSheet && !searchSheet.hidden) {
      closeSheets();
      return true;
    }
    if (layersSheet && !layersSheet.hidden) {
      closeSheets();
      return true;
    }
    if (objectEl && !objectEl.hidden) {
      dismissObjectSheet();
      return true;
    }
    return false;
  }

  function setPendingObject(obj) {
    var nextKey = obj
      ? ((obj.type || '') + '|' + (obj.name || obj.n || '') + '|' + (Number.isFinite(obj.ra) ? Math.round(obj.ra * 10) : ''))
      : '';
    var prevKey = pendingObject
      ? ((pendingObject.type || '') + '|' + (pendingObject.name || pendingObject.n || '') + '|' + (Number.isFinite(pendingObject.ra) ? Math.round(pendingObject.ra * 10) : ''))
      : '';
    if (nextKey && nextKey !== prevKey) objectSheetUserClosed = false;
    pendingObject = obj || null;
    if (objectOpenBtn) objectOpenBtn.hidden = !pendingObject;
    if (!pendingObject) {
      hideObjectSheet();
      if (engine) engine.focusTarget = null;
    } else {
      syncFocusRing(pendingObject);
    }
  }

  function updateFovHud() {
    if (!engine) return;
    if (!fovHudEl) fovHudEl = document.getElementById('fov-hud');
    if (!fovHudEl) return;
    var now = Date.now();
    if (now - lastFovPaint < 80) return;
    lastFovPaint = now;
    var fov = Math.round(engine.cam.fov);
    var yaw = ((engine.cam.yaw % 360) + 360) % 360;
    var pitch = engine.cam.pitch;
    var detail = horizonOn
      ? (fov + '° · Az ' + Math.round(yaw) + '° · Alt ' + Math.round(pitch) + '°')
      : (fov + '° · RA ' + yaw.toFixed(1) + '° · Dec ' + pitch.toFixed(1) + '°');
    if (fovHudTextEl) fovHudTextEl.textContent = detail;
    else fovHudEl.textContent = detail;
    // Highlight FOV icon while zoomed in / focus-locked (not at wide default)
    var fovActive = viewLocked || fov <= DEFAULT_SKY_FOV - 8;
    fovHudEl.classList.toggle('is-active', fovActive);
    fovHudEl.setAttribute('aria-pressed', fovActive ? 'true' : 'false');
  }

  function updateClock() {
    if (!focusTitleEl) return;
    focusTitleEl.textContent = formatClockText(currentObserverDate());
  }

  function updateCompass() {
    if (!engine) return;
    var yaw = ((engine.cam.yaw % 360) + 360) % 360;
    if (compassRoseEl) compassRoseEl.style.transform = 'rotate(' + (-yaw) + 'deg)';
    if (compassDegEl) {
      var best = CARDINALS[0];
      var bestDelta = 360;
      for (var i = 0; i < CARDINALS.length; i += 1) {
        var delta = Math.abs(((yaw - CARDINALS[i].az + 540) % 360) - 180);
        if (delta < bestDelta) {
          bestDelta = delta;
          best = CARDINALS[i];
        }
      }
      compassDegEl.textContent = Math.round(yaw) + '° ' + best.label;
    }
  }

  function maybeAutoPointFromTilt(aim) {
    if (!document.body.classList.contains('mode-astro')) return;
    if (pointingOn || autoPointTriggered) return;
    if (!aim || !Number.isFinite(aim.alt)) return;
    var now = Date.now();
    if (!lastTiltSample) lastTiltSample = now;
    var dt = Math.min(250, now - lastTiltSample);
    lastTiltSample = now;
    if (aim.alt >= SKY_TILT_ALT) skyTiltMs += dt;
    else skyTiltMs = 0;
    if (skyTiltMs < SKY_TILT_HOLD_MS) return;
    autoPointTriggered = true;
    skyTiltMs = 0;
    setStatus('Sky detected — activating GPS and pointing…');
    if (!horizonOn) useMyLocation();
    else enablePointing();
    if (!pointingOn) {
      window.setTimeout(function () {
        if (!pointingOn) enablePointing();
      }, 600);
    }
  }

  function fail(error) {
    var message = error && error.message ? error.message : String(error);
    setStatus('The sky viewer hit an error. Open Layers for diagnostics.');
    if (diagEl) diagEl.classList.add('is-error');
    log(message);
  }

  function formatValue(key, value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      if (key === 'ra' || key === 'dec' || key === 'mag' || key === 'bv') {
        return value.toFixed(2);
      }
    }
    return String(value);
  }

  function hasValue(value) {
    return value !== undefined && value !== null && value !== '';
  }

  function updateHorizonButton() {
    if (!horizonButton) return;
    setToggleState(horizonButton, horizonOn);
  }

  function updatePointButton() {
    if (!pointButton) return;
    pointButton.setAttribute('aria-pressed', pointingOn ? 'true' : 'false');
    pointButton.setAttribute('aria-label', pointingOn ? 'Stop pointing' : 'Point phone');
    pointButton.classList.toggle('is-active', pointingOn);
  }

  function raDecToAltAz(ra, dec, lat, lon, date) {
    var day = date.getTime() / 86400000 + 2440587.5 - 2451545.0;
    var lst = ((280.46061837 + 360.98564736629 * day + lon) % 360 + 360) % 360;
    var hourAngle = (lst - ra) * Math.PI / 180;
    var latRad = lat * Math.PI / 180;
    var decRad = dec * Math.PI / 180;
    var sinAlt = Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.cos(hourAngle);
    sinAlt = Math.max(-1, Math.min(1, sinAlt));
    var alt = Math.asin(sinAlt);
    var cosAlt = Math.cos(alt);
    if (Math.abs(cosAlt) < 1e-6) return { az: 0, alt: alt * 180 / Math.PI };
    var sinAz = -Math.cos(decRad) * Math.sin(hourAngle) / cosAlt;
    var cosAz = (Math.sin(decRad) - Math.sin(alt) * Math.sin(latRad)) / (cosAlt * Math.cos(latRad));
    var az = Math.atan2(sinAz, cosAz) * 180 / Math.PI;
    return { az: (az + 360) % 360, alt: alt * 180 / Math.PI };
  }

  function currentObserverDate() {
    if (!liveTime && whenInput.value) {
      var chosen = new Date(whenInput.value);
      if (!Number.isNaN(chosen.getTime())) return chosen;
    }
    return new Date();
  }

  function applyHorizon(lat, lon, date) {
    engine.setHorizon(lat, lon, date);
    engine.setDate(date || new Date());
    horizonOn = true;
    updateHorizonButton();
    latInput.value = String(Math.round(lat * 10000) / 10000);
    lonInput.value = String(Math.round(lon * 10000) / 10000);
    if (!landscapeAtmosHintShown && atmosphereOn && engine._sunBody) {
      var sunHz = raDecToAltAz(engine._sunBody.ra, engine._sunBody.dec, lat, lon, date || new Date());
      if (sunHz.alt < -12) {
        landscapeAtmosHintShown = true;
        setStatus('Atmosphere on · astronomical night');
      }
    }
  }

  function setPointing(on) {
    pointingOn = on;
    engine.arActive = on;
    engine.vel.yaw = 0;
    engine.vel.pitch = 0;
    updatePointButton();
    if (reticleEl) reticleEl.hidden = !on;
    if (on) {
      setViewLocked(false);
      hideObjectSheet();
      aimTarget = null;
      aimView = null;
      lastAimTime = 0;
      guideLock = null;
      guideLockKey = '';
      guideSentence = '';
      guideDismissed = false;
      if (!aimFrame) aimFrame = requestAnimationFrame(stepAim);
      return;
    }
    if (aimFrame) cancelAnimationFrame(aimFrame);
    aimFrame = 0;
    if (objectTitleEl) objectTitleEl.textContent = 'Selected object';
  }

  function orientationToAltAz(event) {
    if (event.beta == null) return null;
    var alpha = event.alpha;
    if (event.webkitCompassHeading != null) alpha = (360 - event.webkitCompassHeading) % 360;
    if (alpha == null || event.gamma == null) {
      var heading = event.webkitCompassHeading != null
        ? event.webkitCompassHeading
        : (event.alpha != null ? (360 - event.alpha) % 360 : null);
      if (heading == null) return null;
      return { az: (heading + 360) % 360, alt: event.beta - 90 };
    }
    var rad = Math.PI / 180;
    var z = alpha * rad;
    var x = event.beta * rad;
    var y = event.gamma * rad;
    var cX = Math.cos(x);
    var cY = Math.cos(y);
    var cZ = Math.cos(z);
    var sX = Math.sin(x);
    var sY = Math.sin(y);
    var sZ = Math.sin(z);
    var east = -(cY * sZ * sX + cZ * sY);
    var north = -(sZ * sY - cZ * sX * cY);
    var up = -(cX * cY);
    var alt = Math.asin(Math.max(-1, Math.min(1, up))) / rad;
    var az = (Math.atan2(east, north) / rad + 360) % 360;
    return { az: az, alt: alt };
  }

  function onDeviceOrientation(event) {
    if (event.absolute) sawAbsoluteOrientation = true;
    if (sawAbsoluteOrientation && !event.absolute && event.webkitCompassHeading == null) return;
    var aim = orientationToAltAz(event);
    if (!aim) return;
    maybeAutoPointFromTilt(aim);
    if (!pointingOn || !horizonOn || !engine) return;
    aimTarget = aim;
  }

  function stepAim(now) {
    aimFrame = 0;
    if (!pointingOn || !engine) return;
    if (aimTarget && horizonOn) {
      var dt = lastAimTime ? Math.min(0.05, (now - lastAimTime) / 1000) : 0.016;
      lastAimTime = now;
      var targetAlt = Math.max(-89, Math.min(89, aimTarget.alt));
      if (!aimView) {
        aimView = { az: aimTarget.az, alt: targetAlt };
      } else {
        var blend = 1 - Math.exp(-dt / AIM_SMOOTH_SECONDS);
        var deltaAz = ((aimTarget.az - aimView.az + 540) % 360) - 180;
        aimView.az = (aimView.az + deltaAz * blend + 360) % 360;
        aimView.alt += (targetAlt - aimView.alt) * blend;
        aimView.alt = Math.max(-89, Math.min(89, aimView.alt));
      }
      engine.lookAtAltAz(aimView.az, aimView.alt);
      if (now - lastGuideTime > 120) {
        lastGuideTime = now;
        updateGuide();
      }
    }
    aimFrame = requestAnimationFrame(stepAim);
  }

  function displayName(obj) {
    var raw = obj.name || obj.n || '';
    if (PLANET_NAMES[raw]) return PLANET_NAMES[raw];
    if (raw) return raw;
    if (obj.type === 'star' && hasValue(obj.mag)) return 'a magnitude ' + Number(obj.mag).toFixed(1) + ' star';
    return 'this object';
  }

  function nearestAimedObject() {
    var canvas = engine.cv;
    var center = engine.unproject(canvas.clientWidth / 2, canvas.clientHeight / 2);
    var best = null;
    function consider(obj) {
      if (!Number.isFinite(obj.ra) || !Number.isFinite(obj.dec)) return;
      var dist = SkyEngine.angularDist(center.ra, center.dec, obj.ra, obj.dec);
      if (!best || dist < best.dist) best = { obj: obj, dist: dist };
    }
    var stars = SKY.stars;
    var names = SKY.names || {};
    for (var i = 0; i < stars.length; i += 1) {
      var starName = names[i] || names[String(i)] || null;
      if (!starName && stars[i][2] > 3.2) continue;
      consider({
        type: 'star',
        i: i,
        name: starName,
        ra: stars[i][0],
        dec: stars[i][1],
        mag: stars[i][2],
        bv: stars[i][3]
      });
    }
    if (engine.planetPos) {
      engine.planetPos.forEach(function (planet) {
        var english = PLANET_NAMES[planet.n] || planet.n;
        consider({ type: 'planet', name: english, n: english, ra: planet.ra, dec: planet.dec, sym: planet.sym });
      });
    }
    if (SKY.dsos) {
      SKY.dsos.forEach(function (dso) {
        consider({
          type: 'dso',
          name: dso.n,
          n: dso.n,
          id: dso.id,
          ra: dso.ra,
          dec: dso.dec,
          t: dso.t
        });
      });
    }
    if (guideLock) {
      var lockedDist = SkyEngine.angularDist(center.ra, center.dec, guideLock.ra, guideLock.dec);
      if (lockedDist < 18 && (!best || best.dist + 0.8 > lockedDist)) {
        best = { obj: guideLock.obj, dist: lockedDist };
      }
    }
    if (best) guideLock = { obj: best.obj, ra: best.obj.ra, dec: best.obj.dec };
    return best;
  }

  function aimDirection(obj) {
    var canvas = engine.cv;
    var projected = engine.project(obj.ra, obj.dec);
    if (!projected || !projected.visible) return null;
    var dx = projected.x - canvas.clientWidth / 2;
    var dy = projected.y - canvas.clientHeight / 2;
    var parts = [];
    if (dy < -28) parts.push('up');
    else if (dy > 28) parts.push('down');
    if (dx > 28) parts.push('to the right');
    else if (dx < -28) parts.push('to the left');
    if (!parts.length) return 'in the center';
    return parts.join(' and ');
  }

  function updateGuide() {
    var aimed = nearestAimedObject();
    if (!aimed || aimed.dist > 35) {
      guideLock = null;
      if (pointingOn) setFocusTitle();
      guideSentence = '';
      return;
    }
    var name = displayName(aimed.obj);
    setFocusTitle();
    guideSentence = name;
    var key = (aimed.obj.type || '') + '|' + name + '|' + Math.round(aimed.obj.ra * 10);
    var changed = key !== guideLockKey;
    if (changed) {
      guideLockKey = key;
      guideDismissed = false;
    }
    if (aimed.dist < 8) {
      // Keep card closed; only reveal the info icon until the user taps it.
      setPendingObject(aimed.obj);
      if (objectEl && !objectEl.hidden && !objectSheetUserClosed) {
        objectTitleEl.textContent = displayName(aimed.obj);
        renderObject(aimed.obj);
      }
    }
  }

  function startSensorsIfAllowed() {
    // Do not force AR pointing on cold start — a flat phone aims at the ground
    // and horizon culling makes the sky look empty. Tilt-to-sky enables pointing.
    if (pointingOn) return;
  }

  function enablePointing() {
    if (typeof window.DeviceOrientationEvent === 'undefined') {
      setStatus('This device did not provide a compass, so drag the sky instead.');
      log('Device orientation is unavailable.');
      return;
    }
    var attach = function () {
      setPointing(true);
      setStatus('');
      log('Pointing on.');
    };
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission()
        .then(function (state) {
          if (state === 'granted') attach();
          else setStatus('Motion permission was denied. Drag the sky instead.');
        })
        .catch(function () {
          setStatus('Motion permission was denied. Drag the sky instead.');
        });
      return;
    }
    attach();
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setStatus('This device has no location service. Enter latitude and longitude.');
      log('Geolocation is unavailable.');
      return;
    }
    setStatus('Finding your location…');
    navigator.geolocation.getCurrentPosition(function (position) {
      var lat = position.coords.latitude;
      var lon = position.coords.longitude;
      liveTime = true;
      whenInput.value = '';
      applyHorizon(lat, lon, new Date());
      if (!pointingOn && !viewLocked) {
        var inAstro = document.body.classList.contains('mode-astro');
        engine.lookAtAltAz(180, 40, inAstro ? ENTER_START_FOV : DEFAULT_SKY_FOV);
        if (inAstro) playEnterZoomOut();
      }
      setStatus('Sky locked to your location.');
      log('Location ' + lat.toFixed(4) + ', ' + lon.toFixed(4));
      startSensorsIfAllowed();
      if (watchId == null) {
        watchId = navigator.geolocation.watchPosition(function (next) {
          if (!horizonOn || !engine.geo) return;
          engine.geo.lat = next.coords.latitude;
          engine.geo.lon = next.coords.longitude;
          engine.setDate(currentObserverDate());
          latInput.value = String(Math.round(next.coords.latitude * 10000) / 10000);
          lonInput.value = String(Math.round(next.coords.longitude * 10000) / 10000);
        }, function () {}, { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 });
      }
    }, function () {
      setStatus('Location permission was denied. Enter latitude and longitude, then show the horizon.');
      log('Location request failed.');
      startSensorsIfAllowed();
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  }

  function clearResults() {
    resultsEl.replaceChildren();
    noResultsEl.hidden = true;
  }

  function filterCatalogue(query) {
    var needle = query.trim().toLowerCase();
    if (!needle) return [];
    var hits = [];
    for (var i = 0; i < searchIndex.length; i += 1) {
      var item = searchIndex[i];
      if (!item || typeof item.name !== 'string') continue;
      if (item.name.toLowerCase().indexOf(needle) === -1) continue;
      hits.push(item);
      if (hits.length === 12) break;
    }
    return hits;
  }

  function renderResults(query) {
    var hits = filterCatalogue(query);
    resultsEl.replaceChildren();
    if (!query.trim()) {
      noResultsEl.hidden = true;
      return;
    }
    noResultsEl.hidden = hits.length > 0;
    hits.forEach(function (item) {
      var li = document.createElement('li');
      var button = document.createElement('button');
      button.type = 'button';
      button.textContent = item.name + ' · ' + item.type;
      button.addEventListener('click', function () {
        flyToItem(item);
      });
      li.appendChild(button);
      resultsEl.appendChild(li);
    });
  }

  function flyToItem(item) {
    var ra = item.ra;
    var dec = item.dec;
    if (item.type === 'planet' && engine.planetPos) {
      for (var p = 0; p < engine.planetPos.length; p += 1) {
        if (engine.planetPos[p].n === item.name) {
          ra = engine.planetPos[p].ra;
          dec = engine.planetPos[p].dec;
          break;
        }
      }
    }
    if (!Number.isFinite(ra) || !Number.isFinite(dec)) {
      fail(new Error('Search result has no numeric coordinates.'));
      return;
    }
    var fov = Number.isFinite(item.fov) ? item.fov : focusFovFor(item);
    var focused = {
      type: item.type || 'star',
      name: item.name,
      n: item.name,
      ra: ra,
      dec: dec,
      mag: item.mag,
      sym: item.sym,
      id: item.id,
      t: item.t,
      fov: fov
    };
    setPendingObject(focused);
    setFocusTitle();
    var flyMs = isPlanetLike(focused) ? PLANET_FLY_MS : FOCUS_FLY_MS;
    objectSheetUserClosed = false;
    hideObjectSheet();
    lockAndFocusObject(focused, flyMs, { clearCard: true });
    scheduleObjectSheet(flyMs);
    setStatus(item.name);
    log('focus ' + item.name + ' ra ' + ra + ' dec ' + dec + ' fov ' + fov);
  }

  function updateObjectThumb(obj) {
    if (!objectThumbEl) return;
    objectThumbEl.src = bodyImageSrc(obj);
    objectThumbEl.hidden = false;
  }

  function renderObject(obj) {
    var planetMode = isPlanetLike(obj);
    setObjectPlanetMode(planetMode);

    if (planetMode) {
      var index = buildPlanetDeck(obj);
      planetDeckIndex = index;
      if (objectTitleEl) objectTitleEl.textContent = displayName(obj);
      updateObjectThumb(obj);
      window.requestAnimationFrame(function () {
        scrollPlanetDeckTo(index, false);
      });
      return;
    }

    metaEl.replaceChildren();
    updateObjectThumb(obj);
    FIELDS.forEach(function (field) {
      var key = field[0];
      var label = field[1];
      if (!hasValue(obj[key])) return;
      if (key === 'n' && obj.name === obj.n) return;
      var dt = document.createElement('dt');
      var dd = document.createElement('dd');
      dt.textContent = label;
      dd.textContent = formatValue(key, obj[key]);
      metaEl.appendChild(dt);
      metaEl.appendChild(dd);
    });
    if (obj.type === 'star' && !hasValue(obj.name)) {
      var emptyDt = document.createElement('dt');
      var emptyDd = document.createElement('dd');
      emptyDt.textContent = 'Name';
      emptyDd.textContent = 'No name in this catalogue record';
      metaEl.appendChild(emptyDt);
      metaEl.appendChild(emptyDd);
    }

    objectNoteEl.hidden = true;
    objectNoteEl.textContent = '';
    if (obj.type === 'dso' && obj.id === M4_CATALOGUE_ID) {
      objectNoteEl.hidden = false;
      objectNoteEl.textContent = 'Catalogue RA may be wrong for M4 in this file.';
    }
    if (objectTitleEl) objectTitleEl.textContent = displayName(obj);
  }

  function readObserver() {
    var lat = Number(latInput.value);
    var lon = Number(lonInput.value);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) {
      return null;
    }
    var date = whenInput.value ? new Date(whenInput.value) : new Date();
    if (Number.isNaN(date.getTime())) return null;
    return { lat: lat, lon: lon, date: date };
  }

  function boot() {
    if (window.__skyAssetError) {
      throw new Error(window.__skyAssetError);
    }
    if (typeof SKY === 'undefined' || !SKY || !Array.isArray(SKY.stars) || typeof SkyEngine !== 'function') {
      throw new Error('Bundled SkyEngine scripts did not load from the local vendor folder.');
    }

    var canvas = document.getElementById('sky');
    if (!canvas) throw new Error('Sky canvas is missing.');

    engine = new SkyEngine(canvas, SKY, {
      conNameKey: 'e',
      planets: true,
      meteors: false,
      constellations: true,
      labels: true,
      conLabels: true,
      nearConstellations: 5,
      dsos: true,
      milkyway: true,
      atmosphere: true,
      nightVision: false,
      bg: '#000000',
      glBackdrop: false
    });
    engine.set('meteors', false);
    engine.set('labels', true);
    engine.set('conLabels', true);
    engine.set('planets', true);
    engine.set('nearConstellations', 5);
    engine.set('atmosphere', true);
    engine.set('milkyway', true);
    engine.set('dsos', true);
    engine.set('nightVision', false);
    engine.set('glBackdrop', false);
    engine.start();
    loadPlanetSprites(engine);
    forceSkyResize();
    searchIndex = engine.searchIndex();
    if (engine.planetPos) {
      var planetItems = engine.planetPos.map(function (planet) {
        return { name: planet.n, ra: planet.ra, dec: planet.dec, type: 'planet', fov: focusFovFor({ type: 'planet', name: planet.n }), sym: planet.sym };
      });
      searchIndex = planetItems.concat(searchIndex);
    }
    var planetBar = document.getElementById('planet-bar');
    if (planetBar && engine.planetPos) {
      engine.planetPos.forEach(function (planet) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'planet-chip';
        button.innerHTML =
          '<img src="' + planetImageSrc(planet.n) + '" alt="" width="28" height="28">' +
          '<span>' + planet.n + '</span>';
        button.addEventListener('click', function () {
          closeSheets();
          flyToItem({
            name: planet.n,
            ra: planet.ra,
            dec: planet.dec,
            type: 'planet',
            fov: focusFovFor({ type: 'planet', name: planet.n }),
            sym: planet.sym
          });
        });
        planetBar.appendChild(button);
      });
    }

    engine.onSelect = function (obj) {
      if (!obj || typeof obj !== 'object') return;
      var selectedName = displayName(obj);
      var focused = Object.assign({}, obj, {
        name: selectedName,
        fov: focusFovFor(obj)
      });
      setFocusTitle();
      setPendingObject(focused);
      var flyMs = isPlanetLike(focused) ? PLANET_FLY_MS : FOCUS_FLY_MS;
      objectSheetUserClosed = false;
      hideObjectSheet();
      lockAndFocusObject(focused, flyMs, { clearCard: true });
      scheduleObjectSheet(flyMs);
      setStatus(selectedName);
      log('Selected ' + (obj.name || obj.n || obj.type || 'object'));
    };

    engine.onViewUnlock = function () {
      viewLocked = false;
    };

    engine.addLayer('unite-grid', drawSkyGrid);
    engine.addLayer('unite-focus-ring', drawFocusRing);
    applyLines(true);
    applyGrid(false);
    applyMilkyWay(true);
    applyAtmosphere(true);
    applyDsos(true);
    applyNightMode(false);
    updateHorizonButton();
    engine.cam.fov = DEFAULT_SKY_FOV;

    if (searchOpen) searchOpen.addEventListener('click', function () { openSheet(searchSheet); });
    if (searchClose) searchClose.addEventListener('click', closeSheets);
    if (layersOpen) layersOpen.addEventListener('click', function () { openSheet(layersSheet); });
    if (layersClose) layersClose.addEventListener('click', closeSheets);
    if (objectPlanetDeckEl) {
      objectPlanetDeckEl.addEventListener('scroll', onPlanetDeckScroll, { passive: true });
      objectPlanetDeckEl.addEventListener('scrollend', onPlanetDeckScroll);
    }
    if (objectOpenBtn) {
      objectOpenBtn.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        openObjectSheetFromInfoButton();
      });
    }
    bindKnowMoreDrag();
    if (toggleGridBtn) {
      toggleGridBtn.addEventListener('click', function () {
        applyGrid(!gridOn);
      });
    }
    if (toggleLinesBtn) {
      toggleLinesBtn.addEventListener('click', function () {
        applyLines(!linesOn);
      });
    }
    if (toggleMilkyBtn) {
      toggleMilkyBtn.addEventListener('click', function () {
        applyMilkyWay(!milkyOn);
      });
    }
    if (toggleAtmosphereBtn) {
      toggleAtmosphereBtn.addEventListener('click', function () {
        applyAtmosphere(!atmosphereOn);
      });
    }
    if (toggleDsosBtn) {
      toggleDsosBtn.addEventListener('click', function () {
        applyDsos(!dsosOn);
      });
    }
    if (toggleNightBtn) {
      toggleNightBtn.addEventListener('click', function () {
        applyNightMode(!nightMode);
      });
    }
    if (menuBtn) {
      menuBtn.addEventListener('click', function () {
        exitAstroWalk();
        if (window.__uniteApp && typeof window.__uniteApp.showTab === 'function') {
          window.__uniteApp.showTab('home');
        }
      });
    }

    searchForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var hits = filterCatalogue(searchInput.value);
      if (hits.length === 1) {
        closeSheets();
        flyToItem(hits[0]);
      }
    });
    searchInput.addEventListener('input', function () {
      renderResults(searchInput.value);
    });

    resetButton.addEventListener('click', function () {
      liveTime = true;
      whenInput.value = '';
      if (pointingOn) setPointing(false);
      closeSheets();
      useMyLocation();
      log('reset to current location and time');
    });

    if (locateButton) {
      locateButton.addEventListener('click', function () {
        closeSheets();
        useMyLocation();
      });
    }

    function jumpToNow() {
      liveTime = true;
      whenInput.value = '';
      if (!horizonOn) {
        var observer = readObserver();
        if (!observer) return;
        applyHorizon(observer.lat, observer.lon, new Date());
        engine.lookAtAltAz(180, 35, DEFAULT_SKY_FOV);
      } else {
        engine.setDate(new Date());
      }
      updateClock();
      setStatus('Using the current time.');
      log('setDate now');
    }

    if (nowButton) nowButton.addEventListener('click', jumpToNow);
    if (nowFabBtn) nowFabBtn.addEventListener('click', jumpToNow);

    pointButton.addEventListener('click', function () {
      if (pointingOn) {
        setPointing(false);
        setFocusTitle();
        setStatus('');
        log('Pointing off.');
        return;
      }
      if (!horizonOn) {
        var observer = readObserver();
        if (!observer) {
          setStatus('Set location in Settings, then try again.');
          return;
        }
        applyHorizon(observer.lat, observer.lon, observer.date);
      }
      enablePointing();
    });

    window.addEventListener('deviceorientationabsolute', onDeviceOrientation, true);
    window.addEventListener('deviceorientation', onDeviceOrientation, true);
    updateClock();
    updateCompass();
    updateFovHud();
    setInterval(updateClock, 15000);
    setInterval(function () {
      updateCompass();
      updateFovHud();
    }, 100);
    setInterval(function () {
      if (!liveTime || !horizonOn || !engine) return;
      engine.setDate(new Date());
    }, 20000);

    horizonButton.addEventListener('click', function () {
      if (horizonOn) {
        if (pointingOn) setPointing(false);
        horizonOn = false;
        engine.setEquatorial();
        updateHorizonButton();
        setStatus('Equatorial star map.');
        log('setEquatorial');
        engine.flyTo(INITIAL_CAM.yaw, INITIAL_CAM.pitch, INITIAL_CAM.fov, 800);
        return;
      }
      var observer = readObserver();
      if (!observer) {
        setStatus('Enter latitude from -90 to 90 and longitude from -180 to 180.');
        log('Rejected observer coordinates.');
        return;
      }
      if (whenInput.value) liveTime = false;
      applyHorizon(observer.lat, observer.lon, observer.date);
      engine.lookAtAltAz(180, 35, DEFAULT_SKY_FOV);
      setStatus(liveTime
        ? 'Horizon view for this location at the current time.'
        : 'Horizon view for this location and time.');
      log('setHorizon ' + observer.lat + ', ' + observer.lon + ' at ' + observer.date.toISOString());
    });

    if (clearButton) {
      clearButton.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        dismissObjectSheet();
      }, true);
    }

    resultsEl.addEventListener('click', function () {
      closeSheets();
    }, true);

    astroReady = true;
    setTabActive('home');
    setFocusTitle();
    log('SkyEngine ' + (SkyEngine.VERSION || 'unknown') + ' started. Stars: ' + SKY.stars.length + '. Search index: ' + searchIndex.length + '.');

    window.__uniteSkyPoc = {
      engine: engine,
      catalogue: SKY,
      isHorizonOn: function () { return horizonOn; },
      isPointingOn: function () { return pointingOn; },
      enterAstroWalk: enterAstroWalk,
      exitAstroWalk: exitAstroWalk,
      handleBack: handleBack,
      raDecToAltAz: raDecToAltAz
    };
  }

  try {
    boot();
  } catch (error) {
    fail(error);
  }
}());
