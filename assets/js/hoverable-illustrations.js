(function () {
  function replaceOnHover(imgEl, newSrc) {
    const origSrc = imgEl.getAttribute('src');

    imgEl.addEventListener('mouseenter', () => {
      imgEl.setAttribute('src', newSrc);
    });
    imgEl.addEventListener('mouseleave', () => {
      imgEl.setAttribute('src', origSrc);
    });
  }

  window.setTimeout(() => {
    const hoverableIllustrations = document.querySelectorAll('.hoverable');

    for (const illustration of hoverableIllustrations) {
      const el = illustration.querySelector('img');
      const onHoverPath = illustration.querySelector('a').getAttribute('href');
      replaceOnHover(el, onHoverPath);
    }
  }, 500);
}());
