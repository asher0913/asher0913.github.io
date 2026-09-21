(function () {
  "use strict";

  var doc = document.documentElement;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------------------------------------------------------
     Scroll progress and top-bar hairline
     --------------------------------------------------------------- */
  var bar = document.querySelector(".bar");
  var progress = document.querySelector(".progress");
  function onScroll() {
    var max = doc.scrollHeight - window.innerHeight;
    progress.style.setProperty("--p", max > 0 ? (window.scrollY / max).toFixed(4) : 0);
    bar.classList.toggle("is-scrolled", window.scrollY > 4);
  }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---------------------------------------------------------------
     Local time in Champaign
     --------------------------------------------------------------- */
  var clock = document.querySelector("[data-clock]");
  function tick() {
    try {
      var t = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Chicago", hour: "2-digit", minute: "2-digit", hour12: false
      }).format(new Date());
      clock.textContent = "Champaign " + t;
    } catch (e) { clock.textContent = "Champaign, IL"; }
  }
  if (clock) { tick(); setInterval(tick, 30000); }

  /* ---------------------------------------------------------------
     Active section in the nav, and reveal on scroll
     --------------------------------------------------------------- */
  if ("IntersectionObserver" in window) {
    var links = {};
    document.querySelectorAll(".bar-nav a").forEach(function (a) {
      links[a.getAttribute("href").slice(1)] = a;
    });
    var current = null;
    var navIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var a = links[e.target.id];
        if (!a || a === current) return;
        if (current) current.removeAttribute("aria-current");
        a.setAttribute("aria-current", "true");
        current = a;
      });
    }, { rootMargin: "-40% 0px -55% 0px" });
    Object.keys(links).forEach(function (id) {
      var s = document.getElementById(id);
      if (s) navIO.observe(s);
    });

    var revealIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add("is-in");
          revealIO.unobserve(e.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    document.querySelectorAll("[data-reveal]").forEach(function (el) { revealIO.observe(el); });
  } else {
    document.querySelectorAll("[data-reveal]").forEach(function (el) { el.classList.add("is-in"); });
  }

  /* ---------------------------------------------------------------
     Copy email
     --------------------------------------------------------------- */
  document.querySelectorAll("[data-copy]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var text = btn.getAttribute("data-copy");
      var done = function () {
        btn.textContent = "Copied";
        btn.classList.add("is-done");
        setTimeout(function () { btn.textContent = "Copy"; btn.classList.remove("is-done"); }, 1600);
      };
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, function () {});
    });
  });

  /* ---------------------------------------------------------------
     FIG. 0 — isometric 16×16×16 tensor with Gaussian noise
     --------------------------------------------------------------- */
  var canvas = document.getElementById("tensor");
  var sigmaOut = document.querySelector("[data-sigma]");
  if (canvas && canvas.getContext) {
    var ctx = canvas.getContext("2d");
    var N = 16;
    var C = Math.cos(Math.PI / 6), H = 0.5;
    var W = 0, Hh = 0, dpr = 1, s = 10, ox = 0, oy = 0;
    var sigma = 0.31, sigmaTarget = 0.31, pointerIn = false;
    var visible = true, raf = 0, last = 0;
    var FACES = 3, CELLS = N * N;
    var noiseA = new Float32Array(FACES * CELLS), noiseB = new Float32Array(FACES * CELLS);
    var noiseT = 0;

    function gauss() {
      var u = 1 - Math.random(), v = Math.random();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }
    function refill(buf) { for (var i = 0; i < buf.length; i++) buf[i] = Math.max(-2.2, Math.min(2.2, gauss())); }
    refill(noiseA); refill(noiseB);

    function resize() {
      var r = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = r.width; Hh = r.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(Hh * dpr);
      s = Math.min(W / (2 * N * C), Hh / (2 * N)) * 0.66;
      ox = W / 2;
      oy = Hh / 2 - 6;
    }

    function P(x, y, z) {
      return [ox + (x - y) * C * s, oy + (x + y) * H * s - z * s];
    }

    function structure(face, u, v, t) {
      // A smooth, slowly moving "feature map" per face.
      var a = Math.sin(u * 0.42 + t * 0.55 + face * 1.7) * Math.cos(v * 0.36 - t * 0.4 + face);
      var cx = 8 + 4.5 * Math.sin(t * 0.3 + face * 2.1), cy = 8 + 4.5 * Math.cos(t * 0.23 + face);
      var d = (u - cx) * (u - cx) + (v - cy) * (v - cy);
      var blob = Math.exp(-d / 18);
      return 0.28 + 0.26 * a + 0.55 * blob;
    }

    var shade = [1, 0.72, 0.5]; // top, left, right

    function quad(p0, p1, p2, p3, inset) {
      var cx = (p0[0] + p1[0] + p2[0] + p3[0]) / 4, cy = (p0[1] + p1[1] + p2[1] + p3[1]) / 4;
      var k = 1 - inset;
      ctx.beginPath();
      ctx.moveTo(cx + (p0[0] - cx) * k, cy + (p0[1] - cy) * k);
      ctx.lineTo(cx + (p1[0] - cx) * k, cy + (p1[1] - cy) * k);
      ctx.lineTo(cx + (p2[0] - cx) * k, cy + (p2[1] - cy) * k);
      ctx.lineTo(cx + (p3[0] - cx) * k, cy + (p3[1] - cy) * k);
      ctx.closePath();
    }

    function cell(face, i, j, t, mix) {
      var idx = face * CELLS + i * N + j;
      var n = noiseA[idx] * (1 - mix) + noiseB[idx] * mix;
      var v = structure(face, i, j, t) + sigma * n * 0.55;
      v = v < 0 ? 0 : v > 1 ? 1 : v;
      var p0, p1, p2, p3;
      if (face === 0) { p0 = P(i, j, N); p1 = P(i + 1, j, N); p2 = P(i + 1, j + 1, N); p3 = P(i, j + 1, N); }
      else if (face === 1) { p0 = P(i, N, j); p1 = P(i + 1, N, j); p2 = P(i + 1, N, j + 1); p3 = P(i, N, j + 1); }
      else { p0 = P(N, i, j); p1 = P(N, i + 1, j); p2 = P(N, i + 1, j + 1); p3 = P(N, i, j + 1); }
      quad(p0, p1, p2, p3, 0.2);
      if (v > 0.84) {
        ctx.fillStyle = "rgba(205,245,100," + (0.35 + 0.6 * (v - 0.84) / 0.16) * shade[face] + ")";
      } else {
        ctx.fillStyle = "rgba(244,245,246," + (0.035 + 0.5 * Math.pow(v, 1.7)) * shade[face] + ")";
      }
      ctx.fill();
    }

    function edge(a, b, dashed) {
      ctx.beginPath();
      ctx.setLineDash(dashed ? [2, 4] : []);
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    }

    function label(text, p, dx, dy) {
      ctx.fillText(text, p[0] + dx, p[1] + dy);
    }

    function draw(now) {
      var t = now / 1000;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, Hh);

      if (!pointerIn) sigmaTarget = 0.31;
      sigma += (sigmaTarget - sigma) * 0.12;

      // Resample noise a few times a second and cross-fade between draws.
      if (now - noiseT > 180) {
        var tmp = noiseA; noiseA = noiseB; noiseB = tmp; refill(noiseB); noiseT = now;
      }
      var mix = Math.min(1, (now - noiseT) / 180);

      // Hidden edges first, faint and dashed.
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(111,115,123,0.35)";
      edge(P(0, 0, 0), P(N, 0, 0), true);
      edge(P(0, 0, 0), P(0, N, 0), true);
      edge(P(0, 0, 0), P(0, 0, N), true);

      for (var f = 0; f < FACES; f++) {
        for (var i = 0; i < N; i++) for (var j = 0; j < N; j++) cell(f, i, j, t, mix);
      }

      // Visible silhouette.
      ctx.strokeStyle = "rgba(164,168,176,0.55)";
      var A = P(0, 0, N), B = P(N, 0, N), Cc = P(N, N, N), D = P(0, N, N);
      var E = P(N, 0, 0), F = P(N, N, 0), G = P(0, N, 0);
      edge(A, B); edge(B, Cc); edge(Cc, D); edge(D, A);
      edge(D, G); edge(G, F); edge(F, E); edge(E, B); edge(Cc, F);

      // Dimension labels, engineering-drawing style.
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(111,115,123,0.9)";
      ctx.font = "10px 'Fragment Mono', ui-monospace, monospace";
      ctx.textAlign = "center";
      label("W 16", P(N, N / 2, 0), 20, 16);
      label("H 16", P(N / 2, N, 0), -20, 16);
      label("C 16", P(0, N, N / 2), -28, 4);

      if (sigmaOut) sigmaOut.textContent = sigma.toFixed(2);
    }

    function loop(now) {
      raf = 0;
      if (!visible || document.hidden) return;
      if (now - last > 33) { draw(now); last = now; }
      raf = requestAnimationFrame(loop);
    }
    function start() { if (!raf && !reduced) raf = requestAnimationFrame(loop); }

    resize();
    draw(performance.now());
    if ("ResizeObserver" in window) {
      new ResizeObserver(function () { resize(); draw(performance.now()); }).observe(canvas);
    } else {
      window.addEventListener("resize", function () { resize(); draw(performance.now()); });
    }

    var frame = canvas.parentElement;
    frame.addEventListener("pointermove", function (e) {
      var r = frame.getBoundingClientRect();
      var x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
      pointerIn = true;
      sigmaTarget = 0.02 + x * 0.88;
      if (reduced) { sigma = sigmaTarget; draw(performance.now()); }
    });
    frame.addEventListener("pointerleave", function () {
      pointerIn = false;
      if (reduced) { sigma = 0.31; draw(performance.now()); }
    });

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible) start();
      }).observe(canvas);
    }
    document.addEventListener("visibilitychange", function () { if (!document.hidden) start(); });
    start();
  }

  /* ---------------------------------------------------------------
     Command palette
     --------------------------------------------------------------- */
  var palette = document.getElementById("palette");
  var input = palette.querySelector("input");
  var list = palette.querySelector(".palette-list");
  var lastFocus = null;
  var items = [];

  function add(group, label, hint, run) { items.push({ group: group, label: label, hint: hint, run: run }); }
  function goTo(id) { return function () { var el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: reduced ? "auto" : "smooth" }); }; }
  function openUrl(url) { return function () { window.location.href = url; }; }

  [["Work", "work"], ["Research", "research"], ["Experience", "experience"], ["Education", "education"], ["About", "about"], ["Contact", "contact"]]
    .forEach(function (s) { add("Sections", s[0], "#" + s[1], goTo(s[1])); });

  document.querySelectorAll("details.work").forEach(function (d) {
    var title = d.querySelector(".w-title").textContent;
    var kind = d.querySelector(".w-kind").textContent;
    add("Projects", title, kind, function () {
      d.open = true;
      d.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
      d.querySelector("summary").focus({ preventScroll: true });
    });
  });

  add("Links", "Email Yixuan", "mailto", openUrl("mailto:yixuan58@illinois.edu"));
  add("Links", "Copy email address", "clipboard", function () {
    if (navigator.clipboard) navigator.clipboard.writeText("yixuan58@illinois.edu");
  });
  add("Links", "Open résumé", "PDF", openUrl("Yixuan_Zhang_MLE_Resume.pdf"));
  add("Links", "GitHub", "asher0913", openUrl("https://github.com/asher0913"));
  add("Links", "LinkedIn", "profile", openUrl("https://www.linkedin.com/in/yixuan-zhang-b656392b5"));

  document.querySelectorAll(".labs-table a").forEach(function (a) {
    add("Labs", a.querySelector(".mono").textContent, a.querySelector("em").textContent, openUrl(a.href));
  });

  var shown = [], sel = 0;

  function render() {
    var q = input.value.trim().toLowerCase();
    shown = items.filter(function (it) {
      return !q || (it.label + " " + it.hint + " " + it.group).toLowerCase().indexOf(q) !== -1;
    });
    if (sel >= shown.length) sel = Math.max(0, shown.length - 1);
    list.innerHTML = "";
    if (!shown.length) {
      var empty = document.createElement("li");
      empty.className = "palette-empty";
      empty.textContent = "No matches.";
      list.appendChild(empty);
      return;
    }
    var group = null;
    shown.forEach(function (it, i) {
      if (it.group !== group) {
        group = it.group;
        var g = document.createElement("li");
        g.className = "grp";
        g.setAttribute("role", "presentation");
        g.textContent = group;
        list.appendChild(g);
      }
      var li = document.createElement("li");
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", i === sel ? "true" : "false");
      li.innerHTML = "<span></span><span></span>";
      li.firstChild.textContent = it.label;
      li.lastChild.textContent = it.hint;
      li.addEventListener("mousemove", function () { if (sel !== i) { sel = i; mark(); } });
      li.addEventListener("click", function () { choose(i); });
      list.appendChild(li);
    });
  }
  function mark() {
    var opts = list.querySelectorAll("[role='option']");
    opts.forEach(function (o, i) { o.setAttribute("aria-selected", i === sel ? "true" : "false"); });
    if (opts[sel]) opts[sel].scrollIntoView({ block: "nearest" });
  }
  function choose(i) {
    var it = shown[i];
    if (!it) return;
    closePalette();
    it.run();
  }
  function openPalette() {
    if (!palette.hidden) return;
    lastFocus = document.activeElement;
    palette.hidden = false;
    input.value = "";
    sel = 0;
    render();
    input.focus();
    document.body.style.overflow = "hidden";
  }
  function closePalette() {
    if (palette.hidden) return;
    palette.hidden = true;
    document.body.style.overflow = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  input.addEventListener("input", function () { sel = 0; render(); });
  input.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(shown.length - 1, sel + 1); mark(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(0, sel - 1); mark(); }
    else if (e.key === "Enter") { e.preventDefault(); choose(sel); }
    else if (e.key === "Tab") { e.preventDefault(); }
  });
  document.querySelectorAll("[data-open-palette]").forEach(function (b) { b.addEventListener("click", openPalette); });
  palette.querySelector("[data-close-palette]").addEventListener("click", closePalette);

  document.addEventListener("keydown", function (e) {
    var typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || "") || (e.target && e.target.isContentEditable);
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      if (palette.hidden) openPalette(); else closePalette();
    } else if (e.key === "Escape" && !palette.hidden) {
      closePalette();
    } else if (e.key === "/" && !typing && palette.hidden) {
      e.preventDefault();
      openPalette();
    }
  });
})();
