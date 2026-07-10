(function () {
  function replaceOnHover(imgEl, newSrc) {
    if (imgEl.dataset.hoverableBound === '1') return;
    imgEl.dataset.hoverableBound = '1';
    const origSrc = imgEl.getAttribute('src');

    imgEl.addEventListener('mouseenter', () => {
      imgEl.setAttribute('src', newSrc);
    });
    imgEl.addEventListener('mouseleave', () => {
      imgEl.setAttribute('src', origSrc);
    });
  }

  function init() {
    const hoverableIllustrations = document.querySelectorAll('.hoverable:not([data-hoverable-bound])');
    for (const illustration of hoverableIllustrations) {
      illustration.setAttribute('data-hoverable-bound', '1');
      const el = illustration.querySelector('img');
      const link = illustration.querySelector('a');
      if (!el || !link) continue;
      replaceOnHover(el, link.getAttribute('href'));
    }
  }

  window.__initHoverable = init;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 100));
  } else {
    setTimeout(init, 100);
  }
}());
