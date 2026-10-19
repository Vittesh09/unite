(function () {
  'use strict';

  var events = [];
  var bookingsKey = 'unite.bookings.v1';
  var activeEventId = null;

  var listEl = document.getElementById('event-list');
  var searchInput = document.getElementById('event-search');
  var detailPanel = document.getElementById('panel-detail');
  var bookPanel = document.getElementById('panel-book');
  var confirmPanel = document.getElementById('panel-confirm');
  var detailBody = document.getElementById('detail-body');
  var bookBody = document.getElementById('book-body');
  var confirmBody = document.getElementById('confirm-body');

  function loadBookings() {
    try {
      return JSON.parse(localStorage.getItem(bookingsKey) || '[]');
    } catch (e) {
      return [];
    }
  }

  function saveBooking(record) {
    var all = loadBookings();
    all.unshift(record);
    localStorage.setItem(bookingsKey, JSON.stringify(all.slice(0, 40)));
  }

  function findEvent(id) {
    for (var i = 0; i < events.length; i += 1) {
      if (events[i].id === id) return events[i];
    }
    return null;
  }

  function closePanels() {
    if (detailPanel) detailPanel.hidden = true;
    if (bookPanel) bookPanel.hidden = true;
    if (confirmPanel) confirmPanel.hidden = true;
  }

  /** Step back through event panels. Returns true if handled. */
  function handleBack() {
    if (confirmPanel && !confirmPanel.hidden) {
      closePanels();
      return true;
    }
    if (bookPanel && !bookPanel.hidden) {
      if (activeEventId) openDetail(activeEventId);
      else closePanels();
      return true;
    }
    if (detailPanel && !detailPanel.hidden) {
      closePanels();
      return true;
    }
    return false;
  }

  function renderList(query) {
    if (!listEl) return;
    var needle = (query || '').trim().toLowerCase();
    listEl.replaceChildren();
    var hits = events.filter(function (event) {
      if (!needle) return true;
      return (
        event.title.toLowerCase().indexOf(needle) !== -1 ||
        event.place.toLowerCase().indexOf(needle) !== -1 ||
        event.summary.toLowerCase().indexOf(needle) !== -1
      );
    });
    if (!hits.length) {
      var empty = document.createElement('div');
      empty.className = 'empty-state glass';
      empty.textContent = 'No events match that search.';
      listEl.appendChild(empty);
      return;
    }
    hits.forEach(function (event) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'event-card glass';
      button.innerHTML =
        '<div class="thumb ' + (event.thumb || 't1') + '" aria-hidden="true"></div>' +
        '<div>' +
        '<h2></h2>' +
        '<p></p>' +
        '<div class="meta"></div>' +
        '</div>';
      button.querySelector('h2').textContent = event.title;
      button.querySelector('p').textContent = event.summary;
      var meta = button.querySelector('.meta');
      var when = document.createElement('span');
      when.className = 'chip';
      when.textContent = event.whenLabel;
      var place = document.createElement('span');
      place.className = 'chip';
      place.textContent = event.place;
      var spots = document.createElement('span');
      spots.className = 'chip';
      spots.textContent = event.spotsLeft + ' spots';
      meta.appendChild(when);
      meta.appendChild(place);
      meta.appendChild(spots);
      button.addEventListener('click', function () {
        openDetail(event.id);
      });
      listEl.appendChild(button);
    });
  }

  function openDetail(id) {
    var event = findEvent(id);
    if (!event || !detailPanel || !detailBody) return;
    activeEventId = id;
    closePanels();
    detailBody.innerHTML = '';
    var hero = document.createElement('div');
    hero.className = 'hero-block ' + (event.thumb || 't1');
    var title = document.createElement('h2');
    title.textContent = event.title;
    var lede = document.createElement('p');
    lede.className = 'lede';
    lede.textContent = event.description;
    var grid = document.createElement('div');
    grid.className = 'stat-grid';
    [
      ['When', event.whenLabel],
      ['Duration', event.duration],
      ['Place', event.place],
      ['Host', event.host],
      ['Price', event.priceLabel],
      ['Spots left', String(event.spotsLeft) + ' / ' + String(event.capacity)]
    ].forEach(function (row) {
      var stat = document.createElement('div');
      stat.className = 'stat glass';
      var label = document.createElement('label');
      label.textContent = row[0];
      var strong = document.createElement('strong');
      strong.textContent = row[1];
      stat.appendChild(label);
      stat.appendChild(strong);
      grid.appendChild(stat);
    });
    var actions = document.createElement('div');
    actions.className = 'btn-row';
    var book = document.createElement('button');
    book.type = 'button';
    book.className = 'btn btn-primary';
    book.textContent = 'Book this event';
    book.addEventListener('click', function () {
      openBook(event.id);
    });
    var sky = document.createElement('button');
    sky.type = 'button';
    sky.className = 'btn';
    sky.textContent = 'Open sky for this night';
    sky.addEventListener('click', function () {
      if (window.__uniteApp && typeof window.__uniteApp.enterAstroWalk === 'function') {
        window.__uniteApp.enterAstroWalk(event.title);
      }
    });
    var hint = document.createElement('p');
    hint.className = 'lede';
    hint.textContent = event.skyHint || '';
    actions.appendChild(book);
    actions.appendChild(sky);
    detailBody.appendChild(hero);
    detailBody.appendChild(title);
    detailBody.appendChild(lede);
    detailBody.appendChild(grid);
    if (event.skyHint) detailBody.appendChild(hint);
    detailBody.appendChild(actions);
    detailPanel.hidden = false;
  }

  function openBook(id) {
    var event = findEvent(id);
    if (!event || !bookPanel || !bookBody) return;
    activeEventId = id;
    closePanels();
    bookBody.innerHTML = '';
    var title = document.createElement('h2');
    title.textContent = 'Book · ' + event.title;
    var lede = document.createElement('p');
    lede.className = 'lede';
    lede.textContent = event.whenLabel + ' · ' + event.place + ' · ' + event.priceLabel;
    var form = document.createElement('form');
    form.id = 'booking-form';
    form.innerHTML =
      '<label class="field"><span>Full name</span><input name="name" required autocomplete="name" placeholder="Your name"></label>' +
      '<label class="field"><span>Email</span><input name="email" type="email" required autocomplete="email" placeholder="you@email.com"></label>' +
      '<label class="field"><span>Party size</span><select name="party">' +
      '<option value="1">1 person</option>' +
      '<option value="2">2 people</option>' +
      '<option value="3">3 people</option>' +
      '<option value="4">4 people</option>' +
      '<option value="5">5 people</option>' +
      '</select></label>' +
      '<p class="error-text" id="book-error" hidden></p>' +
      '<div class="btn-row">' +
      '<button class="btn btn-primary" type="submit">Confirm booking</button>' +
      '<button class="btn btn-ghost" type="button" id="book-cancel">Cancel</button>' +
      '</div>';
    bookBody.appendChild(title);
    bookBody.appendChild(lede);
    bookBody.appendChild(form);
    form.addEventListener('submit', function (eventSubmit) {
      eventSubmit.preventDefault();
      var data = new FormData(form);
      var name = String(data.get('name') || '').trim();
      var email = String(data.get('email') || '').trim();
      var party = Number(data.get('party') || 1);
      var err = document.getElementById('book-error');
      if (!name || !email || party < 1) {
        if (err) {
          err.hidden = false;
          err.textContent = 'Enter your name, email, and party size.';
        }
        return;
      }
      if (party > event.spotsLeft) {
        if (err) {
          err.hidden = false;
          err.textContent = 'Only ' + event.spotsLeft + ' spots left for this event.';
        }
        return;
      }
      var code = 'UNITE-' + String(Date.now()).slice(-8);
      var record = {
        code: code,
        eventId: event.id,
        title: event.title,
        whenLabel: event.whenLabel,
        place: event.place,
        name: name,
        email: email,
        party: party,
        createdAt: new Date().toISOString()
      };
      saveBooking(record);
      event.spotsLeft = Math.max(0, event.spotsLeft - party);
      renderList(searchInput ? searchInput.value : '');
      openConfirm(record);
    });
    var cancel = document.getElementById('book-cancel');
    if (cancel) {
      cancel.addEventListener('click', function () {
        openDetail(event.id);
      });
    }
    bookPanel.hidden = false;
  }

  function openConfirm(record) {
    closePanels();
    if (!confirmPanel || !confirmBody) return;
    confirmBody.innerHTML = '';
    var card = document.createElement('div');
    card.className = 'confirm-card glass-strong';
    card.innerHTML =
      '<h2>You are booked</h2>' +
      '<p class="lede"></p>' +
      '<div class="code"></div>' +
      '<p class="lede"></p>' +
      '<div class="btn-row">' +
      '<button class="btn btn-primary" type="button" id="confirm-done">Back to events</button>' +
      '<button class="btn" type="button" id="confirm-sky">Open Astro Walk</button>' +
      '</div>';
    card.querySelectorAll('.lede')[0].textContent = record.title + ' · ' + record.whenLabel;
    card.querySelector('.code').textContent = record.code;
    card.querySelectorAll('.lede')[1].textContent =
      'Saved on this device for ' + record.name + ' · party of ' + record.party + '. No payment in this build.';
    confirmBody.appendChild(card);
    document.getElementById('confirm-done').addEventListener('click', function () {
      closePanels();
    });
    document.getElementById('confirm-sky').addEventListener('click', function () {
      closePanels();
      if (window.__uniteApp && typeof window.__uniteApp.enterAstroWalk === 'function') {
        window.__uniteApp.enterAstroWalk(record.title);
      }
    });
    confirmPanel.hidden = false;
  }

  function bindChrome() {
    var backDetail = document.getElementById('detail-back');
    var backBook = document.getElementById('book-back');
    if (backDetail) backDetail.addEventListener('click', closePanels);
    if (backBook) {
      backBook.addEventListener('click', function () {
        if (activeEventId) openDetail(activeEventId);
        else closePanels();
      });
    }
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        renderList(searchInput.value);
      });
    }
  }

  function boot(data) {
    events = Array.isArray(data) ? data.slice() : [];
    bindChrome();
    renderList('');
    window.__uniteEvents = {
      openDetail: openDetail,
      closePanels: closePanels,
      handleBack: handleBack,
      getEvents: function () { return events.slice(); }
    };
  }

  function start() {
    fetch('data/events.json')
      .then(function (response) {
        if (!response.ok) throw new Error('events.json missing');
        return response.json();
      })
      .then(boot)
      .catch(function () {
        boot([]);
        if (listEl) {
          listEl.innerHTML = '<div class="empty-state glass">Event catalogue failed to load.</div>';
        }
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
}());
