// script.js
//initCustomCursor();
const navbar = document.querySelector(".navbar");
const navbarInner = document.querySelector(".navbar-inner");
const indicator = document.querySelector(".nav-indicator");
const links = Array.from(document.querySelectorAll(".nav-link"));

// // --- Custom Cursor ---
// function initCustomCursor() {
//     const cursor = document.getElementById('customCursor');
//     document.addEventListener('mousemove', e => {
//       cursor.style.left = `${e.clientX}px`;
//       cursor.style.top  = `${e.clientY}px`;
//     });
//   }

// Map links to their sections
const sections = links
  .map((link) => {
    const id = link.getAttribute("href");
    const section = document.querySelector(id);
    return section ? { link, section } : null;
  })
  .filter(Boolean);

// The pill starts at translateX(0), so its very first positioning would otherwise
// animate as a slide in from the left edge of the navbar. Resizes should snap too,
// rather than trailing the cursor by 0.7s.
let indicatorPlaced = false;

function moveIndicatorTo(element, animate = true) {
  const linkRect = element.getBoundingClientRect();
  const navRect = navbarInner.getBoundingClientRect();

  const left = linkRect.left - navRect.left;
  const snap = !animate || !indicatorPlaced;

  if (snap) {
    // Fade in on first paint, but land in place instead of travelling there.
    indicator.style.transition = indicatorPlaced
      ? "none"
      : "opacity 0.45s cubic-bezier(0.16, 1, 0.3, 1)";
  }

  indicator.style.width = `${linkRect.width}px`;
  indicator.style.transform = `translateX(${left}px)`;
  indicator.style.opacity = 1;

  if (snap) {
    indicator.getBoundingClientRect(); // flush before restoring the stylesheet value
    indicator.style.transition = "";
  }

  indicatorPlaced = true;
}

function setActiveLink(targetLink) {
  // Re-running this mid-flight restarts the pill's 0.7s transition from wherever
  // it happens to be, which is what made it stutter. Nothing to do if unchanged.
  if (targetLink.classList.contains("active")) return;

  links.forEach((link) => link.classList.remove("active"));
  targetLink.classList.add("active");
  moveIndicatorTo(targetLink);
}

// On click: scroll + move pill
links.forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    const href = link.getAttribute("href");
    const section = document.querySelector(href);

    if (section) {
      lockScrollSpy();
      section.scrollIntoView({ behavior: "smooth", block: "start" });
      updateNavbarAppearance(section);
    }

    setActiveLink(link);
  });
});

// Function to update navbar appearance based on section background
function updateNavbarAppearance(activeSection) {
  // Check if the section is the hero section or board section (dark background)
  const isHeroSection = activeSection.classList.contains('hero-section');
  const isBoardSection = activeSection.id === 'board';
  
  if (isHeroSection || isBoardSection) {
    // Light navbar for dark background
    navbar.classList.remove('dark');
  } else {
    // Dark navbar for bright backgrounds
    navbar.classList.add('dark');
  }
}

// --- Scroll spy ---------------------------------------------------------
// A single source of truth. The previous version ran an IntersectionObserver
// *and* a 10ms-debounced scroll handler, which regularly disagreed about the
// active section and yanked the pill back and forth.

// Last known visibility of every section, so we can compare all of them at once.
// The observer only reports sections whose visibility *changed*, so picking the
// winner from `entries` alone let a section entering at 20% beat the one already
// filling 80% of the screen -- then lose it again a moment later.
const sectionRatios = new Map(sections.map(({ section }) => [section, 0]));

function syncActiveSection() {
  let best = null;
  let bestRatio = 0;

  sectionRatios.forEach((ratio, section) => {
    if (ratio > bestRatio) {
      bestRatio = ratio;
      best = section;
    }
  });

  if (!best || bestRatio <= 0.1) return;

  const match = sections.find((s) => s.section === best);
  if (match) {
    setActiveLink(match.link);
    updateNavbarAppearance(best);
  }
}

