(function () {
  'use strict';

  var splash = document.getElementById('splash');
  var splashVideo = document.getElementById('splash-video');
  var tabBar = document.getElementById('tab-bar');
  var settingsPanel = document.getElementById('panel-settings');
  var settingsOpen = document.getElementById('open-settings');
  var settingsBack = document.getElementById('settings-back');
  var settingsApply = document.getElementById('settings-apply-location');
  var toastEl = document.getElementById('app-toast');
  var currentTab = 'home';
  var exitArmedUntil = 0;
  var exitPressCount = 0;
  var EXIT_PRESSES_NEEDED = 2;
  var EXIT_WINDOW_MS = 2500;
  var toastTimer = null;

  function setTabButtons(tab) {
    if (!tabBar) return;
    var buttons = tabBar.querySelectorAll('.tab-btn');
    for (var i = 0; i < buttons.length; i += 1) {
      var active = buttons[i].getAttribute('data-tab') === tab;
      buttons[i].classList.toggle('is-active', active);
      buttons[i].setAttribute('aria-current', active ? 'page' : 'false');
    }
  }

  function showScreen(tab) {
    currentTab = tab === 'sky' ? 'sky' : tab;
    var home = document.getElementById('screen-home');
    var events = document.getElementById('screen-events');
    if (home) home.hidden = tab !== 'home';
    if (events) events.hidden = tab !== 'events';
    setTabButtons(tab === 'sky' ? 'sky' : tab);
    var host = document.getElementById('screen-host');
    if (host && tab !== 'sky') host.scrollTop = 0;
  }

  function showToast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.hidden = false;
    toastEl.classList.add('is-visible');
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toastEl.classList.remove('is-visible');
      toastEl.hidden = true;
    }, 2200);
  }

  function resetExitArmed() {
    exitPressCount = 0;
    exitArmedUntil = 0;
  }

  function showTab(tab) {
    resetExitArmed();
    if (settingsPanel) settingsPanel.hidden = true;
    if (window.__uniteEvents && typeof window.__uniteEvents.closePanels === 'function') {
      window.__uniteEvents.closePanels();
    }
    if (tab === 'sky') {
      enterAstroWalk();
      return;
    }
    exitAstroWalk();
    showScreen(tab);
    if (tab === 'home' && window.__uniteHome && typeof window.__uniteHome.refresh === 'function') {
      window.__uniteHome.refresh();
    }
  }

  function showEventsHome() {
    showTab('events');
  }

  function enterAstroWalk(hint) {
    resetExitArmed();
    if (window.__uniteSkyPoc && typeof window.__uniteSkyPoc.enterAstroWalk === 'function') {
      window.__uniteSkyPoc.enterAstroWalk(hint);
    } else {
      document.body.classList.add('mode-astro');
      window.dispatchEvent(new Event('resize'));
    }
    setTabButtons('sky');
    currentTab = 'sky';
  }

  function exitAstroWalk() {
    if (window.__uniteSkyPoc && typeof window.__uniteSkyPoc.exitAstroWalk === 'function') {
      window.__uniteSkyPoc.exitAstroWalk();
    } else {
      document.body.classList.remove('mode-astro');
    }
  }

  function goHome() {
    resetExitArmed();
    if (settingsPanel) settingsPanel.hidden = true;
    if (window.__uniteEvents && typeof window.__uniteEvents.closePanels === 'function') {
      window.__uniteEvents.closePanels();
    }
    exitAstroWalk();
    showScreen('home');
    if (window.__uniteHome && typeof window.__uniteHome.refresh === 'function') {
      window.__uniteHome.refresh();
    }
  }

  function finishSplash() {
    if (!splash || splash.classList.contains('is-done')) return;
    splash.classList.add('is-done');
    window.setTimeout(function () {
      if (splash && splash.parentNode) splash.parentNode.removeChild(splash);
    }, 400);
  }

  function startSplash() {
    if (!splash) return;
    var done = false;
    var complete = function () {
      if (done) return;
      done = true;
      finishSplash();
    };
    var fallback = window.setTimeout(complete, 7000);

    if (!splashVideo) {
      window.setTimeout(complete, 1800);
      return;
    }

    splashVideo.muted = true;
    splashVideo.defaultMuted = true;
    splashVideo.playsInline = true;
    splashVideo.setAttribute('muted', '');
    splashVideo.setAttribute('playsinline', '');
    splashVideo.setAttribute('webkit-playsinline', '');

    var revealed = false;
    var reveal = function () {
      if (revealed) return;
      revealed = true;
      splashVideo.classList.add('is-playing');
    };

    var onEnded = function () {
      window.clearTimeout(fallback);
      complete();
    };
    splashVideo.addEventListener('ended', onEnded, { once: true });
    splashVideo.addEventListener('error', function () {
      window.clearTimeout(fallback);
      window.setTimeout(complete, 400);
    }, { once: true });

    // Reveal only after real playback (avoids frozen first-frame stall).
    splashVideo.addEventListener('playing', reveal, { once: true });
    if (typeof splashVideo.requestVideoFrameCallback === 'function') {
      splashVideo.requestVideoFrameCallback(function () {
        reveal();
      });
    }

    var startPlayback = function () {
      try { splashVideo.currentTime = 0; } catch (e) { /* ignore */ }
      var play = splashVideo.play();
      if (play && typeof play.then === 'function') {
        play.then(function () {
          reveal();
        }).catch(function () {
          reveal();
          window.clearTimeout(fallback);
          window.setTimeout(complete, 5600);
        });
      } else {
        reveal();
      }
    };

    if (splashVideo.readyState >= 3) {
      startPlayback();
    } else {
      splashVideo.addEventListener('canplay', startPlayback, { once: true });
      splashVideo.load();
    }
  }

  /**
   * Hardware back. Return true if handled (stay in app), false to leave the app.
   * One back from Events / Astro Walk / overlays → Home. On Home, need two presses.
   */
  function handleBack() {
    if (splash && splash.parentNode && !splash.classList.contains('is-done')) {
      finishSplash();
      return true;
    }

    if (settingsPanel && !settingsPanel.hidden) {
      settingsPanel.hidden = true;
      return true;
    }

    if (window.__uniteCelestial && typeof window.__uniteCelestial.handleBack === 'function') {
      if (window.__uniteCelestial.handleBack()) return true;
    }

    if (window.__uniteEvents && typeof window.__uniteEvents.handleBack === 'function') {
      if (window.__uniteEvents.handleBack()) return true;
    }

    if (window.__uniteSkyPoc && typeof window.__uniteSkyPoc.handleBack === 'function') {
      if (window.__uniteSkyPoc.handleBack()) return true;
    }

    if (document.body.classList.contains('mode-astro') || currentTab === 'sky') {
      goHome();
      showToast('Home');
      return true;
    }

    if (currentTab === 'events') {
      goHome();
      showToast('Home');
      return true;
    }

    // Home: require a second back within the window, with a toast first.
    var now = Date.now();
    if (now > exitArmedUntil) {
      exitPressCount = 0;
    }
    exitPressCount += 1;
    exitArmedUntil = now + EXIT_WINDOW_MS;

    if (exitPressCount < EXIT_PRESSES_NEEDED) {
      showToast('Press back again to close Unite');
      return true;
    }

    resetExitArmed();
    return false;
  }

  function bindCapacitorBack() {
    try {
      if (!window.Capacitor || typeof window.Capacitor.registerPlugin !== 'function') return;
      var App = window.Capacitor.registerPlugin('App');
      if (!App || typeof App.addListener !== 'function') return;
      App.addListener('backButton', function () {
        if (!handleBack()) {
          if (typeof App.exitApp === 'function') App.exitApp();
        }
      });
    } catch (e) {
      // Native MainActivity still handles back via __uniteHandleBack.
    }
  }

  if (tabBar) {
    tabBar.addEventListener('click', function (event) {
      var button = event.target.closest('.tab-btn');
      if (!button) return;
      showTab(button.getAttribute('data-tab'));
    });
  }

  if (settingsOpen) {
    settingsOpen.addEventListener('click', function () {
      resetExitArmed();
      if (settingsPanel) settingsPanel.hidden = false;
    });
  }
  if (settingsBack) {
    settingsBack.addEventListener('click', function () {
      if (settingsPanel) settingsPanel.hidden = true;
    });
  }
  if (settingsApply) {
    settingsApply.addEventListener('click', function () {
      if (window.__uniteHome) window.__uniteHome.refresh();
      if (window.__uniteSkyPoc && window.__uniteSkyPoc.engine) {
        var lat = Number(document.getElementById('lat').value);
        var lon = Number(document.getElementById('lon').value);
        if (Number.isFinite(lat) && Number.isFinite(lon) && window.__uniteSkyPoc.engine.setHorizon) {
          window.__uniteSkyPoc.engine.setHorizon(lat, lon, new Date());
        }
      }
      if (settingsPanel) settingsPanel.hidden = true;
    });
  }

  window.__uniteHandleBack = handleBack;
  window.__uniteApp = {
    enterAstroWalk: enterAstroWalk,
    exitAstroWalk: function () {
      exitAstroWalk();
      showScreen('home');
    },
    showEventsHome: showEventsHome,
    showTab: showTab,
    goHome: goHome,
    finishSplash: finishSplash,
    handleBack: handleBack,
    showToast: showToast,
    getCurrentTab: function () { return currentTab; }
  };

  window.setTimeout(function () {
    if (!window.__uniteSkyPoc) return;
    var previousExit = window.__uniteSkyPoc.exitAstroWalk;
    window.__uniteSkyPoc.exitAstroWalk = function () {
      if (typeof previousExit === 'function') previousExit();
      showScreen('home');
    };
  }, 0);

  bindCapacitorBack();
  showScreen('home');

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startSplash);
  } else {
    startSplash();
  }
}());
