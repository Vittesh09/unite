(function () {
  'use strict';

  var library = null;
  var panel = document.getElementById('panel-celestial');
  var bodyEl = document.getElementById('celestial-body');
  var backBtn = document.getElementById('celestial-back');
  var loading = false;

  function normalizeName(name) {
    return String(name || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function loadLibrary() {
    if (library) return Promise.resolve(library);
    if (loading) {
      return new Promise(function (resolve) {
        var t = setInterval(function () {
          if (library) {
            clearInterval(t);
            resolve(library);
          }
        }, 50);
      });
    }
    loading = true;
    return fetch('data/celestial-library.json')
      .then(function (res) {
        if (!res.ok) throw new Error('library missing');
        return res.json();
      })
      .then(function (data) {
        library = data || { bodies: {}, aliases: {} };
        loading = false;
        return library;
      })
      .catch(function () {
        library = { bodies: {}, aliases: {} };
        loading = false;
        return library;
      });
  }

  function lookupSync(obj) {
    if (!library || !obj) return null;
    var raw = obj.name || obj.n || '';
    var key = normalizeName(raw);
    var alias = library.aliases && library.aliases[key];
    if (alias && library.bodies[alias]) return library.bodies[alias];
    if (library.bodies[key]) return library.bodies[key];
    // Planet symbols / French catalogue names already mapped via aliases.
    if (obj.type === 'planet' || obj.type === 'étoile' || obj.type === 'star') {
      return null;
    }
    return null;
  }

  function fallbackEntry(obj) {
    var name = (obj && (obj.name || obj.n)) || 'Object';
    var kind = (obj && obj.type) || 'object';
    return {
      id: 'unknown',
      name: name,
      kind: kind,
      subtitle: kind === 'planet' ? 'Solar System body' : 'Catalogue object',
      image: 'assets/celestial/images/star-default.svg',
      model: null,
      summary: 'Detailed media for this target is coming soon. High-resolution images and 3D models will land here first for the Sun and planets, then for bright stars.',
      facts: [
        { label: 'Catalogue type', value: String(kind) },
        { label: 'RA', value: obj && Number.isFinite(obj.ra) ? obj.ra.toFixed(2) + '°' : '—' },
        { label: 'Dec', value: obj && Number.isFinite(obj.dec) ? obj.dec.toFixed(2) + '°' : '—' },
        { label: 'Magnitude', value: obj && Number.isFinite(obj.mag) ? String(obj.mag) : '—' }
      ],
      _live: obj || null
    };
  }

  function resolveEntry(obj) {
    return loadLibrary().then(function () {
      return lookupSync(obj) || fallbackEntry(obj);
    });
  }

  function renderKnowMore(entry, liveObj) {
    if (!bodyEl) return;
    var hasModel = !!(entry.model);
    var media = hasModel
      ? '<model-viewer class="celestial-model" src="' + entry.model +
        '" alt="' + entry.name + '" camera-controls touch-action="pan-y" interaction-prompt="none" ' +
        'shadow-intensity="0" exposure="1.1" environment-image="neutral"></model-viewer>'
      : '<img class="celestial-hero-img" src="' + entry.image + '" alt="' + entry.name + '">';

    var facts = (entry.facts || []).map(function (f) {
      return '<div class="flow-metric"><span>' + f.label + '</span><strong>' + f.value + '</strong></div>';
    }).join('');

    var liveBits = '';
    if (liveObj) {
      if (Number.isFinite(liveObj.ra)) liveBits += '<div class="flow-metric"><span>Live RA</span><strong>' + liveObj.ra.toFixed(2) + '°</strong></div>';
      if (Number.isFinite(liveObj.dec)) liveBits += '<div class="flow-metric"><span>Live Dec</span><strong>' + liveObj.dec.toFixed(2) + '°</strong></div>';
      if (Number.isFinite(liveObj.mag)) liveBits += '<div class="flow-metric"><span>Magnitude</span><strong>' + liveObj.mag + '</strong></div>';
    }

    bodyEl.innerHTML =
      '<div class="celestial-hero">' + media + '</div>' +
      '<div class="flow-block">' +
      '<p class="flow-kicker">' + (entry.kind || 'object') + '</p>' +
      '<h2 class="flow-display">' + entry.name + '</h2>' +
      '<p class="flow-sub">' + (entry.subtitle || '') + '</p>' +
      '</div>' +
      '<p class="celestial-summary">' + (entry.summary || '') + '</p>' +
      '<div class="flow-metrics">' + facts + liveBits + '</div>' +
      '<p class="flow-sub celestial-soon">Library note: planet &amp; Sun high-res / 3D assets will replace these placeholders first; star models come next.</p>' +
      '<div class="flow-actions">' +
      '<button type="button" class="flow-cta primary" id="celestial-sky">View in Astro Walk</button>' +
      '</div>';

    var skyBtn = document.getElementById('celestial-sky');
    if (skyBtn) {
      skyBtn.addEventListener('click', function () {
        closeKnowMore();
        if (window.__uniteApp && typeof window.__uniteApp.enterAstroWalk === 'function') {
          window.__uniteApp.enterAstroWalk(entry.name);
        }
      });
    }
  }

  function openKnowMore(obj) {
    resolveEntry(obj).then(function (entry) {
      renderKnowMore(entry, obj);
      if (panel) {
        panel.hidden = false;
        panel.classList.add('is-open');
      }
    });
  }

  function closeKnowMore() {
    if (!panel) return;
    panel.classList.remove('is-open');
    panel.hidden = true;
  }

  function handleBack() {
    if (panel && !panel.hidden) {
      closeKnowMore();
      return true;
    }
    return false;
  }

  function cardThumbHtml(obj) {
    var entry = lookupSync(obj);
    var src = entry && entry.image
      ? entry.image
      : 'assets/celestial/images/star-default.svg';
    return '<img class="object-thumb" src="' + src + '" alt="" width="48" height="48">';
  }

  if (backBtn) {
    backBtn.addEventListener('click', function () {
      closeKnowMore();
    });
  }

  loadLibrary();

  window.__uniteCelestial = {
    load: loadLibrary,
    lookup: function (obj) {
      return loadLibrary().then(function () { return lookupSync(obj); });
    },
    lookupSync: lookupSync,
    openKnowMore: openKnowMore,
    closeKnowMore: closeKnowMore,
    handleBack: handleBack,
    cardThumbHtml: cardThumbHtml,
    resolveEntry: resolveEntry
  };
}());
