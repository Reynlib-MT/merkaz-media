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

  /* infinite logo marquee — clone the logos until each group is wider than the
     strip, then loop. Two identical groups + translateX(-100%) each = seamless,
     for any number of logos and any screen width. Speed stays constant. */
  var LOGO_SPEED = 55; // px per second
  document.querySelectorAll('.logo-track').forEach(function (track) {
    var groups = track.querySelectorAll('.logo-group');
    if (groups.length < 2) return;
    var strip = track.parentElement; // .logo-strip-inner (overflow: hidden)
    var base = Array.prototype.map.call(
      groups[0].querySelectorAll('.logo-pill'),
      function (pill) { return pill.cloneNode(true); }
    );
    if (!base.length) return;

    function fill() {
      // make each group at least TWO screens wide (plus a floor for safety),
      // so the visible strip is always covered with a big margin — it can
      // never reach the end mid-scroll, at any width
      var vw = strip.clientWidth || window.innerWidth || 1200;
      var target = vw * 2 + 200;
      Array.prototype.forEach.call(groups, function (group, gi) {
        group.innerHTML = '';
        var i = 0, guard = base.length * 200;
        do {
          var node = base[i % base.length].cloneNode(true);
          if (gi === 1 || i >= base.length) node.setAttribute('aria-hidden', 'true');
          group.appendChild(node);
          i++;
        } while (group.scrollWidth < target && i < guard);
      });
      var dur = (groups[0].scrollWidth / LOGO_SPEED) + 's';
      Array.prototype.forEach.call(groups, function (g) {
        g.style.animationDuration = dur;
      });
    }

    fill();
    window.addEventListener('load', fill); // re-measure once images have sizes

    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(fill, 200);
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
