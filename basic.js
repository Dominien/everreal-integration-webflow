document.addEventListener('DOMContentLoaded', () => {
  // Selectors
  const mainImg = document.querySelector('#w-lightbox-view .w-lightbox-img');
  const prevBtn = document.querySelector('.w-lightbox-left');
  const nextBtn = document.querySelector('.w-lightbox-right');
  const strip    = document.querySelector('.w-lightbox-strip');
  const thumbs   = Array.from(document.querySelectorAll('.grid_images .image-down_list'));

  // Build array of real srcs (filtering out placeholders)
  const gallery = thumbs
    .map(img => img.src)
    .filter(src => src && !src.includes('placeholder'));

  // Track current index (default to whatever is showing or 0)
  let current = Math.max(0, gallery.indexOf(mainImg.src));

  // Create thumbnail nodes in the strip
  gallery.forEach((src, i) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'w-lightbox-strip-child';
    wrapper.setAttribute('role', 'tab');
    wrapper.dataset.index = i;

    const thumb = document.createElement('img');
    thumb.className = 'w-lightbox-thumb';
    thumb.src = src;
    thumb.alt = `Image ${i+1}`;

    // Click a thumb → jump to that image
    thumb.addEventListener('click', () => {
      current = i;
      refresh();
    });

    wrapper.appendChild(thumb);
    strip.appendChild(wrapper);
  });

  // Update main image, active thumb, and button states
  function refresh() {
    mainImg.src = gallery[current];

    // Active thumbnail highlight
    strip.querySelectorAll('.w-lightbox-strip-child').forEach((el, i) => {
      el.classList.toggle('w-lightbox-active', i === current);
    });

    // Disable buttons at ends
    prevBtn.classList.toggle('w-lightbox-inactive', current === 0);
    nextBtn.classList.toggle('w-lightbox-inactive', current === gallery.length - 1);
  }

  // Prev/Next handlers
  prevBtn.addEventListener('click', () => {
    if (current > 0) {
      current--;
      refresh();
    }
  });
  nextBtn.addEventListener('click', () => {
    if (current < gallery.length - 1) {
      current++;
      refresh();
    }
  });

  // Initial setup
  refresh();
});
