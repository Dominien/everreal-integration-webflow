(function(){
    console.log('🔧 Lightbox debug: script loaded');
  
    document.addEventListener('DOMContentLoaded', () => {
      console.log('🔧 Lightbox debug: DOMContentLoaded');
      initLightboxGallery();
  
      // Watch for any later lightbox injections
      const observer = new MutationObserver(muts => {
        muts.forEach(m => {
          m.addedNodes.forEach(node => {
            if (
              node.nodeType === 1 &&
              node.classList.contains('w-lightbox-backdrop')
            ) {
              console.log('🔧 Lightbox debug: .w-lightbox-backdrop detected');
              initLightboxGallery();
            }
          });
        });
      });
      observer.observe(document.body, { childList: true, subtree: true });
    });
  
    function initLightboxGallery() {
      console.log('🔧 Lightbox debug: initLightboxGallery called');
  
      const mainImg = document.querySelector('#w-lightbox-view .w-lightbox-img');
      const prevBtn = document.querySelector('.w-lightbox-left');
      const nextBtn = document.querySelector('.w-lightbox-right');
      const strip   = document.querySelector('.w-lightbox-strip');
  
      console.log('🔧 Lightbox debug:', { mainImg, prevBtn, nextBtn, strip });
  
      if (!mainImg || !prevBtn || !nextBtn || !strip) {
        console.log('🔧 Lightbox debug: one or more elements missing, aborting');
        return;
      }
  
      if (strip.children.length) {
        console.log('🔧 Lightbox debug: strip already initialized, skipping');
        return;
      }
  
      const thumbs = Array.from(
        document.querySelectorAll('.grid_images .image-down_list')
      );
      console.log('🔧 Lightbox debug: thumbs found:', thumbs.length);
  
      const gallery = thumbs
        .map(img => img.src)
        .filter(src => src && !src.includes('placeholder'));
      console.log('🔧 Lightbox debug: gallery URLs:', gallery);
  
      let current = gallery.indexOf(mainImg.src);
      if (current < 0) current = 0;
      console.log('🔧 Lightbox debug: starting index:', current);
  
      gallery.forEach((src, i) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'w-lightbox-strip-child';
        wrapper.setAttribute('role', 'tab');
  
        const thumb = document.createElement('img');
        thumb.className = 'w-lightbox-thumb';
        thumb.src = src;
        thumb.alt = `Image ${i+1}`;
  
        thumb.addEventListener('click', () => {
          console.log(`🔧 Lightbox debug: thumb ${i} clicked`);
          current = i;
          refresh();
        });
  
        wrapper.appendChild(thumb);
        strip.appendChild(wrapper);
      });
  
      function refresh() {
        console.log('🔧 Lightbox debug: refresh → current =', current);
        mainImg.src = gallery[current];
  
        strip
          .querySelectorAll('.w-lightbox-strip-child')
          .forEach((el, i) => {
            const active = i === current;
            el.classList.toggle('w-lightbox-active', active);
            if (active) console.log(`🔧 Lightbox debug: thumb ${i} set active`);
          });
  
        const atStart = current === 0;
        const atEnd   = current === gallery.length - 1;
        prevBtn.classList.toggle('w-lightbox-inactive', atStart);
        nextBtn.classList.toggle('w-lightbox-inactive', atEnd);
        console.log(`🔧 Lightbox debug: prevDisabled=${atStart}, nextDisabled=${atEnd}`);
      }
  
      prevBtn.addEventListener('click', () => {
        console.log('🔧 Lightbox debug: prevBtn clicked (current=', current,')');
        if (current > 0) {
          current--;
          refresh();
        }
      });
  
      nextBtn.addEventListener('click', () => {
        console.log('🔧 Lightbox debug: nextBtn clicked (current=', current,')');
        if (current < gallery.length - 1) {
          current++;
          refresh();
        }
      });
  
      console.log('🔧 Lightbox debug: initialization complete, doing initial refresh');
      refresh();
    }
  })();
  