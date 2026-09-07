/* Click a screenshot to see it full size. Esc or a second click closes it.
   Nothing else on the page depends on JavaScript: with it disabled the guide
   still reads, and the images are still there at their in-page size. */
(() => {
  var box = document.createElement("div");
  box.className = "lightbox";
  box.innerHTML =
    '<img alt="">' + '<div class="lightbox-hint">Click anywhere, or press Esc, to close</div>';
  document.body.appendChild(box);

  var full = box.querySelector("img");

  document.addEventListener("click", (event) => {
    var img = event.target.closest("figure img");
    if (img) {
      full.src = img.currentSrc || img.src;
      full.alt = img.alt;
      box.classList.add("open");
      return;
    }
    if (event.target.closest(".lightbox")) box.classList.remove("open");
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") box.classList.remove("open");
  });
})();
