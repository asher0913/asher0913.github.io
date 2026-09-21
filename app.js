const nav = document.querySelector(".nav");
const onScroll = () => nav?.classList.toggle("scrolled", window.scrollY > 8);
onScroll();
window.addEventListener("scroll", onScroll, { passive: true });

if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
  );
  document.querySelectorAll("[data-reveal]").forEach((el) => io.observe(el));
} else {
  document.querySelectorAll("[data-reveal]").forEach((el) => el.classList.add("in"));
}
