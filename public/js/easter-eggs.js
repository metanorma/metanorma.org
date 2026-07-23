// WAAPI-powered easter eggs. Loaded once via BaseLayout (defer +
// is:inline so Astro emits the tag verbatim). Re-attaches per-page
// handlers on `astro:page-load` so View Transitions don't drop them.
//
// Every animation honors prefers-reduced-motion, uses compositor-only
// properties (transform, opacity), and removes its DOM after the
// animation's .finished promise resolves. Keyboard triggers bail when
// the user is in a form field or a dialog is open.
//
// Discover every egg via help() in the console.

(function () {
  'use strict'

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)')

  function reduced() { return REDUCED.matches }
  function rand(min, max) { return Math.random() * (max - min) + min }
  function randInt(min, max) { return Math.floor(rand(min, max + 1)) }

  function isTyping(t) {
    if (!t) return false
    var tag = t.tagName
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable === true
  }
  function dialogOpen() {
    return !!document.querySelector('dialog[open], [data-state="open"], [aria-expanded="true"]')
  }

  function el(tag, props, children) {
    var e = document.createElement(tag)
    if (props) for (var k in props) {
      var v = props[k]
      if (k === 'style' && typeof v === 'object') for (var sk in v) e.style[sk] = v[sk]
      else if (k === 'class') e.className = v
      else if (k === 'text') e.textContent = v
      else if (k === 'dataset') for (var dk in v) e.dataset[dk] = v[dk]
      else e.setAttribute(k, v)
    }
    if (children) for (var i = 0; i < children.length; i++) {
      e.appendChild(typeof children[i] === 'string' ? document.createTextNode(children[i]) : children[i])
    }
    return e
  }

  // Shared "rubber stamp" entrance: scale-in with a slight overshoot,
  // hold, then a smaller scale-out. Used by both the page-wide APPROVED
  // and the code-block PEER REVIEWED stamps.
  function stampIn(node, opts) {
    opts = opts || {}
    var dur = opts.duration || 1600
    var rot = opts.rotation || '-12deg'
    var a = node.animate([
      { transform: 'translate(-50%, -50%) rotate(-30deg) scale(3)', opacity: 0 },
      { transform: 'translate(-50%, -50%) ' + rot + ' scale(1.1)', opacity: 1, offset: 0.25 },
      { transform: 'translate(-50%, -50%) ' + rot + ' scale(1)', opacity: 1, offset: 0.4 },
      { transform: 'translate(-50%, -50%) ' + rot + ' scale(1)', opacity: 1, offset: 0.75 },
      { transform: 'translate(-50%, -50%) ' + rot + ' scale(1.1)', opacity: 0 },
    ], { duration: dur, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' })
    a.finished.then(function () { if (node.parentNode) node.parentNode.removeChild(node) })
  }

  // =========================================================================
  // EGG 1 — Press "A" outside a form field: a page-wide "APPROVED ✓" stamp.
  //   Ties to the standards approval workflow. WAAPI's spring easing on the
  //   scale gives it the rubber-stamp "thud".
  // =========================================================================
  function approveStamp() {
    if (reduced() || dialogOpen()) return
    var stamp = el('div', {
      text: 'APPROVED ✓',
      style: {
        position: 'fixed', top: '50%', left: '50%',
        zIndex: '9000', pointerEvents: 'none',
        padding: '1.5rem 3rem',
        border: '5px solid #b91c1c',
        color: '#b91c1c',
        fontFamily: "'Bricolage Grotesque', Georgia, serif",
        fontSize: 'clamp(2.5rem, 8vw, 5rem)',
        fontWeight: '800', letterSpacing: '0.15em',
        textTransform: 'uppercase',
        borderRadius: '8px',
        background: 'rgba(255,255,255,0.7)',
        opacity: '0',
        boxShadow: 'inset 0 0 0 2px rgba(185,28,28,0.18)',
      },
    })
    document.body.appendChild(stamp)
    stampIn(stamp, { duration: 1600, rotation: '-12deg' })
  }

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'a' && e.key !== 'A') return
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (isTyping(e.target)) return
    approveStamp()
  })

  // =========================================================================
  // EGG 2 — Long-press (1.2s) the header logo: a ratification cascade.
  //   The logo does a 720° spin, a "Joint Secretariat" seal appears
  //   briefly, and the footer tagline slips to a punny alternate.
  //   WAAPI lets the three animations share timing without a CSS chain.
  // =========================================================================
  function logoCascade() {
    if (reduced()) return

    var logo = document.querySelector('header img[alt="Metanorma"], header a[href="/"] img')
    if (logo) {
      logo.animate([
        { transform: 'rotate(0deg) scale(1)' },
        { transform: 'rotate(360deg) scale(1.25)', offset: 0.5 },
        { transform: 'rotate(720deg) scale(1)' },
      ], { duration: 1500, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' })
    }

    var seal = el('div', {
      text: '★ Joint Secretariat ★',
      style: {
        position: 'fixed', top: '15%', right: '5%',
        zIndex: '9000', pointerEvents: 'none',
        padding: '1rem 1.5rem', border: '3px double #575ABE',
        borderRadius: '50%', background: 'rgba(255,255,255,0.95)',
        color: '#1F3D7A', fontFamily: "'Bricolage Grotesque', Georgia, serif",
        fontWeight: '700', fontSize: '0.9rem', textAlign: 'center',
        opacity: '0', maxWidth: '12rem',
        boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
      },
    })
    document.body.appendChild(seal)
    seal.animate([
      { transform: 'scale(0) rotate(-45deg)', opacity: 0 },
      { transform: 'scale(1.1) rotate(-12deg)', opacity: 1, offset: 0.2 },
      { transform: 'scale(1) rotate(-12deg)', opacity: 1, offset: 0.85 },
      { transform: 'scale(1.05) rotate(-12deg)', opacity: 0 },
    ], { duration: 3000, easing: 'ease-out' })
      .finished.then(function () { if (seal.parentNode) seal.parentNode.removeChild(seal) })

    // Footer tagline swap (the header has no tagline; the footer does).
    var tagline = document.querySelector('footer p')
    var taglineCandidates = document.querySelectorAll('footer p')
    taglineCandidates.forEach(function (p) {
      if (p.textContent.trim() === 'The standard of standards') tagline = p
    })
    if (tagline) {
      var original = tagline.textContent
      tagline.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' })
        .finished.then(function () {
          tagline.textContent = 'The standard of committees'
          tagline.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, fill: 'forwards' })
          setTimeout(function () {
            tagline.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' })
              .finished.then(function () {
                tagline.textContent = original
                tagline.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, fill: 'forwards' })
              })
          }, 2500)
        })
    }
  }

  function attachLogoPress() {
    var logo = document.querySelector('header a[href="/"]')
    if (!logo || logo.dataset.mnEgg === '1') return
    logo.dataset.mnEgg = '1'
    var timer = null
    var armed = false
    logo.addEventListener('pointerdown', function () {
      timer = setTimeout(function () {
        armed = true
        logoCascade()
      }, 1200)
    })
    function cancel() { clearTimeout(timer) }
    logo.addEventListener('pointerup', cancel)
    logo.addEventListener('pointerleave', cancel)
    logo.addEventListener('pointercancel', cancel)
    // Suppress the subsequent click so we don't navigate after a cascade.
    logo.addEventListener('click', function (e) {
      if (armed) { e.preventDefault(); armed = false }
    }, true)
  }

  // =========================================================================
  // EGG 3 — Click the footer copyright year 3+ times rapidly: time-machine.
  //   Each subsequent click decrements the year by a random 3–17, like
  //   dialing back a typewriter date. After 2.5s idle, fades back to the
  //   real year. Floors at 1947 (ISO's predecessor, ISA, started 1926;
  //   ISO itself in 1947).
  // =========================================================================
  function footerYear() {
    var CURRENT = new Date().getFullYear()
    var yearEl = null
    var candidates = document.querySelectorAll('footer p, footer span, footer time')
    for (var i = 0; i < candidates.length; i++) {
      var t = candidates[i]
      if (t.children.length === 0 && t.textContent.indexOf(String(CURRENT)) !== -1) {
        yearEl = t; break
      }
    }
    if (!yearEl || yearEl.dataset.mnEgg === '1') return
    yearEl.dataset.mnEgg = '1'

    var clicks = 0
    var lastClick = 0
    var resetTimer = null
    var original = yearEl.textContent

    yearEl.style.cursor = 'pointer'
    yearEl.title = 'Tap-tap-tap…'

    yearEl.addEventListener('click', function () {
      var now = Date.now()
      if (now - lastClick < 600) {
        clicks++
        var year = Math.max(1947, CURRENT - clicks * randInt(3, 17))
        yearEl.textContent = original.replace(String(CURRENT), String(year))
        if (!reduced()) {
          yearEl.animate([
            { transform: 'translateY(-100%)', opacity: 0 },
            { transform: 'translateY(0)', opacity: 1 },
          ], { duration: 200, easing: 'ease-out' })
        }
      }
      lastClick = now
      clearTimeout(resetTimer)
      resetTimer = setTimeout(function () {
        if (!reduced()) {
          yearEl.animate([{ opacity: 1 }, { opacity: 0.3 }, { opacity: 1 }], { duration: 400 })
            .finished.then(function () { yearEl.textContent = original })
        } else {
          yearEl.textContent = original
        }
        clicks = 0
      }, 2500)
    })
  }

  // =========================================================================
  // EGG 4 — Select 280+ characters of text: a small "Drafting committee
  //   convened" toast appears bottom-right. 280 ≈ a typical standards
  //   clause paragraph. 8s cooldown so repeated selections don't spam.
  // =========================================================================
  var lastDraft = 0
  function maybeDraftingToast() {
    var sel = window.getSelection()
    if (!sel || sel.toString().trim().length < 280) return
    if (Date.now() - lastDraft < 8000) return
    if (dialogOpen()) return
    lastDraft = Date.now()

    var toast = el('div', {
      text: '📝 Drafting committee convened',
      style: {
        position: 'fixed', bottom: '2rem', right: '2rem',
        zIndex: '9000', pointerEvents: 'none',
        padding: '0.75rem 1.25rem',
        background: 'var(--mn-c-bg-elv, #fff)',
        border: '1px solid var(--mn-c-divider, #ccc)',
        borderRadius: '0.5rem',
        fontFamily: "'Hanken Grotesk', sans-serif",
        fontSize: '0.875rem', color: 'var(--mn-c-text-1, #333)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        opacity: '0',
      },
    })
    document.body.appendChild(toast)
    if (reduced()) {
      toast.style.opacity = '1'
      setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast) }, 2500)
      return
    }
    toast.animate([
      { transform: 'translateY(20px)', opacity: 0 },
      { transform: 'translateY(0)', opacity: 1, offset: 0.15 },
      { transform: 'translateY(0)', opacity: 1, offset: 0.85 },
      { transform: 'translateY(20px)', opacity: 0 },
    ], { duration: 3500, easing: 'ease-out' })
      .finished.then(function () { if (toast.parentNode) toast.parentNode.removeChild(toast) })
  }

  var selTimer = null
  document.addEventListener('selectionchange', function () {
    clearTimeout(selTimer)
    selTimer = setTimeout(maybeDraftingToast, 600)
  })

  // =========================================================================
  // EGG 5 — Long-press (800ms) inside a <pre>: a "PEER REVIEWED" stamp
  //   sweeps diagonally across the code block. Ties to the standards
  //   peer-review process. 3s cooldown per <pre> so repeat presses don't
  //   pile up stamps.
  // =========================================================================
  function peerReviewStamp(pre) {
    if (reduced()) return
    if (pre.dataset.mnStamped === '1') return
    pre.dataset.mnStamped = '1'
    setTimeout(function () { delete pre.dataset.mnStamped }, 3000)

    if (getComputedStyle(pre).position === 'static') pre.style.position = 'relative'

    var stamp = el('div', {
      text: 'PEER REVIEWED',
      style: {
        position: 'absolute', top: '50%', left: '50%',
        zIndex: '1', pointerEvents: 'none',
        padding: '0.75rem 1.5rem',
        border: '4px solid #b91c1c',
        color: '#b91c1c',
        fontFamily: "'Bricolage Grotesque', Georgia, serif",
        fontSize: 'clamp(1.5rem, 3vw, 2.25rem)',
        fontWeight: '800', letterSpacing: '0.15em',
        textTransform: 'uppercase',
        borderRadius: '6px',
        background: 'rgba(255,255,255,0.85)',
        opacity: '0',
      },
    })
    pre.appendChild(stamp)
    stampIn(stamp, { duration: 2000, rotation: '-18deg' })
  }

  function attachCodeBlocks() {
    var pres = document.querySelectorAll('pre')
    for (var i = 0; i < pres.length; i++) {
      var pre = pres[i]
      if (pre.dataset.mnEggPre === '1') continue
      pre.dataset.mnEggPre = '1'
      var timer = null
      pre.addEventListener('pointerdown', function (e) {
        if (e.target.closest('button, a')) return
        var target = this
        timer = setTimeout(function () { peerReviewStamp(target) }, 800)
      })
      function cancel() { clearTimeout(timer) }
      pre.addEventListener('pointerup', cancel)
      pre.addEventListener('pointerleave', cancel)
      pre.addEventListener('pointercancel', cancel)
    }
  }

  // =========================================================================
  // INIT — runs on first load + every astro:page-load (View Transitions
  // replace the page DOM; the IIFE persists but per-element handlers
  // need re-attaching).
  // =========================================================================
  function init() {
    attachLogoPress()
    attachCodeBlocks()
    footerYear()
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
  document.addEventListener('astro:page-load', init)
})()
