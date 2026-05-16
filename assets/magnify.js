(function() {
  let magnifyPreventClick = false;
// create a container and set the full-size image as its background
function createOverlay(image) {
    const overlayImage = document.createElement('img')
    overlayImage.setAttribute('src', `${image.src}`)
    overlay = document.createElement('div')
    prepareOverlay(overlay, overlayImage)
    image.closest('li').classList.add('icon-zoom-out-visible')
  
    overlayImage.onload = () => {
      image.parentElement.insertBefore(overlay, image)
      image.style.opacity = '1'
    };
  
    return overlay;
  }
  
  function prepareOverlay(container, image) {
    container.setAttribute('class', 'image-magnify-full-size')
    container.setAttribute('aria-hidden', 'true')
    container.style.backgroundImage = `url('${image.src}')`
    container.style.backgroundColor = 'var(--layout-background-color)'
  }
  
  function moveWithHover(image, event, zoomRatio) {
    // calculate mouse position
    const ratio = image.height / image.width;
    const container = event.target.getBoundingClientRect()
    const xPosition = event.clientX - container.left
    const yPosition = event.clientY - container.top
    const xPercent = `${xPosition / (image.clientWidth / 100)}%`
    const yPercent = `${yPosition / ((image.clientWidth * ratio) / 100)}%`
  
    // determine what to show in the frame
    overlay.style.backgroundPosition = `${xPercent} ${yPercent}`
    overlay.style.backgroundSize = `${image.width * zoomRatio}px`
  }
  
  function magnify(image, zoomRatio) {
    const overlay = createOverlay(image)
    overlay.onclick = () => {
      if (magnifyPreventClick) {
        magnifyPreventClick = false;
        return;
      }
      overlay.remove()
      image.closest('li').classList.remove('icon-zoom-out-visible')
    }
    overlay.onmousemove = (event) => moveWithHover(image, event, zoomRatio)
    overlay.onmouseleave = () => {
      overlay.remove();
      image.closest('li').classList.remove('icon-zoom-out-visible')
    }
    let isDragging = false;

    overlay.ontouchstart = () => isDragging = false;

    overlay.ontouchmove = (event) => {
      event.preventDefault();

      const touch = event.touches[0];
      const overlayRect = overlay.getBoundingClientRect();

      // Check if touch is within overlay bounds
      if (
        touch.clientX >= overlayRect.left &&
        touch.clientX <= overlayRect.right &&
        touch.clientY >= overlayRect.top &&
        touch.clientY <= overlayRect.bottom
      ) {
        moveWithHover(image, touch, zoomRatio);
        isDragging = true;
      } else {
        isDragging = false; 
      }
    };

    overlay.ontouchend = () => {
      if (!isDragging) {
        magnifyPreventClick = true;
        overlay.remove();
        image.closest('li').classList.remove('icon-zoom-out-visible')
      }
    };

    const closeButton = image.closest('li').querySelector('.image-zoom-icon');
    if (closeButton) {
      closeButton.onclick = () => {
        overlay.remove()
        image.closest('li').classList.remove('icon-zoom-out-visible')
      };
    }
  }
  
  function enableZoomOnHover(zoomRatio) {
    const images = document.querySelectorAll('.image-magnify-hover')
    images.forEach((image) => {
      const SWIPE_THRESHOLD = 50;

      let touchStartX = 0;
      let touchStartY = 0;
      image.onclick = (event) => {
        if (magnifyPreventClick) {
          magnifyPreventClick = false;
          return;
        }
        magnify(image, zoomRatio)
        moveWithHover(image, event, zoomRatio)
      };
      
      image.ontouchstart = (event) => {
        const touch = event.touches[0];
  
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
      };
  
      image.ontouchend = (event) => {
        magnifyPreventClick = true;
  
        const touchEndX = event.changedTouches[0].clientX;
        const touchEndY = event.changedTouches[0].clientY;
        const deltaX = touchEndX - touchStartX;
        const deltaY = touchEndY - touchStartY;
  
        // Tap, not swipe, occurred
        if (Math.abs(deltaX) < SWIPE_THRESHOLD && Math.abs(deltaY) < SWIPE_THRESHOLD) { 
          magnify(image, zoomRatio);
          moveWithHover(image, event.changedTouches[0], zoomRatio);
        }
      };
    });
  }
  enableZoomOnHover(2)
})();