// While a click-initiated smooth scroll is in flight, ignore what flies past.
let scrollSpyLocked = false;
let scrollSpyTimer;

function lockScrollSpy() {
  scrollSpyLocked = true;
  clearTimeout(scrollSpyTimer);
  scrollSpyTimer = setTimeout(unlockScrollSpy, 1000);
}

function unlockScrollSpy() {
  if (!scrollSpyLocked) return;
  clearTimeout(scrollSpyTimer);
  scrollSpyLocked = false;
  syncActiveSection();
}

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      sectionRatios.set(entry.target, entry.isIntersecting ? entry.intersectionRatio : 0);
    });

    if (scrollSpyLocked) return;
    syncActiveSection();
  },
  {
    threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
    rootMargin: "-10% 0px -10% 0px",
  }
);

sections.forEach(({ section }) => observer.observe(section));

// Release the lock as soon as the smooth scroll actually finishes, rather than
// always waiting out the 1s fallback above.
if ("onscrollend" in window) {
  window.addEventListener("scrollend", unlockScrollSpy);
}

// --- Hero background slideshow ------------------------------------------
// Crossfades the hero image every 4s. The slides live in index.html so the
// first one paints before this runs; here we just move the active class.
const heroSlides = Array.from(document.querySelectorAll(".hero-slide"));
const HERO_INTERVAL = 4000;

let heroIndex = Math.max(0, heroSlides.findIndex((s) => s.classList.contains("is-active")));
let heroTimer;

function showHeroSlide(index) {
  heroSlides[heroIndex].classList.remove("is-active");
  heroIndex = (index + heroSlides.length) % heroSlides.length;
  heroSlides[heroIndex].classList.add("is-active");
  queueNavbarContrast();
}

function startHeroSlideshow() {
  if (heroSlides.length < 2) return;
  stopHeroSlideshow();
  heroTimer = setInterval(() => showHeroSlide(heroIndex + 1), HERO_INTERVAL);
}

function stopHeroSlideshow() {
  clearInterval(heroTimer);
}

// A backgrounded tab would otherwise bank up transitions and burn through
// several slides at once when you come back to it.
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopHeroSlideshow();
  else startHeroSlideshow();
});

startHeroSlideshow();

// --- Navbar contrast against the hero photos ----------------------------
// The hero cycles through images of very different brightness, so no single
// text colour stays readable. Sample the pixels actually sitting behind the
// pill and flip to dark text whenever they are light.

const heroSlideshow = document.querySelector(".hero-slideshow");
const heroImageCache = new Map();

const lumaCanvas = document.createElement("canvas");
lumaCanvas.width = 24;
lumaCanvas.height = 6;
const lumaCtx = lumaCanvas.getContext("2d", { willReadFrequently: true });

// WCAG's crossover: above this luminance, black text out-contrasts white text.
const LIGHT_BG_THRESHOLD = 0.179;

