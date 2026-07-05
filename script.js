(function () {
  'use strict';

  /* ?noanim — disable entrance animations (useful for QA screenshots) */
  if (window.location.search.indexOf('noanim') !== -1) {
    document.documentElement.classList.add('no-anim');
  }

  /* header shadow on scroll */
  var header = document.querySelector('[data-header]');
  function onScroll() {
    header.classList.toggle('scrolled', window.scrollY > 8);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* mobile menu */
  var toggle = document.querySelector('[data-menu-toggle]');
  var links = document.querySelector('[data-nav-links]');
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      var open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    links.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        links.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* reveal on scroll */
  var revealEls = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('revealed'); });
  }

  /* infinite logo marquee — rAF pixel scroll, two identical segments */
  var LOGO_SPEED = 34;
  var logoReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function logoStripWidth(strip) {
    return Math.max(Math.ceil(strip.getBoundingClientRect().width), 320);
  }

  function whenLogoImagesReady(root, cb) {
    var imgs = root.querySelectorAll('img');
    if (!imgs.length) { cb(); return; }
    var pending = 0;
    Array.prototype.forEach.call(imgs, function (img) {
      if (img.complete && img.naturalWidth > 0) return;
      pending += 1;
      img.addEventListener('load', onDone, { once: true });
      img.addEventListener('error', onDone, { once: true });
    });
    if (pending === 0) { cb(); return; }
    function onDone() {
      pending -= 1;
      if (pending <= 0) cb();
    }
  }

  document.querySelectorAll('.logo-track').forEach(function (track) {
    var strip = track.parentElement;
    var groups = track.querySelectorAll('.logo-group');
    if (groups.length < 2) return;

    var groupA = groups[0];
    var groupB = groups[1];
    var base = Array.prototype.map.call(
      groupA.querySelectorAll('.logo-pill'),
      function (pill) { return pill.cloneNode(true); }
    );
    if (!base.length) return;

    var state = { pos: 0, segment: 0, paused: false, lastTs: 0, fillId: 0, raf: 0 };

    track.addEventListener('mouseenter', function () { state.paused = true; });
    track.addEventListener('mouseleave', function () { state.paused = false; });

    function appendPill(group, index, hideA11y) {
      var pill = base[index % base.length].cloneNode(true);
      if (hideA11y) {
        pill.setAttribute('aria-hidden', 'true');
        var img = pill.querySelector('img');
        if (img) img.alt = '';
      }
      group.appendChild(pill);
    }

    function buildSegment(group) {
      group.innerHTML = '';
      for (var i = 0; i < base.length; i += 1) {
        appendPill(group, i, false);
      }
    }

    function widenSegmentGap(minWidth) {
      var gap = 20;
      track.style.setProperty('--logo-gap', gap + 'px');
      while (groupA.offsetWidth < minWidth && gap <= 72) {
        gap += 8;
        track.style.setProperty('--logo-gap', gap + 'px');
      }
    }

    function ensureSegmentWidth(minWidth) {
      widenSegmentGap(minWidth);
      if (groupA.offsetWidth < minWidth) {
        for (var j = 0; j < base.length; j += 1) {
          appendPill(groupA, j, true);
        }
      }
    }

    function mirrorSegment(group) {
      group.setAttribute('aria-hidden', 'true');
      group.querySelectorAll('.logo-pill').forEach(function (pill) {
        pill.setAttribute('aria-hidden', 'true');
        var img = pill.querySelector('img');
        if (img) img.alt = '';
      });
    }

    function tick(ts) {
      state.raf = requestAnimationFrame(tick);
      if (!state.segment || logoReducedMotion) return;
      if (state.paused) {
        state.lastTs = 0;
        return;
      }
      if (!state.lastTs) {
        state.lastTs = ts;
        return;
      }
      var dt = Math.min((ts - state.lastTs) / 1000, 0.064);
      state.lastTs = ts;
      state.pos -= LOGO_SPEED * dt;
      while (state.pos <= -state.segment) state.pos += state.segment;
      track.style.transform = 'translate3d(' + state.pos + 'px,0,0)';
    }

    function rebuild() {
      var id = ++state.fillId;
      state.segment = 0;
      var minWidth = logoStripWidth(strip) + 100;

      buildSegment(groupA);

      whenLogoImagesReady(groupA, function () {
        if (id !== state.fillId) return;

        ensureSegmentWidth(minWidth);

        groupB.innerHTML = groupA.innerHTML;
        mirrorSegment(groupB);

        state.segment = groupA.offsetWidth;
        if (state.segment <= 0) return;

        state.pos = 0;
        track.style.transform = 'translate3d(0,0,0)';
        if (!state.raf) state.raf = requestAnimationFrame(tick);
      });
    }

    rebuild();
    window.addEventListener('load', rebuild);

    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(rebuild, 250);
    }, { passive: true });
  });

  /* FAQ — keep only one open */
  var faqItems = document.querySelectorAll('.faq details');
  faqItems.forEach(function (item) {
    item.addEventListener('toggle', function () {
      if (item.open) {
        faqItems.forEach(function (other) {
          if (other !== item) other.open = false;
        });
      }
    });
  });

  /* contact form — client-side success state.
     TODO before launch: connect to email / CRM / automation. */
  var form = document.querySelector('[data-contact-form]');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      var success = form.querySelector('.success-message');
      form.querySelector('.form-grid').style.visibility = 'hidden';
      success.hidden = false;
      success.focus();
    });
  }
})();
