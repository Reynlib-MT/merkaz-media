(function () {
  'use strict';

  /* ?noanim — disable entrance animations (useful for QA screenshots) */
  if (window.location.search.indexOf('noanim') !== -1) {
    document.documentElement.classList.add('no-anim');
  }

  /* bind last two words with NBSP — skip forms and editable fields */
  (function preventOrphans(root) {
    var skipTags = {
      SCRIPT: 1,
      STYLE: 1,
      NOSCRIPT: 1,
      TEXTAREA: 1,
      INPUT: 1,
      SELECT: 1,
      OPTION: 1,
      FORM: 1
    };

    function inSkippedSubtree(node) {
      var el = node.parentElement;
      while (el) {
        if (skipTags[el.tagName]) return true;
        el = el.parentElement;
      }
      return false;
    }

    function bindLastTwoWords(text) {
      var trimmed = text.replace(/\s+$/, '');
      var trailing = text.slice(trimmed.length);
      if (!trimmed || trimmed.indexOf(' ') === -1) return text;

      var lastSpace = trimmed.lastIndexOf(' ');
      var lastNbsp = trimmed.lastIndexOf('\u00A0');
      if (lastNbsp > lastSpace) return text;

      return trimmed.slice(0, lastSpace) + '\u00A0' + trimmed.slice(lastSpace + 1) + trailing;
    }

    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!node.nodeValue || !/\S/.test(node.nodeValue)) return NodeFilter.FILTER_REJECT;
        if (inSkippedSubtree(node)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    var textNode;
    while ((textNode = walker.nextNode())) {
      var fixed = bindLastTwoWords(textNode.nodeValue);
      if (fixed !== textNode.nodeValue) textNode.nodeValue = fixed;
    }
  })(document.body);

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

  /* infinite marquee — rAF pixel scroll, two identical segments */
  var LOGO_SPEED = 34;
  var CAP_SPEED = 42;
  var marqueeReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function marqueeStripWidth(strip) {
    return Math.max(Math.ceil(strip.getBoundingClientRect().width), 320);
  }

  function whenMarqueeImagesReady(root, cb) {
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

  function initMarqueeTrack(track, opts) {
    var groups = track.querySelectorAll(opts.groupSelector);
    if (groups.length < 2) return;

    var groupA = groups[0];
    var groupB = groups[1];
    var base = Array.prototype.map.call(
      groupA.querySelectorAll(opts.itemSelector),
      function (item) { return item.cloneNode(true); }
    );
    if (!base.length) return;

    var strip = track.parentElement;
    var state = { pos: 0, segment: 0, paused: false, lastTs: 0, fillId: 0, raf: 0 };

    track.addEventListener('mouseenter', function () { state.paused = true; });
    track.addEventListener('mouseleave', function () { state.paused = false; });

    function appendItem(group, index, hideA11y) {
      var item = base[index % base.length].cloneNode(true);
      if (hideA11y) {
        item.setAttribute('aria-hidden', 'true');
        if (opts.clearImgAlt) {
          var img = item.querySelector('img');
          if (img) img.alt = '';
        }
      }
      group.appendChild(item);
    }

    function buildSegment(group) {
      group.innerHTML = '';
      for (var i = 0; i < base.length; i += 1) {
        appendItem(group, i, false);
      }
    }

    function widenSegmentGap(minWidth) {
      var gap = opts.defaultGap;
      track.style.setProperty(opts.gapProp, gap + 'px');
      while (groupA.offsetWidth < minWidth && gap <= opts.maxGap) {
        gap += 8;
        track.style.setProperty(opts.gapProp, gap + 'px');
      }
    }

    function ensureSegmentWidth(minWidth) {
      widenSegmentGap(minWidth);
      if (groupA.offsetWidth < minWidth) {
        for (var j = 0; j < base.length; j += 1) {
          appendItem(groupA, j, true);
        }
      }
    }

    function mirrorSegment(group) {
      group.setAttribute('aria-hidden', 'true');
      group.querySelectorAll(opts.itemSelector).forEach(function (item) {
        item.setAttribute('aria-hidden', 'true');
        if (opts.clearImgAlt) {
          var img = item.querySelector('img');
          if (img) img.alt = '';
        }
      });
    }

    function tick(ts) {
      state.raf = requestAnimationFrame(tick);
      if (!state.segment || marqueeReducedMotion) return;
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
      if (opts.reverse) {
        state.pos += opts.speed * dt;
        while (state.pos >= 0) state.pos -= state.segment;
      } else {
        state.pos -= opts.speed * dt;
        while (state.pos <= -state.segment) state.pos += state.segment;
      }
      track.style.transform = 'translate3d(' + state.pos + 'px,0,0)';
    }

    function rebuild() {
      var id = ++state.fillId;
      state.segment = 0;
      var minWidth = marqueeStripWidth(strip) + 100;

      buildSegment(groupA);

      function onReady() {
        if (id !== state.fillId) return;

        ensureSegmentWidth(minWidth);

        groupB.innerHTML = groupA.innerHTML;
        mirrorSegment(groupB);

        state.segment = groupA.offsetWidth;
        if (state.segment <= 0) return;

        state.pos = opts.reverse ? -state.segment : 0;
        track.style.transform = 'translate3d(' + state.pos + 'px,0,0)';
        if (!state.raf) state.raf = requestAnimationFrame(tick);
      }

      if (opts.waitForImages) {
        whenMarqueeImagesReady(groupA, onReady);
      } else {
        onReady();
      }
    }

    rebuild();
    window.addEventListener('load', rebuild);

    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(rebuild, 250);
    }, { passive: true });
  }

  document.querySelectorAll('.logo-track').forEach(function (track) {
    initMarqueeTrack(track, {
      groupSelector: '.logo-group',
      itemSelector: '.logo-pill',
      speed: LOGO_SPEED,
      gapProp: '--logo-gap',
      defaultGap: 20,
      maxGap: 72,
      waitForImages: true,
      clearImgAlt: true
    });
  });

  document.querySelectorAll('.cap-track').forEach(function (track) {
    initMarqueeTrack(track, {
      groupSelector: '.cap-group',
      itemSelector: '.cap',
      speed: CAP_SPEED,
      gapProp: '--cap-gap',
      defaultGap: 16,
      maxGap: 56,
      waitForImages: false,
      clearImgAlt: false,
      reverse: true
    });
  });

  /* work section — fullscreen image lightbox */
  var workLightbox = document.getElementById('work-lightbox');
  if (workLightbox) {
    var lbImg = workLightbox.querySelector('.work-lightbox-img');
    var lbClose = workLightbox.querySelector('.work-lightbox-close');
    var lbBackdrop = workLightbox.querySelector('.work-lightbox-backdrop');
    var lbLastFocus = null;

    function openWorkLightbox(img) {
      lbLastFocus = document.activeElement;
      lbImg.src = img.currentSrc || img.src;
      lbImg.alt = img.alt;
      workLightbox.hidden = false;
      workLightbox.setAttribute('aria-hidden', 'false');
      workLightbox.setAttribute('role', 'dialog');
      workLightbox.setAttribute('aria-modal', 'true');
      document.body.classList.add('work-lightbox-open');
      lbClose.focus();
    }

    function closeWorkLightbox() {
      workLightbox.hidden = true;
      workLightbox.setAttribute('aria-hidden', 'true');
      workLightbox.removeAttribute('role');
      workLightbox.removeAttribute('aria-modal');
      lbImg.removeAttribute('src');
      lbImg.alt = '';
      document.body.classList.remove('work-lightbox-open');
      if (lbLastFocus && lbLastFocus.focus) lbLastFocus.focus();
    }

    document.querySelectorAll('#work .work-media').forEach(function (media) {
      var img = media.querySelector('img');
      if (!img) return;

      media.setAttribute('role', 'button');
      media.setAttribute('tabindex', '0');
      media.setAttribute('aria-label', 'הגדלת תמונה: ' + (img.alt || ''));

      function openFromMedia() { openWorkLightbox(img); }

      media.addEventListener('click', openFromMedia);
      media.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openFromMedia();
        }
      });
    });

    lbClose.addEventListener('click', closeWorkLightbox);
    lbBackdrop.addEventListener('click', closeWorkLightbox);

    document.addEventListener('keydown', function (e) {
      if (!workLightbox.hidden && e.key === 'Escape') closeWorkLightbox();
    });
  }

  /* contact popup — open from CTA buttons */
  var contactPopup = document.getElementById('contact-popup');
  var contactPopupLastFocus = null;

  function closeMobileMenu() {
    if (toggle && links) {
      links.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  }

  function openContactPopup() {
    if (!contactPopup) return;
    contactPopupLastFocus = document.activeElement;
    contactPopup.hidden = false;
    contactPopup.setAttribute('aria-hidden', 'false');
    document.body.classList.add('contact-popup-open');
    closeMobileMenu();
    var firstInput = contactPopup.querySelector('input:not([type="hidden"])');
    if (firstInput) {
      window.setTimeout(function () { firstInput.focus(); }, 0);
    }
  }

  function closeContactPopup() {
    if (!contactPopup) return;
    contactPopup.hidden = true;
    contactPopup.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('contact-popup-open');
    if (contactPopupLastFocus && contactPopupLastFocus.focus) contactPopupLastFocus.focus();
  }

  if (contactPopup) {
    var popupBackdrop = contactPopup.querySelector('.contact-popup-backdrop');
    var popupClose = contactPopup.querySelector('.contact-popup-close');

    document.querySelectorAll('[data-contact-open]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        openContactPopup();
      });
    });

    if (popupBackdrop) popupBackdrop.addEventListener('click', closeContactPopup);
    if (popupClose) popupClose.addEventListener('click', closeContactPopup);
  }

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (contactPopup && !contactPopup.hidden) closeContactPopup();
  });

  function bindContactFormSuccess(form, fieldsSelector) {
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      var success = form.querySelector('.success-message');
      var fields = form.querySelector(fieldsSelector);
      if (fields) fields.style.visibility = 'hidden';
      var submitBtn = form.querySelector('.btn-submit');
      var note = form.querySelector('.form-note');
      if (submitBtn) submitBtn.style.visibility = 'hidden';
      if (note) note.style.visibility = 'hidden';
      success.hidden = false;
      success.focus();
    });
  }

  bindContactFormSuccess(document.querySelector('[data-contact-form]'), '.form-grid');
  bindContactFormSuccess(document.querySelector('[data-contact-popup-form]'), '.contact-popup-fields');
})();
