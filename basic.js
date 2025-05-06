document.addEventListener('DOMContentLoaded', () => {
  // 1. Grab all grid images and extract their srcs
  const gridImages = Array.from(document.querySelectorAll('.grid_images .image-down_list'))
                          .map(img => img.src);

  // 2. Find the lightbox elements
  const stripContainer = document.querySelector('.w-lightbox-strip');
  const mainImage      = document.querySelector('.w-lightbox-image');
  const btnPrev        = document.querySelector('.w-lightbox-control.w-lightbox-left');
  const btnNext        = document.querySelector('.w-lightbox-control.w-lightbox-right');
  
  let currentIndex = 0;

  // 3. Build thumbnails in the strip
  gridImages.forEach((src, idx) => {
    const thumb = document.createElement('img');
    thumb.src           = src;
    thumb.setAttribute('role', 'tab');
    thumb.className     = 'w-lightbox-thumbnail'; // you can style this via CSS
    thumb.tabIndex      = 0;
    thumb.addEventListener('click', () => {
      currentIndex = idx;
      mainImage.src = src;
      updateControls();
    });
    stripContainer.appendChild(thumb);
  });

  // 4. Prev/Next controls
  btnPrev.addEventListener('click', () => {
    if (currentIndex > 0) {
      currentIndex--;
      mainImage.src = gridImages[currentIndex];
      updateControls();
    }
  });

  btnNext.addEventListener('click', () => {
    if (currentIndex < gridImages.length - 1) {
      currentIndex++;
      mainImage.src = gridImages[currentIndex];
      updateControls();
    }
  });

  // 5. Enable/disable controls based on position
  function updateControls() {
    btnPrev.classList.toggle('w-lightbox-inactive', currentIndex === 0);
    btnNext.classList.toggle('w-lightbox-inactive', currentIndex === gridImages.length - 1);
  }

  // 6. Initialize
  if (gridImages.length) {
    mainImage.src = gridImages[0];
    updateControls();
  }
});
