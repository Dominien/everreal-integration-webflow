(function(){
  // build & wire up your lightbox gallery
  function initLightboxGallery() {
    const mainImg = document.querySelector('#w-lightbox-view .w-lightbox-img');
    if (!mainImg) return;                            // not in DOM yet?
    
    const prevBtn = document.querySelector('.w-lightbox-left');
    const nextBtn = document.querySelector('.w-lightbox-right');
    const strip   = document.querySelector('.w-lightbox-strip');
    
    // only init once
    if (strip.dataset.galleryInit) return;
    strip.dataset.galleryInit = 'true';
    
    // grab your grid thumbnails
    const thumbs = Array.from(
      document.querySelectorAll('.grid_images .image-down_list')
    );
    
    // build a clean array of URLs (skip placeholder.svg)
    const gallery = thumbs
      .map(img => img.src)
      .filter(src => src && !src.includes('placeholder'));
    
    // figure out which one is showing
    let current = gallery.indexOf(mainImg.src);
    if (current < 0) current = 0;
    
    // populate the strip
    gallery.forEach((src, i) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'w-lightbox-strip-child';
      wrapper.setAttribute('role', 'tab');
      wrapper.dataset.index = i;
      
      const thumb = document.createElement('img');
      thumb.className = 'w-lightbox-thumb';
      thumb.src = src;
      thumb.alt = `Image ${i+1}`;
      
      thumb.addEventListener('click', () => {
        current = i;
        refresh();
      });
      
      wrapper.appendChild(thumb);
      strip.appendChild(wrapper);
    });
    
    function refresh() {
      // swap the big image
      mainImg.src = gallery[current];
      
      // highlight the active thumb
      strip
        .querySelectorAll('.w-lightbox-strip-child')
        .forEach((el, i) => el.classList.toggle('w-lightbox-active', i === current));
      
      // toggle prev/next
      prevBtn.classList.toggle('w-lightbox-inactive', current === 0);
      nextBtn.classList.toggle('w-lightbox-inactive', current === gallery.length - 1);
    }
    
    // wire buttons
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
    
    // kick it off
    refresh();
  }
  
  // watch for the lightbox backdrop to be inserted
  const observer = new MutationObserver(muts => {
    for (let m of muts) {
      for (let node of m.addedNodes) {
        if (
          node.nodeType === 1 &&
          node.classList.contains('w-lightbox-backdrop')
        ) {
          initLightboxGallery();
        }
      }
    }
  });
  observer.observe(document.body, { childList: true });
})();
