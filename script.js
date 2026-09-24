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