// Decode each slide's image once so we can read its pixels. The browser has
// already fetched them for the backgrounds, so these come from cache.
function slideImage(slide) {
  const match = /url\(['"]?(.*?)['"]?\)/.exec(slide.style.backgroundImage);
  if (!match) return null;

  const src = match[1];
  let img = heroImageCache.get(src);
  if (!img) {
    img = new Image();
    heroImageCache.set(src, img);
    img.addEventListener("load", queueNavbarContrast, { once: true });
    img.src = src;
  }
  return img.complete && img.naturalWidth ? img : null;
}

function relativeLuminance(r, g, b) {
  const linear = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function updateNavbarContrast() {
  if (!heroSlideshow || !heroSlides.length) return;

  const navRect = navbarInner.getBoundingClientRect();
  const heroRect = heroSlideshow.getBoundingClientRect();

  // Once the hero has scrolled out from behind the navbar, the per-section
  // rules take back over.
  const overlapsHero = heroRect.top < navRect.bottom && heroRect.bottom > navRect.top;
  if (!overlapsHero) {
    navbar.classList.remove("light-bg");
    return;
  }

  const img = slideImage(heroSlides[heroIndex]);
  if (!img) return;

  // Mirror background-size: cover and background-position: center to work out
  // which part of the source image is under the pill right now.
  const scale = Math.max(
    heroRect.width / img.naturalWidth,
    heroRect.height / img.naturalHeight
  );
  const drawnLeft = heroRect.left + (heroRect.width - img.naturalWidth * scale) / 2;
  const drawnTop = heroRect.top + (heroRect.height - img.naturalHeight * scale) / 2;

  const sx = Math.min(Math.max((navRect.left - drawnLeft) / scale, 0), img.naturalWidth);
  const sy = Math.min(Math.max((navRect.top - drawnTop) / scale, 0), img.naturalHeight);
  const sw = Math.min(Math.max(navRect.width / scale, 1), img.naturalWidth - sx);
  const sh = Math.min(Math.max(navRect.height / scale, 1), img.naturalHeight - sy);

  let luma;
  try {
    lumaCtx.drawImage(img, sx, sy, sw, sh, 0, 0, lumaCanvas.width, lumaCanvas.height);
    const { data } = lumaCtx.getImageData(0, 0, lumaCanvas.width, lumaCanvas.height);
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      sum += relativeLuminance(data[i], data[i + 1], data[i + 2]);
    }
    luma = sum / (data.length / 4);
  } catch (err) {
    // Tainted canvas -- happens when the page is opened over file:// rather
    // than served. Leave the stylesheet colours as they are.
    return;
  }

  navbar.classList.toggle("light-bg", luma > LIGHT_BG_THRESHOLD);
}

// Scrolling moves the photo under the fixed navbar, so this has to re-run --
// but at most once a frame, and never mid-layout.
let contrastQueued = false;
function queueNavbarContrast() {
  if (contrastQueued) return;
  contrastQueued = true;
  requestAnimationFrame(() => {
    contrastQueued = false;
    updateNavbarContrast();
  });
}

window.addEventListener("scroll", queueNavbarContrast, { passive: true });
window.addEventListener("resize", queueNavbarContrast);
queueNavbarContrast();

// Timeline initialization - sort events by date and assign alternating sides
function initializeTimeline() {
  const timelineEvents = document.querySelectorAll('.timeline-event');
  const eventsArray = Array.from(timelineEvents);
  
  if (eventsArray.length === 0) return;
  
  // Sort events by date (most recent first)
  eventsArray.sort((a, b) => {
    const dateA = new Date(a.querySelector('.event-date').textContent);
    const dateB = new Date(b.querySelector('.event-date').textContent);
    return dateB - dateA; // Most recent first
  });
  
  // Reorder in DOM and assign alternating sides
  const timelineContainer = document.querySelector('.timeline-events');
  eventsArray.forEach((event, index) => {
    // Remove from current position
    event.remove();
    // Assign side (alternating: left, right, left, right...)
    event.setAttribute('data-side', index % 2 === 0 ? 'left' : 'right');
    // Append back in sorted order
    timelineContainer.appendChild(event);
  });
}

// Position pill initially (on first active link)
window.addEventListener("load", () => {
  const active = document.querySelector(".nav-link.active") || links[0];
  if (active) moveIndicatorTo(active);
  
  // Set initial navbar appearance based on first section
  const firstSection = sections[0]?.section;
  if (firstSection) {
    updateNavbarAppearance(firstSection);
  }
  
  // Initialize timeline
  initializeTimeline();
  
  // Handle default profile pictures for missing images
  const memberImages = document.querySelectorAll('.member-image');
  memberImages.forEach(img => {
    if (!img.src || img.src === '' || img.src === window.location.href) {
      // Image is empty, show default
      img.classList.add('no-image');
    } else {
      // Image exists, try to load it
      img.addEventListener('load', function() {
        this.classList.add('loaded');
      });
      img.addEventListener('error', function() {
        // Image failed to load, show default
        this.classList.add('no-image');
      });
      // If image is already loaded
      if (img.complete && img.naturalHeight !== 0) {
        img.classList.add('loaded');
      }
    }
  });
});

// If window resizes, recalc pill position
window.addEventListener("resize", () => {
  const active = document.querySelector(".nav-link.active");
  if (active) moveIndicatorTo(active, false);
});

// // Smooth scroll snapping when 10% of next section is visible
// let isSectionScrolling = false;
// let lastScrollTop = 0;
// let scrollDirection = 0; // 1 = down, -1 = up, 0 = unknown

// window.addEventListener('scroll', () => {
//   if (isSectionScrolling) return;
  
//   const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
//   const viewportHeight = window.innerHeight;
//   const scrollDelta = scrollTop - lastScrollTop;
  
//   // Determine scroll direction
//   if (Math.abs(scrollDelta) > 1) {
//     scrollDirection = scrollDelta > 0 ? 1 : -1;
//   }
//   lastScrollTop = scrollTop;
  
//   // Check each section to see if 10% is visible
//   sections.forEach(({ section }) => {
//     const rect = section.getBoundingClientRect();
//     const sectionHeight = section.offsetHeight;
//     const visibleThreshold = sectionHeight * 0.1; // 10% of section
    
//     // Check if scrolling down and 10% of section is visible from bottom
//     if (scrollDirection === 1 && rect.top < viewportHeight && rect.top > viewportHeight - visibleThreshold) {
//       // Next section is coming into view from bottom
//       if (!isSectionScrolling) {
//         isSectionScrolling = true;
//         section.scrollIntoView({ 
//           behavior: 'smooth', 
//           block: 'start' 
//         });
//         setTimeout(() => {
//           isSectionScrolling = false;
//         }, 1000);
//       }
//     }
    
//     // Check if scrolling up and 10% of section is visible from top
//     if (scrollDirection === -1 && rect.bottom > 0 && rect.bottom < visibleThreshold) {
//       // Previous section is coming into view from top
//       if (!isSectionScrolling) {
//         isSectionScrolling = true;
//         section.scrollIntoView({ 
//           behavior: 'smooth', 
//           block: 'start' 
//         });
//         setTimeout(() => {
//           isSectionScrolling = false;
//         }, 1000);
//       }
//     }
//   });
// });

// ===== Gallery: event folders, modal, and lightbox =====
(function () {
  const galleryEvents = [
    {
      id: "event_6",
      title: "Good Samaritan Health & Rehab",
      date: "February 1, 2026",
      images: [
        "626664796_17909670510317967_3347637602918455251_n.jpg",
        "626683967_17909670474317967_627333904668918025_n.jpg",
        "626793283_17909670528317967_8980544576082639817_n.jpg",
        "626795217_17909670456317967_6367776910075045014_n.jpg",
        "626805440_17909670483317967_6667840804003855898_n.jpg",
        "626816884_17909670537317967_3951144604466671041_n.jpg",
        "626817642_17909670501317967_5271512876663942638_n.jpg",
        "626854149_17909670465317967_2877280660155607181_n.jpg",
        "627052595_17909670492317967_4941701429022270661_n.jpg",
        "627061149_17909670519317967_4594874291731576434_n.jpg",
        "627536165_17909670549317967_7149988717994929381_n.jpg"
      ]
    },
    {
      id: "event_5",
      title: "Mary Queen of Angels",
      date: "January 17, 2026",
      images: [
        "618377689_17907715485317967_5165222640270512759_n.jpg",
        "618418945_17907715455317967_8301420804411218326_n.jpg",
        "618422068_17907715428317967_6446790028133814554_n.jpg",
        "618471819_17907715476317967_3284067721528698121_n.jpg",
        "618517245_17907715542317967_5449571890238351629_n.jpg",
        "618563239_17907715530317967_7444009963644568200_n.jpg",
        "618572933_17907715506317967_5162019255611604626_n.jpg",
        "618601334_17907715440317967_8422847254430564225_n.jpg",
        "618687199_17907715521317967_1459697716959807515_n.jpg",
        "618752886_17907715563317967_9180399645492476216_n.jpg",
        "618838891_17907715494317967_3085795122612639816_n.jpg",
        "618961535_17907715554317967_3885032454097919594_n.jpg",
        "618980718_17907715467317967_6302436728395035895_n.jpg"
      ]
    },
    {
      id: "event_4",
      title: "Good Samaritan Health and Rehab",
      date: "November 15, 2025",
      images: [
        "582090489_17900542791317967_2061582005305735250_n.jpg",
        "582756780_17900542770317967_886733324901275651_n.jpg",
        "584370296_17900542749317967_262403425585232433_n.jpg",
        "584370802_17900542809317967_8258756284557144404_n.jpg",
        "584371763_17900542800317967_4269287582637179073_n.jpg"
      ]
    },
    {
      id: "event_3",
      title: "Mary Queen of Angels",
      date: "November 8, 2025",
      images: [
        "575989958_17899807770317967_3709832481157420682_n.jpg",
        "576543886_17899807794317967_8858097982227869552_n.jpg",
        "579535782_17899807812317967_7597299834075637898_n.jpg",
        "579703776_17899807803317967_5152020656768806861_n.jpg",
        "580122042_17899807821317967_3272576550500161026_n.jpg",
        "580481746_17899807779317967_7128670871873576957_n.jpg"
      ]
    },
    {
      id: "event_2",
      title: "Mary Queen of Angels",
      date: "March 29, 2025",
      images: [
        "487403761_17873394423317967_546712335750715114_n.jpg",
        "487840407_17873394387317967_6563192140513706333_n.jpg",
        "487900099_17873394414317967_3893010978400188908_n.jpg",
        "487929627_17873394405317967_1012966909196393917_n.jpg",
        "488039233_17873394396317967_8529007538106889498_n.jpg",
        "488176050_17873394378317967_1907648838060366140_n.jpg"
      ]
    },
    {
      id: "event_1",
      title: "Mary Queen of Angels",
      date: "February 9, 2025",
      images: [
        "476725840_17866521450317967_5757192789420668294_n(1).jpg",
        "476747268_17866521429317967_861514148137174199_n(1).jpg",
        "476768139_17866521438317967_2672404335589123809_n(1).jpg",
        "476840386_17866521459317967_4738554115081060287_n(1).jpg",
        "477054213_17866521399317967_6068206461589121577_n(1).jpg",
        "477187043_17866521420317967_9117332202190163355_n(1).jpg",
        "478033757_17866521480317967_1117510641328471645_n(1).jpg"
      ]
    }
  ];

  const foldersContainer = document.getElementById("galleryFolders");
  if (!foldersContainer) return;

  const modal = document.getElementById("galleryModal");
  const modalBackdrop = document.getElementById("galleryModalBackdrop");
  const modalClose = document.getElementById("galleryModalClose");
  const modalTitle = document.getElementById("galleryModalTitle");
  const modalDate = document.getElementById("galleryModalDate");
  const modalGrid = document.getElementById("galleryModalGrid");

  const lightbox = document.getElementById("galleryLightbox");
  const lightboxBackdrop = document.getElementById("galleryLightboxBackdrop");
  const lightboxClose = document.getElementById("galleryLightboxClose");
  const lightboxImage = document.getElementById("galleryLightboxImage");
  const lightboxPrev = document.getElementById("galleryLightboxPrev");
  const lightboxNext = document.getElementById("galleryLightboxNext");

  let activeEvent = null;
  let activeIndex = 0;

  function imagePath(event, filename) {
    return `assets/${event.id}/${filename}`;
  }

  function renderFolders() {
    galleryEvents.forEach((event) => {
      const folder = document.createElement("div");
      folder.className = "gallery-folder";
      folder.setAttribute("role", "button");
      folder.setAttribute("tabindex", "0");
      folder.setAttribute("aria-label", `Open photos from ${event.title}, ${event.date}`);
      folder.innerHTML = `
        <div class="folder-thumb" style="background-image: url('${imagePath(event, event.images[0])}')">
          <span class="folder-count">${event.images.length} photos</span>
        </div>
        <div class="folder-info">
          <div class="folder-title">${event.title}</div>
          <div class="folder-date">${event.date}</div>
        </div>
      `;
      folder.addEventListener("click", () => openFolder(event));
      folder.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openFolder(event);
        }
      });
      foldersContainer.appendChild(folder);
    });
  }

  function openFolder(event) {
    activeEvent = event;
    modalTitle.textContent = event.title;
    modalDate.textContent = event.date;
    modalGrid.innerHTML = "";
    event.images.forEach((filename, index) => {
      const img = document.createElement("img");
      img.src = imagePath(event, filename);
      img.alt = `${event.title} photo ${index + 1}`;
      img.className = "gallery-modal-image";
      img.loading = "lazy";
      img.addEventListener("click", () => openLightbox(index));
      modalGrid.appendChild(img);
    });
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeFolder() {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    if (!lightbox.classList.contains("is-open")) {
      document.body.style.overflow = "";
    }
  }

  function openLightbox(index) {
    if (!activeEvent) return;
    activeIndex = index;
    updateLightboxImage();
    lightbox.classList.add("is-open");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeLightbox() {
    lightbox.classList.remove("is-open");
    lightbox.setAttribute("aria-hidden", "true");
    if (!modal.classList.contains("is-open")) {
      document.body.style.overflow = "";
    }
  }

  function updateLightboxImage() {
    if (!activeEvent) return;
    const filename = activeEvent.images[activeIndex];
    lightboxImage.src = imagePath(activeEvent, filename);
    lightboxImage.alt = `${activeEvent.title} photo ${activeIndex + 1}`;
  }

  function showPrev() {
    if (!activeEvent) return;
    activeIndex = (activeIndex - 1 + activeEvent.images.length) % activeEvent.images.length;
    updateLightboxImage();
  }

  function showNext() {
    if (!activeEvent) return;
    activeIndex = (activeIndex + 1) % activeEvent.images.length;
    updateLightboxImage();
  }

  modalClose.addEventListener("click", closeFolder);
  modalBackdrop.addEventListener("click", closeFolder);
  lightboxClose.addEventListener("click", closeLightbox);
  lightboxBackdrop.addEventListener("click", closeLightbox);
  lightboxPrev.addEventListener("click", showPrev);
  lightboxNext.addEventListener("click", showNext);

  document.addEventListener("keydown", (e) => {
    if (lightbox.classList.contains("is-open")) {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") showPrev();
      if (e.key === "ArrowRight") showNext();
    } else if (modal.classList.contains("is-open") && e.key === "Escape") {
      closeFolder();
    }
  });

  function openFolderById(id) {
    const event = galleryEvents.find((e) => e.id === id);
    if (event) openFolder(event);
  }

  // Clicking an event's description box in the timeline jumps down to the
  // Gallery section and opens that event's photo folder.
  document.querySelectorAll("[data-gallery-event]").forEach((el) => {
    el.classList.add("event-content-linked");
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");

    const activate = () => {
      const id = el.getAttribute("data-gallery-event");
      const gallerySection = document.getElementById("gallery");
      if (gallerySection) {
        gallerySection.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      // Let the smooth scroll get underway before the modal pops in, so it
      // doesn't open while the page is still jumping to the section.
      window.setTimeout(() => openFolderById(id), 500);
    };

    el.addEventListener("click", activate);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        activate();
      }
    });
  });

  renderFolders();
})();