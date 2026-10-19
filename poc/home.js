(function () {
  'use strict';

  var DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  var METEOR_SHOWERS = [
    { name: 'Quadrantids', month: 1, day: 3, rate: '80–120/h' },
    { name: 'Lyrids', month: 4, day: 22, rate: '~18/h' },
    { name: 'Eta Aquariids', month: 5, day: 6, rate: '~40/h' },
    { name: 'Perseids', month: 8, day: 12, rate: '60–100/h' },
    { name: 'Orionids', month: 10, day: 21, rate: '~20/h' },
    { name: 'Leonids', month: 11, day: 17, rate: '~15/h' },
    { name: 'Geminids', month: 12, day: 14, rate: '100–120/h' },
    { name: 'Ursids', month: 12, day: 22, rate: '~10/h' }
  ];

  var selectedOffset = 0;
  var moonViewerReady = false;
  var lastMoonPhase = 0.5;
  var moonSunEnvUrl = '';

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function formatTime(date) {
    if (!date || Number.isNaN(date.getTime())) return '—';
    return pad(date.getHours()) + ':' + pad(date.getMinutes());
  }

  function formatDateLong(date) {
    return DAY_NAMES[date.getDay()] + ', ' + MONTH_NAMES[date.getMonth()] + ' ' + date.getDate() +
      ' at ' + formatTime(date);
  }

  function atOffset(base, offsetDays) {
    var d = new Date(base.getTime());
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + offsetDays);
    if (offsetDays === 0) {
      return new Date(base.getTime());
    }
    return d;
  }

  function moonPhase(date) {
    var newMoon = Date.UTC(2000, 0, 6, 18, 14, 0);
    var days = (date.getTime() - newMoon) / 86400000;
    var age = ((days % 29.530588853) + 29.530588853) % 29.530588853;
    var phase = age / 29.530588853;
    var illum = (1 - Math.cos(phase * 2 * Math.PI)) / 2;
    var idx = Math.round(phase * 8) % 8;
    var names = [
      'New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous',
      'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent'
    ];
    return { age: age, phase: phase, illumination: illum, name: names[idx], idx: idx };
  }

  function solarDayParams(date) {
    var day = Math.floor(
      (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) -
        Date.UTC(date.getFullYear(), 0, 0)) / 86400000
    );
    var gamma = (2 * Math.PI / 365) * (day - 1 + (date.getHours() - 12) / 24);
    var eqTime = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma)
      - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
    var decl = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma)
      - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma)
      - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);
    return { eqTime: eqTime, decl: decl };
  }

  function solarAltitude(date, lat, lon) {
    var rad = Math.PI / 180;
    var params = solarDayParams(date);
    var minutes = date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
    var tzHours = -date.getTimezoneOffset() / 60;
    var timeOffset = params.eqTime + 4 * lon - 60 * tzHours;
    var trueSolar = minutes + timeOffset;
    var ha = (trueSolar / 4) - 180;
    var sinAlt = Math.sin(lat * rad) * Math.sin(params.decl)
      + Math.cos(lat * rad) * Math.cos(params.decl) * Math.cos(ha * rad);
    return Math.asin(Math.max(-1, Math.min(1, sinAlt))) / rad;
  }

  function skyBrightnessLabel(alt) {
    if (alt > 0) return { key: 'day', label: 'Daylight' };
    if (alt > -6) return { key: 'civil', label: 'Civil twilight' };
    if (alt > -12) return { key: 'nautical', label: 'Nautical twilight' };
    if (alt > -18) return { key: 'astro', label: 'Astronomical twilight' };
    return { key: 'night', label: 'Astronomical night' };
  }

  function sunTimes(date, lat, lon) {
    var rad = Math.PI / 180;
    var params = solarDayParams(date);
    var eqTime = params.eqTime;
    var decl = params.decl;
    function event(zenithDeg, rising) {
      var cosH = (Math.cos(zenithDeg * rad) / (Math.cos(lat * rad) * Math.cos(decl)))
        - Math.tan(lat * rad) * Math.tan(decl);
      if (cosH > 1 || cosH < -1) return null;
      var ha = Math.acos(cosH) * 180 / Math.PI;
      var timeUTC = 720 - 4 * (lon + (rising ? ha : -ha)) - eqTime;
      var local = new Date(date);
      local.setHours(0, 0, 0, 0);
      return new Date(local.getTime() + timeUTC * 60000 - local.getTimezoneOffset() * 60000);
    }
    return {
      sunrise: event(90.833, true),
      sunset: event(90.833, false),
      civilDawn: event(96, true),
      civilDusk: event(96, false),
      nauticalDawn: event(102, true),
      nauticalDusk: event(102, false),
      astroDawn: event(108, true),
      astroDusk: event(108, false)
    };
  }

  /** Approximate moonrise / moonset from elongation vs sun (planning accuracy). */
  function moonRiseSet(date, lat, lon, phase) {
    var sun = sunTimes(date, lat, lon);
    if (!sun.sunrise || !sun.sunset) return { rise: null, set: null };
    var lagMs = phase * 24 * 3600000;
    return {
      rise: new Date(sun.sunrise.getTime() + lagMs),
      set: new Date(sun.sunset.getTime() + lagMs)
    };
  }

  function moonDistanceKm(phase) {
    // Crude elliptical distance: nearer near full / new apogee/perigee approximation.
    return Math.round(385000 - 21000 * Math.cos(phase * 2 * Math.PI));
  }

  function daysToFullMoon(phase) {
    var toFull = ((0.5 - phase) + 1) % 1;
    return Math.round(toFull * 29.530588853);
  }

  function moonAltitude(date, lat, lon, phase) {
    var rad = Math.PI / 180;
    var params = solarDayParams(date);
    var moonLonOffset = phase * 2 * Math.PI;
    var moonDecl = params.decl + 0.09 * Math.sin(moonLonOffset);
    var lstHours = (date.getUTCHours() + date.getUTCMinutes() / 60) + lon / 15;
    var ha = ((lstHours / 24) * 2 * Math.PI) - moonLonOffset;
    var sinAlt = Math.sin(lat * rad) * Math.sin(moonDecl)
      + Math.cos(lat * rad) * Math.cos(moonDecl) * Math.cos(ha);
    return Math.asin(Math.max(-1, Math.min(1, sinAlt))) / rad;
  }

  function nightQuality(illumination) {
    var pct = Math.round(illumination * 100);
    if (pct < 10) return { label: 'Excellent dark skies', detail: 'Near-new moon. Deep-sky targets shine.', score: 5 };
    if (pct < 35) return { label: 'Good for most targets', detail: 'Crescent light — galaxies still rewarding.', score: 4 };
    if (pct < 65) return { label: 'Mixed night', detail: 'Prefer planets, doubles, and bright clusters.', score: 3 };
    if (pct < 90) return { label: 'Bright night', detail: 'Best for Moon, planets, and open clusters.', score: 2 };
    return { label: 'Very bright night', detail: 'Great lunar observing; faint DSOs will struggle.', score: 1 };
  }

  function limitingMagnitude(illumination) {
    return Math.max(2.5, Math.round((5.2 - illumination * 2.4) * 10) / 10);
  }

  function nextMeteor(date) {
    var y = date.getFullYear();
    var best = null;
    var bestDiff = Infinity;
    for (var pass = 0; pass < 2; pass += 1) {
      for (var i = 0; i < METEOR_SHOWERS.length; i += 1) {
        var s = METEOR_SHOWERS[i];
        var peak = new Date(y + pass, s.month - 1, s.day, 12, 0, 0);
        var diff = peak.getTime() - date.getTime();
        if (diff < -2 * 86400000) continue;
        if (diff < bestDiff) {
          bestDiff = diff;
          best = { name: s.name, rate: s.rate, days: Math.round(diff / 86400000) };
        }
      }
    }
    return best;
  }

  function readLatLon() {
    var latEl = document.getElementById('lat');
    var lonEl = document.getElementById('lon');
    var lat = latEl ? Number(latEl.value) : NaN;
    var lon = lonEl ? Number(lonEl.value) : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return { lat: 19.076, lon: 72.8777, label: 'Mumbai area' };
    }
    return { lat: lat, lon: lon, label: lat.toFixed(2) + '°, ' + lon.toFixed(2) + '°' };
  }

  function planetHighlights() {
    if (!window.__uniteSkyPoc || !window.__uniteSkyPoc.engine || !window.__uniteSkyPoc.engine.planetPos) {
      return 'Open Astro Walk to load live planet altitudes.';
    }
    var now = new Date();
    var pos = readLatLon();
    var names = [];
    window.__uniteSkyPoc.engine.planetPos.forEach(function (p) {
      if (p.n === 'Sun' || p.n === 'Moon') return;
      if (typeof window.__uniteSkyPoc.raDecToAltAz !== 'function') return;
      var hz = window.__uniteSkyPoc.raDecToAltAz(p.ra, p.dec, pos.lat, pos.lon, now);
      if (hz.alt > 10) names.push(p.n + ' · ' + Math.round(hz.alt) + '°');
    });
    return names.length ? names.slice(0, 4).join('   ') : 'No bright planets high right now.';
  }

  /**
   * Static widget disc using the same sun direction as the 3D moon (Lambert sphere).
   * No interaction — a still frame of the lit/unlit globe.
   */
  function moonPhaseDiscHtml(phase, size) {
    var s = size || 88;
    var px = Math.max(88, Math.round(s * Math.min(2, window.devicePixelRatio || 1)));
    var canvas = document.createElement('canvas');
    canvas.width = px;
    canvas.height = px;
    renderMoonLambert(canvas.getContext('2d'), px, phase);
    return '<img src="' + canvas.toDataURL('image/png') + '" width="' + s + '" height="' + s + '" alt="">';
  }

  function renderMoonLambert(ctx, size, phase) {
    var img = ctx.createImageData(size, size);
    var data = img.data;
    var cx = (size - 1) / 2;
    var cy = (size - 1) / 2;
    var radius = size * 0.42;
    var dir = moonSunDirection(phase);
    var len = Math.sqrt(dir.x * dir.x + dir.y * dir.y + dir.z * dir.z) || 1;
    var lx = dir.x / len;
    var ly = dir.y / len;
    var lz = dir.z / len;
    var craters = [
      [0.22, -0.18, 0.11],
      [-0.28, 0.12, 0.09],
      [0.08, 0.30, 0.14],
      [-0.12, -0.32, 0.07],
      [0.34, 0.16, 0.06],
      [-0.34, -0.08, 0.08],
      [0.02, 0.02, 0.05]
    ];
    for (var y = 0; y < size; y += 1) {
      for (var x = 0; x < size; x += 1) {
        var i = (y * size + x) * 4;
        var dx = (x - cx) / radius;
        var dy = (y - cy) / radius;
        var d2 = dx * dx + dy * dy;
        if (d2 > 1) {
          data[i + 3] = 0;
          continue;
        }
        var nz = Math.sqrt(Math.max(0, 1 - d2));
        var nx = dx;
        var ny = -dy;
        var ndotl = Math.max(0, nx * lx + ny * ly + nz * lz);
        var shade = Math.pow(ndotl, 0.85);
        var albedo = 0.82 + 0.18 * nz;
        var c = 0;
        for (c = 0; c < craters.length; c += 1) {
          var crx = dx - craters[c][0];
          var cry = dy - craters[c][1];
          var crr = craters[c][2];
          var cd = (crx * crx + cry * cry) / (crr * crr);
          if (cd < 1) albedo *= 0.72 + 0.28 * cd;
        }
        var litR = 255 * albedo;
        var litG = 243 * albedo;
        var litB = 220 * albedo;
        var nightR = 18 + 16 * nz;
        var nightG = 16 + 14 * nz;
        var nightB = 14 + 12 * nz;
        data[i] = Math.round(nightR + (litR - nightR) * shade);
        data[i + 1] = Math.round(nightG + (litG - nightG) * shade);
        data[i + 2] = Math.round(nightB + (litB - nightB) * shade);
        data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function minutesOf(date) {
    if (!date || Number.isNaN(date.getTime())) return null;
    return date.getHours() * 60 + date.getMinutes();
  }

  function findDarkestSky(date, lat, lon, moon) {
    var sun = sunTimes(date, lat, lon);
    var start = sun.astroDusk || sun.nauticalDusk || sun.civilDusk || sun.sunset;
    var end = sun.astroDawn || sun.nauticalDawn || sun.civilDawn || sun.sunrise;
    if (!start || !end) {
      return { time: null, windowStart: null, windowEnd: null, label: 'No full night window today' };
    }
    var startMs = start.getTime();
    var endMs = end.getTime();
    if (endMs <= startMs) endMs += 86400000;

    var best = null;
    var bestScore = Infinity;
    for (var t = startMs; t <= endMs; t += 10 * 60000) {
      var d = new Date(t);
      var sAlt = solarAltitude(d, lat, lon);
      var mAlt = moonAltitude(d, lat, lon, moon.phase);
      var sunContrib = Math.max(0, (sAlt + 18) / 18);
      var moonContrib = Math.max(0, mAlt) / 90 * moon.illumination;
      var score = sunContrib * 3.2 + moonContrib;
      if (score < bestScore) {
        bestScore = score;
        best = d;
      }
    }

    return {
      time: best,
      windowStart: start,
      windowEnd: new Date(endMs),
      score: bestScore,
      label: best ? ('Darkest around ' + formatTime(best)) : 'No dark window'
    };
  }

  function buildSkyGraph(now, lat, lon, sun, darkest, moon) {
    var samples = [];
    var start = new Date(now);
    start.setHours(0, 0, 0, 0);
    var moonPhaseVal = moon ? moon.phase : moonPhase(now).phase;
    var step = 5;
    for (var i = 0; i <= 1440 / step; i += 1) {
      var minutes = i * step;
      var t = new Date(start.getTime() + minutes * 60000);
      samples.push({
        minutes: minutes,
        alt: solarAltitude(t, lat, lon),
        moonAlt: moonAltitude(t, lat, lon, moonPhaseVal)
      });
    }
    var nowAlt = solarAltitude(now, lat, lon);
    var phase = skyBrightnessLabel(nowAlt);
    var w = 320;
    var h = 136;
    var padL = 10;
    var padR = 10;
    var padT = 18;
    var padB = 20;
    var plotW = w - padL - padR;
    var plotH = h - padT - padB;

    function xAt(minutes) { return padL + (minutes / 1440) * plotW; }
    function yAt(alt) { return padT + (1 - (alt + 90) / 180) * plotH; }

    var points = samples.map(function (s) {
      return xAt(s.minutes).toFixed(1) + ',' + yAt(s.alt).toFixed(1);
    }).join(' ');
    var area = padL.toFixed(1) + ',' + yAt(-90).toFixed(1) + ' ' + points + ' ' +
      (w - padR).toFixed(1) + ',' + yAt(-90).toFixed(1);
    var nowMin = now.getHours() * 60 + now.getMinutes();
    var nowX = xAt(nowMin);
    var nowY = yAt(nowAlt);
    var horizonY = yAt(0);

    function mark(date, className) {
      if (!date) return '';
      var m = minutesOf(date);
      if (m == null) return '';
      var x = xAt(m);
      return '<line class="' + (className || 'sky-mark') + '" x1="' + x.toFixed(1) + '" y1="' + padT + '" x2="' + x.toFixed(1) + '" y2="' + (h - padB) + '"/>';
    }

    var nightBand = '';
    if (darkest && darkest.windowStart && darkest.windowEnd) {
      var a = minutesOf(darkest.windowStart);
      var b = minutesOf(darkest.windowEnd);
      if (a != null && b != null) {
        if (b < a) {
          nightBand =
            '<rect class="sky-band-astro" x="' + xAt(a).toFixed(1) + '" y="' + padT + '" width="' + (xAt(1440) - xAt(a)).toFixed(1) + '" height="' + plotH + '"/>' +
            '<rect class="sky-band-astro" x="' + padL + '" y="' + padT + '" width="' + (xAt(b) - padL).toFixed(1) + '" height="' + plotH + '"/>';
        } else {
          nightBand =
            '<rect class="sky-band-astro" x="' + xAt(a).toFixed(1) + '" y="' + padT + '" width="' + (xAt(b) - xAt(a)).toFixed(1) + '" height="' + plotH + '"/>';
        }
      }
    }

    var darkestMarks = '';
    if (darkest && darkest.time) {
      var dm = minutesOf(darkest.time);
      var dx = xAt(dm);
      var dAlt = solarAltitude(darkest.time, lat, lon);
      var dy = yAt(dAlt);
      darkestMarks =
        mark(darkest.time, 'sky-darkest') +
        '<circle class="sky-darkest-dot" cx="' + dx.toFixed(1) + '" cy="' + dy.toFixed(1) + '" r="4"/>' +
        '<text class="sky-darkest-label" x="' + Math.min(w - 52, Math.max(padL, dx - 18)).toFixed(1) + '" y="' + Math.max(12, dy - 9).toFixed(1) + '">Darkest</text>';
    }

    var hours = [0, 6, 12, 18, 24].map(function (hr) {
      var x = xAt(Math.min(1439, hr * 60));
      var label = hr === 24 ? '24' : (hr < 10 ? '0' + hr : String(hr));
      return '<text class="sky-axis" x="' + x.toFixed(1) + '" y="' + (h - 5) + '" text-anchor="middle">' + label + '</text>';
    }).join('');

    var snaps = [nowMin];
    [sun.sunrise, sun.sunset, darkest && darkest.time, darkest && darkest.windowStart, darkest && darkest.windowEnd].forEach(function (d) {
      var m = minutesOf(d);
      if (m != null) snaps.push(m);
    });

    var svg =
      '<svg class="sky-graph-svg" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Sky darkness for selected day">' +
      '<defs>' +
      '<linearGradient id="sky-area-fill" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#ffc857" stop-opacity="0.28"/>' +
      '<stop offset="100%" stop-color="#ffc857" stop-opacity="0.02"/>' +
      '</linearGradient>' +
      '</defs>' +
      nightBand +
      '<line class="sky-horizon" x1="' + padL + '" y1="' + horizonY.toFixed(1) + '" x2="' + (w - padR) + '" y2="' + horizonY.toFixed(1) + '"/>' +
      '<polygon class="sky-area" points="' + area + '"/>' +
      '<polyline class="sky-curve" fill="none" points="' + points + '"/>' +
      mark(sun.sunrise) + mark(sun.sunset) +
      darkestMarks +
      '<line class="sky-now" x1="' + nowX.toFixed(1) + '" y1="' + padT + '" x2="' + nowX.toFixed(1) + '" y2="' + (h - padB) + '"/>' +
      '<circle class="sky-now-dot" cx="' + nowX.toFixed(1) + '" cy="' + nowY.toFixed(1) + '" r="3.2"/>' +
      hours +
      '</svg>';

    return {
      svg: svg,
      nowAlt: nowAlt,
      phase: phase,
      padL: padL,
      padR: padR,
      padT: padT,
      padB: padB,
      viewW: w,
      viewH: h,
      samples: samples,
      snaps: snaps,
      step: step
    };
  }

  function bindSkyGraphInteraction(wrap, viewDate, lat, lon, graphMeta, readout) {
    if (!wrap || !graphMeta) return;
    var tip = wrap.querySelector('.sky-graph-tip');
    var cursor = wrap.querySelector('.sky-graph-cursor');
    var handle = wrap.querySelector('.sky-graph-handle');
    if (!tip || !cursor) return;
    var step = graphMeta.step || 5;
    var hideTimer = 0;
    var lastMinutes = null;

    function sampleAt(minutes) {
      var idx = Math.round(minutes / step);
      idx = Math.max(0, Math.min(graphMeta.samples.length - 1, idx));
      return graphMeta.samples[idx];
    }

    function snapMinutes(minutes) {
      var snaps = graphMeta.snaps || [];
      var best = minutes;
      var bestD = 12;
      for (var i = 0; i < snaps.length; i += 1) {
        var d = Math.abs(snaps[i] - minutes);
        if (d < bestD) {
          bestD = d;
          best = snaps[i];
        }
      }
      return best;
    }

    function plotX(minutes, rect) {
      var plotLeft = (graphMeta.padL / graphMeta.viewW) * rect.width;
      var plotRight = rect.width - (graphMeta.padR / graphMeta.viewW) * rect.width;
      return plotLeft + (minutes / 1440) * (plotRight - plotLeft);
    }

    function plotY(alt, rect) {
      var plotTop = (graphMeta.padT / graphMeta.viewH) * rect.height;
      var plotBottom = rect.height - (graphMeta.padB / graphMeta.viewH) * rect.height;
      return plotTop + (1 - (alt + 90) / 180) * (plotBottom - plotTop);
    }

    function describe(minutes, sample) {
      var probe = new Date(viewDate);
      probe.setHours(0, 0, 0, 0);
      probe = new Date(probe.getTime() + minutes * 60000);
      var alt = sample ? sample.alt : solarAltitude(probe, lat, lon);
      var moonAlt = sample && Number.isFinite(sample.moonAlt)
        ? sample.moonAlt
        : moonAltitude(probe, lat, lon, moonPhase(probe).phase);
      var label = skyBrightnessLabel(alt);
      var sunTxt = (Math.round(alt * 10) / 10) + '°';
      var moonTxt = (Math.round(moonAlt * 10) / 10) + '°';
      return {
        time: formatTime(probe),
        line: formatTime(probe) + ' · ' + label.label,
        detail: 'Sun ' + sunTxt + ' · Moon ' + moonTxt,
        alt: alt,
        label: label
      };
    }

    function updateFromMinutes(minutes, rect) {
      minutes = Math.max(0, Math.min(1439, Math.round(minutes)));
      minutes = snapMinutes(minutes);
      lastMinutes = minutes;
      var sample = sampleAt(minutes);
      var info = describe(minutes, sample);
      tip.innerHTML = info.line + '<br>' + info.detail;
      tip.classList.add('is-on');
      var x = plotX(minutes, rect);
      var y = plotY(sample ? sample.alt : info.alt, rect);
      cursor.style.left = x + 'px';
      cursor.classList.add('is-on');
      if (handle) {
        handle.style.left = x + 'px';
        handle.style.top = y + 'px';
        handle.classList.add('is-on');
      }
      var tipWidth = tip.offsetWidth || 140;
      var left = Math.max(8, Math.min(rect.width - tipWidth - 8, x - tipWidth / 2));
      tip.style.left = left + 'px';
      tip.style.top = (y < 48 ? y + 14 : 8) + 'px';
      wrap.setAttribute('aria-valuenow', String(minutes));
      wrap.setAttribute('aria-valuetext', info.line + ' · ' + info.detail);
      if (readout) readout.textContent = info.line + ' · ' + info.detail;
    }

    function updateFromClientX(clientX) {
      var rect = wrap.getBoundingClientRect();
      if (rect.width <= 0) return;
      var plotLeft = (graphMeta.padL / graphMeta.viewW) * rect.width;
      var plotRight = rect.width - (graphMeta.padR / graphMeta.viewW) * rect.width;
      var x = Math.max(plotLeft, Math.min(plotRight, clientX - rect.left));
      var frac = (x - plotLeft) / Math.max(1, plotRight - plotLeft);
      updateFromMinutes(frac * 1440, rect);
    }

    function clearTip() {
      tip.classList.remove('is-on');
      cursor.classList.remove('is-on');
      if (handle) handle.classList.remove('is-on');
    }

    function scheduleClear() {
      if (hideTimer) window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(function () {
        hideTimer = 0;
        if (!dragging) clearTip();
      }, 2200);
    }

    var dragging = false;
    wrap.addEventListener('pointerdown', function (event) {
      dragging = true;
      if (hideTimer) window.clearTimeout(hideTimer);
      wrap.setPointerCapture(event.pointerId);
      updateFromClientX(event.clientX);
      if (event.cancelable) event.preventDefault();
    });
    wrap.addEventListener('pointermove', function (event) {
      if (!dragging && event.pointerType !== 'mouse') return;
      if (event.pointerType === 'mouse' && event.buttons === 0 && !dragging) {
        updateFromClientX(event.clientX);
        return;
      }
      if (dragging) updateFromClientX(event.clientX);
    });
    wrap.addEventListener('pointerup', function () {
      dragging = false;
      scheduleClear();
    });
    wrap.addEventListener('pointercancel', function () {
      dragging = false;
      clearTip();
    });
    wrap.addEventListener('pointerleave', function () {
      if (!dragging) scheduleClear();
    });
    wrap.addEventListener('keydown', function (event) {
      var delta = 0;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') delta = -step;
      if (event.key === 'ArrowRight' || event.key === 'ArrowUp') delta = step;
      if (event.key === 'Home') {
        updateFromMinutes(0, wrap.getBoundingClientRect());
        event.preventDefault();
        return;
      }
      if (event.key === 'End') {
        updateFromMinutes(1439, wrap.getBoundingClientRect());
        event.preventDefault();
        return;
      }
      if (!delta) return;
      event.preventDefault();
      var base = lastMinutes == null ? (new Date().getHours() * 60 + new Date().getMinutes()) : lastMinutes;
      updateFromMinutes(base + delta, wrap.getBoundingClientRect());
      scheduleClear();
    });
  }

  function getModelScene(viewer) {
    if (!viewer) return null;
    var symbols = Object.getOwnPropertySymbols(viewer);
    for (var i = 0; i < symbols.length; i += 1) {
      var value = viewer[symbols[i]];
      if (value && value.isScene && value.camera) return value;
    }
    return null;
  }

  function getObject3DCtor(scene) {
    var pivot = scene.getObjectByName && scene.getObjectByName('Pivot');
    if (pivot && pivot.isObject3D) return pivot.constructor;
    var found = null;
    scene.traverse(function (obj) {
      if (found) return;
      if (obj.isObject3D && !obj.isScene && !obj.isCamera && !obj.isMesh && !obj.isLight) {
        found = obj.constructor;
      }
    });
    return found;
  }

  function getColorCtor(scene) {
    var Ctor = null;
    scene.traverse(function (obj) {
      if (Ctor) return;
      var mat = obj.material;
      if (Array.isArray(mat)) mat = mat[0];
      if (mat && mat.color && mat.color.isColor) Ctor = mat.color.constructor;
    });
    return Ctor;
  }

  function moonSunDirection(phase) {
    var a = phase * 2 * Math.PI;
    return {
      x: Math.sin(a),
      y: 0.12,
      z: -Math.cos(a)
    };
  }

  function fillSpaceBackground(ctx, w, h) {
    var sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#000000');
    sky.addColorStop(0.5, '#0c0a08');
    sky.addColorStop(1, '#000000');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
  }

  function paintSun(ctx, w, h, ux, uy) {
    var sx = ((ux % 1) + 1) % 1 * w;
    var sy = uy * h;
    var sun = ctx.createRadialGradient(sx, sy, 0, sx, sy, w * 0.14);
    sun.addColorStop(0, '#ffffff');
    sun.addColorStop(0.1, '#eef4ff');
    sun.addColorStop(0.28, '#a8c4ff');
    sun.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sun;
    ctx.beginPath();
    ctx.arc(sx, sy, w * 0.16, 0, Math.PI * 2);
    ctx.fill();
    if (sx < w * 0.16) {
      ctx.beginPath();
      ctx.arc(sx + w, sy, w * 0.16, 0, Math.PI * 2);
      ctx.fill();
    } else if (sx > w * 0.84) {
      ctx.beginPath();
      ctx.arc(sx - w, sy, w * 0.16, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function makeMoonSpaceEnvironment() {
    if (moonSunEnvUrl) return moonSunEnvUrl;
    var w = 1024;
    var h = 512;
    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    fillSpaceBackground(canvas.getContext('2d'), w, h);
    moonSunEnvUrl = canvas.toDataURL('image/jpeg', 0.85);
    return moonSunEnvUrl;
  }

  function makeMoonSunEnvironment(phase) {
    var w = 1024;
    var h = 512;
    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext('2d');
    fillSpaceBackground(ctx, w, h);
    var dir = moonSunDirection(phase);
    var az = Math.atan2(dir.x, dir.z);
    var el = Math.atan2(dir.y, Math.sqrt(dir.x * dir.x + dir.z * dir.z));
    var ux = 0.5 + az / (2 * Math.PI);
    var uy = 0.5 - el / Math.PI;
    paintSun(ctx, w, h, ux, uy);
    return canvas.toDataURL('image/jpeg', 0.92);
  }

  function ensureMoonSunLight(scene) {
    var existing = scene.getObjectByName('unite-moon-sun');
    if (existing) return existing;
    var Object3DCtor = getObject3DCtor(scene);
    var ColorCtor = getColorCtor(scene);
    if (!Object3DCtor || !ColorCtor) return null;

    var light = new Object3DCtor();
    light.name = 'unite-moon-sun';
    light.isLight = true;
    light.isDirectionalLight = true;
    light.type = 'DirectionalLight';
    light.intensity = 4.0;
    light.color = new ColorCtor(0xDCE8FF);
    light.castShadow = false;
    light.receiveShadow = false;
    light.visible = true;
    if (scene.camera && scene.camera.layers) light.layers = scene.camera.layers;
    light.target = new Object3DCtor();
    light.target.position.set(0, 0, 0);
    scene.add(light.target);
    scene.add(light);
    return light;
  }

  function applyMoonPhaseLighting(phase) {
    lastMoonPhase = phase;
    var viewer = document.getElementById('moon-viewer');
    if (!viewer) return;

    try {
      viewer.orientation = '0deg 0deg 0deg';
      viewer.cameraOrbit = '0deg 75deg 114%';
      viewer.interpolationDecay = 40;
      if (!viewer.environmentImage) {
        viewer.environmentImage = makeMoonSpaceEnvironment();
      }
    } catch (e) { /* ignore */ }

    var scene = getModelScene(viewer);
    if (!scene) return;

    if (typeof scene.environmentIntensity === 'number') {
      scene.environmentIntensity = 0.28;
    }

    scene.traverse(function (obj) {
      if (!obj.isMesh) return;
      obj.castShadow = true;
      obj.receiveShadow = true;
      var mats = obj.material ? (Array.isArray(obj.material) ? obj.material : [obj.material]) : [];
      for (var i = 0; i < mats.length; i += 1) {
        var mat = mats[i];
        if (!mat) continue;
        if (typeof mat.envMapIntensity === 'number') mat.envMapIntensity = 0.34;
        if (typeof mat.roughness === 'number') mat.roughness = Math.max(mat.roughness, 0.72);
        if (typeof mat.metalness === 'number') mat.metalness = Math.min(mat.metalness, 0.08);
        mat.needsUpdate = true;
      }
    });

    var dir = moonSunDirection(phase);
    var distance = Math.max(4, (scene.boundingSphere && scene.boundingSphere.radius) ? scene.boundingSphere.radius * 6 : 8);
    var light = ensureMoonSunLight(scene);
    if (light) {
      light.position.set(dir.x * distance, dir.y * distance, dir.z * distance);
      if (light.target) {
        light.target.position.set(0, 0, 0);
        if (typeof light.target.updateMatrixWorld === 'function') light.target.updateMatrixWorld(true);
      }
      if (typeof light.updateMatrixWorld === 'function') light.updateMatrixWorld(true);
      var illum = (1 - Math.cos(phase * 2 * Math.PI)) / 2;
      light.intensity = 2.2 + illum * 2.2;
      if (light.color && typeof light.color.setHex === 'function') light.color.setHex(0xDCE8FF);
    } else {
      try {
        viewer.environmentImage = makeMoonSunEnvironment(phase);
      } catch (eEnv) { /* ignore */ }
      if (typeof scene.environmentIntensity === 'number') scene.environmentIntensity = 1.05;
    }

    if (typeof scene.queueRender === 'function') scene.queueRender();
    try {
      viewer.exposure = 0.88 + ((1 - Math.cos(phase * 2 * Math.PI)) / 2) * 0.16;
    } catch (e2) { /* ignore */ }
  }

  function updateMoonViewer(phase) {
    var viewer = document.getElementById('moon-viewer');
    var fallback = document.getElementById('moon-fallback');
    if (!viewer) return;
    applyMoonPhaseLighting(phase);
    if (fallback) fallback.hidden = true;
  }

  function bindMoonViewer() {
    var viewer = document.getElementById('moon-viewer');
    var fallback = document.getElementById('moon-fallback');
    if (!viewer || moonViewerReady) return;
    var fail = function () {
      if (fallback) fallback.hidden = false;
      viewer.hidden = true;
    };
    viewer.addEventListener('load', function () {
      moonViewerReady = true;
      if (fallback) fallback.hidden = true;
      viewer.hidden = false;
      applyMoonPhaseLighting(lastMoonPhase);
    });
    viewer.addEventListener('error', fail);
    window.setTimeout(function () {
      if (!moonViewerReady && fallback) {
        if (!window.customElements || !customElements.get('model-viewer')) fail();
      }
    }, 8000);
  }

  function metricRow(label, value) {
    return '<div class="flow-metric"><span>' + label + '</span><strong>' + value + '</strong></div>';
  }

  function render() {
    var root = document.getElementById('home-dashboard');
    if (!root) return;
    var now = new Date();
    var viewDate = atOffset(now, selectedOffset);
    var pos = readLatLon();
    var moon = moonPhase(viewDate);
    var sun = sunTimes(viewDate, pos.lat, pos.lon);
    var riseSet = moonRiseSet(viewDate, pos.lat, pos.lon, moon.phase);
    var quality = nightQuality(moon.illumination);
    var illumPct = Math.round(moon.illumination * 100);
    var limMag = limitingMagnitude(moon.illumination);
    var moonAlt = moonAltitude(viewDate, pos.lat, pos.lon, moon.phase);
    var distKm = moonDistanceKm(moon.phase);
    var distMi = Math.round(distKm * 0.621371);
    var toFull = daysToFullMoon(moon.phase);
    var meteor = nextMeteor(now);
    var darkest = findDarkestSky(viewDate, pos.lat, pos.lon, moon);
    var skyGraph = buildSkyGraph(
      selectedOffset === 0 ? now : viewDate,
      pos.lat,
      pos.lon,
      sun,
      darkest,
      moon
    );
    var sunAltNow = Math.round(skyGraph.nowAlt * 10) / 10;

    updateMoonViewer(moon.phase);

    // Next 7 days (today → +6)
    var scrub = [0, 1, 2, 3, 4, 5, 6].map(function (offset) {
      var d = atOffset(now, offset);
      var label = offset === 0 ? 'Today' : DAY_NAMES[d.getDay()];
      return '<button type="button" class="day-chip' + (offset === selectedOffset ? ' is-active' : '') +
        '" data-offset="' + offset + '" aria-pressed="' + (offset === selectedOffset ? 'true' : 'false') + '">' +
        label + '</button>';
    }).join('');

    var meteorTitle = meteor ? meteor.name : 'Quiet skies';
    var meteorSub = meteor
      ? (meteor.days <= 0
        ? 'Peak night — stay out after midnight'
        : (meteor.days === 1
          ? 'Peaks tomorrow'
          : 'Peaks in ' + meteor.days + ' days'))
      : 'No major shower in the next few weeks';
    var meteorWhen = meteor
      ? (meteor.days <= 0 ? 'Peaking now' : (meteor.days === 1 ? 'Tomorrow' : meteor.days + ' days'))
      : '—';
    var meteorRate = meteor ? ('ZHR ' + meteor.rate) : '—';

    var darkestWindow = (darkest.windowStart && darkest.windowEnd)
      ? (formatTime(darkest.windowStart) + ' – ' + formatTime(darkest.windowEnd))
      : '—';
    var darkestLine = darkest.time
      ? ('Best time · <strong>' + formatTime(darkest.time) + '</strong>')
      : darkest.label;

    var skyHeading = selectedOffset === 0 ? 'Sky right now' : 'Sky that day';
    var skySub = selectedOffset === 0
      ? ('Sun ' + sunAltNow + '° · ' + pos.label)
      : (DAY_NAMES[viewDate.getDay()] + ' · ' + pos.label);
    var fullMoonLabel = toFull === 0 ? 'Today' : (toFull + (toFull === 1 ? ' day' : ' days'));

    root.innerHTML =
      '<div class="flow-block moon-copy">' +
      '<p class="flow-kicker">Moon</p>' +
      '<h2 class="flow-display">' + moon.name + '</h2>' +
      '<p class="flow-sub">' + formatDateLong(viewDate) + '</p>' +
      '</div>' +

      '<div class="day-scrub" role="tablist" aria-label="Next 7 days">' + scrub + '</div>' +

      '<div class="moon-widget-card glass" aria-label="Moon phase widget">' +
      '<div class="moon-widget-disc">' + moonPhaseDiscHtml(moon.phase, 88) + '</div>' +
      '<div class="moon-widget-copy">' +
      '<p class="flow-kicker">' + moon.name + '</p>' +
      '<h3 class="flow-heading">' + illumPct + '% lit</h3>' +
      '<div class="moon-widget-times">' +
      '<span>Rise <strong>' + formatTime(riseSet.rise) + '</strong></span>' +
      '<span>Set <strong>' + formatTime(riseSet.set) + '</strong></span>' +
      '</div>' +
      '</div>' +
      '</div>' +

      '<div class="home-panel">' +
      '<div class="home-panel-head">' +
      '<p class="flow-kicker">Tonight’s numbers</p>' +
      '<h3 class="flow-heading">Moon details</h3>' +
      '</div>' +
      '<div class="home-stat-grid">' +
      '<div class="home-stat"><span>Illumination</span><strong>' + illumPct + '%</strong></div>' +
      '<div class="home-stat"><span>Altitude</span><strong>' + Math.round(moonAlt) + '°</strong></div>' +
      '<div class="home-stat"><span>Moonrise</span><strong>' + formatTime(riseSet.rise) + '</strong></div>' +
      '<div class="home-stat"><span>Moonset</span><strong>' + formatTime(riseSet.set) + '</strong></div>' +
      '<div class="home-stat"><span>Next full</span><strong>' + fullMoonLabel + '</strong></div>' +
      '<div class="home-stat"><span>Distance</span><strong>' + distMi.toLocaleString() + ' mi</strong></div>' +
      '</div>' +
      '</div>' +

      '<div class="home-panel home-panel-sky">' +
      '<div class="home-panel-head">' +
      '<p class="flow-kicker">' + skyHeading + '</p>' +
      '<h3 class="flow-heading">' + skyGraph.phase.label + '</h3>' +
      '<p class="flow-sub">' + skySub + '</p>' +
      '</div>' +
      '<div class="home-sky-meta">' +
      '<div class="darkest-chip">' + darkestLine + '</div>' +
      '<p class="home-sky-window">Astronomical night · ' + darkestWindow + '</p>' +
      '</div>' +
      '<div class="sky-graph-wrap soft is-interactive" id="sky-graph-wrap" tabindex="0" role="slider" aria-label="Inspect sky darkness" aria-valuemin="0" aria-valuemax="1439">' +
      '<div class="sky-graph-tip" aria-live="polite"></div>' +
      '<div class="sky-graph-cursor" aria-hidden="true"></div>' +
      '<div class="sky-graph-handle" aria-hidden="true"></div>' +
      skyGraph.svg +
      '</div>' +
      '<p class="sky-graph-readout" id="sky-graph-readout">' + skyGraph.phase.label + ' · Sun ' + sunAltNow + '°</p>' +
      '</div>' +

      '<div class="home-panel home-panel-quality">' +
      '<div class="home-panel-head">' +
      '<p class="flow-kicker">Night quality</p>' +
      '<h3 class="flow-heading">' + quality.label + '</h3>' +
      '<p class="flow-sub">' + quality.detail + '</p>' +
      '</div>' +
      '<div class="quality-row">' +
      '<div class="score-dots soft-dots" aria-label="Darkness score ' + quality.score + ' of 5">' +
      [1, 2, 3, 4, 5].map(function (n) {
        return '<span class="' + (n <= quality.score ? 'on' : '') + '"></span>';
      }).join('') +
      '</div>' +
      '<span class="quality-mag">naked-eye ~' + limMag + ' mag</span>' +
      '</div>' +
      '</div>' +

      '<div class="home-panel">' +
      '<div class="home-panel-head">' +
      '<p class="flow-kicker">Planets up</p>' +
      '</div>' +
      '<p class="planet-line" id="home-planets">' + planetHighlights() + '</p>' +
      '</div>' +

      '<div class="meteor-card glass" aria-label="Meteor watch">' +
      '<div class="meteor-card-visual" aria-hidden="true">' +
      '<span class="meteor-streak"></span>' +
      '<span class="meteor-spark"></span>' +
      '</div>' +
      '<div class="meteor-card-body">' +
      '<p class="flow-kicker">Meteor watch</p>' +
      '<h3 class="flow-heading">' + meteorTitle + '</h3>' +
      '<p class="flow-sub">' + meteorSub + '</p>' +
      '<div class="meteor-meta">' +
      '<span class="meteor-chip">' + meteorWhen + '</span>' +
      '<span class="meteor-chip">' + meteorRate + '</span>' +
      '</div>' +
      '</div>' +
      '</div>';

    var chips = root.querySelectorAll('.day-chip');
    for (var c = 0; c < chips.length; c += 1) {
      chips[c].addEventListener('click', function (event) {
        selectedOffset = Number(event.currentTarget.getAttribute('data-offset')) || 0;
        render();
      });
    }

    bindSkyGraphInteraction(
      document.getElementById('sky-graph-wrap'),
      viewDate,
      pos.lat,
      pos.lon,
      skyGraph,
      document.getElementById('sky-graph-readout')
    );

    refreshAndroidMoonWidget();
  }

  function moonWidgetPlugin() {
    if (!window.Capacitor || typeof window.Capacitor.registerPlugin !== 'function') return null;
    try {
      return window.Capacitor.registerPlugin('MoonWidget');
    } catch (e) {
      return null;
    }
  }

  function refreshAndroidMoonWidget() {
    var plugin = moonWidgetPlugin();
    if (!plugin || typeof plugin.refresh !== 'function') return;
    plugin.refresh().catch(function () { /* ignore */ });
  }

  function refreshPlanetsLater() {
    window.setTimeout(function () {
      var el = document.getElementById('home-planets');
      if (el) el.textContent = planetHighlights();
    }, 900);
  }

  function boot() {
    bindMoonViewer();
    render();
    refreshPlanetsLater();
    window.setInterval(function () {
      if (selectedOffset === 0) render();
    }, 60000);
    window.__uniteHome = { refresh: render };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}());
