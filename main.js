(function () {
  "use strict";

  var root = document.documentElement;
  var body = document.body;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Load sequence ----------
     Wait for fonts so the headline doesn't reflow mid-animation. */
  function start() { requestAnimationFrame(function () { body.classList.add("is-loaded"); }); }
  if (document.fonts && document.fonts.ready) {
    Promise.race([document.fonts.ready, new Promise(function (r) { setTimeout(r, 900); })]).then(start);
  } else {
    window.addEventListener("load", start);
  }

  /* ---------- Navigation: hide on scroll down, show on scroll up ---------- */
  var nav = document.querySelector(".nav");
  var lastY = window.scrollY;
  var ticking = false;
  function onScroll() {
    var y = window.scrollY;
    if (nav) {
      nav.classList.toggle("is-scrolled", y > 16);
      var menuOpen = body.classList.contains("menu-open");
      if (!menuOpen) nav.classList.toggle("is-hidden", y > lastY && y > 320);
    }
    lastY = y;
    ticking = false;
  }
  window.addEventListener("scroll", function () {
    if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });
  onScroll();

  /* ---------- Mobile menu ---------- */
  var toggle = document.querySelector(".nav-toggle");
  var links = document.getElementById("nav-links");
  function setMenu(open) {
    if (!toggle || !links) return;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    links.classList.toggle("is-open", open);
    body.classList.toggle("menu-open", open);
    if (open) nav.classList.remove("is-hidden");
  }
  if (toggle && links) {
    toggle.addEventListener("click", function () {
      setMenu(toggle.getAttribute("aria-expanded") !== "true");
    });
    links.addEventListener("click", function (e) {
      if (e.target.closest("a")) setMenu(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") setMenu(false);
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth > 860) setMenu(false);
    });
  }

  /* ---------- Split headings into words ---------- */
  document.querySelectorAll("[data-split]").forEach(function (el) {
    var words = el.textContent.trim().split(/\s+/);
    el.setAttribute("aria-label", el.textContent.trim());
    el.innerHTML = words.map(function (w, i) {
      return '<span class="w" aria-hidden="true"><span style="--wi:' + i + '">' + w + "</span></span>";
    }).join(" ");
  });

  /* ---------- Scroll reveals ---------- */
  var revealTargets = document.querySelectorAll("[data-reveal], [data-split], .shot, .flow, .score, .review-body mark, .report, .case .topo, .band .topo");
  if ("IntersectionObserver" in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.18, rootMargin: "0px 0px -6% 0px" });
    revealTargets.forEach(function (el) { io.observe(el); });
  } else {
    revealTargets.forEach(function (el) { el.classList.add("in"); });
  }

  /* ---------- Smooth scrolling (Lenis) ---------- */
  var lenis = null;
  if (window.Lenis && !reduce) {
    lenis = new window.Lenis({ duration: 1.15, easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); } });
    var raf = function (time) { lenis.raf(time); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
    root.classList.add("lenis-ready");
  }
  var navOffset = function () { return -(parseInt(getComputedStyle(root).getPropertyValue("--nav-h"), 10) || 72) - 12; };
  document.addEventListener("click", function (e) {
    var a = e.target.closest('a[href*="#"]');
    if (!a) return;
    var url = new URL(a.href, location.href);
    if (url.pathname !== location.pathname || !url.hash || url.hash === "#") return;
    var target = document.querySelector(url.hash);
    if (!target) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(target, { offset: navOffset() });
    else target.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
    history.pushState(null, "", url.hash);
  });
  // Arriving from another page with a hash: correct for the fixed nav.
  if (location.hash && document.querySelector(location.hash)) {
    window.addEventListener("load", function () {
      var t = document.querySelector(location.hash);
      if (lenis) lenis.scrollTo(t, { offset: navOffset(), immediate: true });
    });
  }
  // Pause smooth scroll while the mobile menu is open
  if (lenis && toggle) {
    new MutationObserver(function () {
      body.classList.contains("menu-open") ? lenis.stop() : lenis.start();
    }).observe(body, { attributes: true, attributeFilter: ["class"] });
  }

  /* ---------- Scroll progress + image parallax ---------- */
  var bar = document.createElement("div");
  bar.className = "progress";
  body.appendChild(bar);
  var parallaxShots = reduce ? [] : Array.prototype.slice.call(document.querySelectorAll(".shot:not(.shot--scroll)"));

  /* Tall screenshots: scroll distance and duration scale with page length */
  function sizeTallShots() {
    document.querySelectorAll(".shot--scroll").forEach(function (shot) {
      var frameEl = shot.querySelector(".shot-img");
      var img = frameEl.querySelector("img");
      var dist = Math.max(0, img.offsetHeight - frameEl.clientHeight);
      shot.style.setProperty("--scroll-dist", -dist + "px");
      shot.style.setProperty("--scroll-time", Math.min(14, Math.max(4, dist / 450)).toFixed(1) + "s");
    });
  }
  document.querySelectorAll(".shot--scroll img").forEach(function (img) {
    if (img.complete) sizeTallShots(); else img.addEventListener("load", sizeTallShots);
  });
  window.addEventListener("resize", sizeTallShots);
  function frame() {
    var h = document.documentElement.scrollHeight - innerHeight;
    bar.style.setProperty("--p", h > 0 ? (scrollY / h).toFixed(4) : 0);
    for (var i = 0; i < parallaxShots.length; i++) {
      var el = parallaxShots[i];
      var r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) continue;
      var progress = (r.top + r.height / 2 - innerHeight / 2) / innerHeight; // -1..1
      el.style.setProperty("--py", (Math.max(-1, Math.min(1, progress)) * -12).toFixed(1) + "px");
      if (el.classList.contains("in") && !el.classList.contains("is-live")) {
        setTimeout((function (x) { return function () { x.classList.add("is-live"); }; })(el), 1400);
      }
    }
  }
  if (lenis) lenis.on("scroll", frame);
  else window.addEventListener("scroll", function () { requestAnimationFrame(frame); }, { passive: true });
  window.addEventListener("resize", frame);
  frame();

  /* ---------- Count-up for hero numbers ---------- */
  if (!reduce) {
    document.querySelectorAll(".facts dt").forEach(function (dt) {
      var m = dt.textContent.match(/^(\d+)(.*)$/);
      if (!m) return;
      var end = parseInt(m[1], 10), suffix = m[2];
      dt.textContent = "0" + suffix;
      setTimeout(function () {
        var t0 = performance.now(), dur = 1400;
        (function tick(now) {
          var k = Math.min(1, (now - t0) / dur);
          var eased = 1 - Math.pow(1 - k, 4);
          dt.textContent = Math.round(end * eased) + suffix;
          if (k < 1) requestAnimationFrame(tick);
        })(t0);
      }, 900);
    });
  }

  /* ---------- Magnetic buttons ---------- */
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches && !reduce) {
    document.querySelectorAll(".btn").forEach(function (btn) {
      btn.classList.add("magnet");
      btn.addEventListener("mousemove", function (e) {
        var r = btn.getBoundingClientRect();
        var x = (e.clientX - r.left - r.width / 2) / r.width;
        var y = (e.clientY - r.top - r.height / 2) / r.height;
        btn.style.transform = "translate(" + (x * 10).toFixed(1) + "px," + (y * 8).toFixed(1) + "px)";
      });
      btn.addEventListener("mouseleave", function () { btn.style.transform = ""; });
    });
  }

  /* ---------- Active section in nav (home page) ---------- */
  var navAnchors = document.querySelectorAll('.nav-links a[href^="#"]');
  if (navAnchors.length && "IntersectionObserver" in window) {
    var map = {};
    navAnchors.forEach(function (a) { map[a.getAttribute("href").slice(1)] = a; });
    var sectionObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var a = map[entry.target.id];
        if (!a) return;
        if (entry.isIntersecting) {
          navAnchors.forEach(function (x) { x.classList.remove("is-active"); });
          a.classList.add("is-active");
        }
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    Object.keys(map).forEach(function (id) {
      var s = document.getElementById(id);
      if (s) sectionObserver.observe(s);
    });
  }

  /* ---------- Cursor label over project screenshots ---------- */
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var shots = document.querySelectorAll(".shot[data-cursor]");
  if (fine && shots.length && !reduce) {
    var label = document.createElement("div");
    label.className = "cursor-label";
    label.setAttribute("aria-hidden", "true");
    body.appendChild(label);
    var tx = 0, ty = 0, cx = 0, cy = 0, running = false;
    function loop() {
      cx += (tx - cx) * 0.2;
      cy += (ty - cy) * 0.2;
      label.style.transform = "translate(" + (cx - label.offsetWidth / 2) + "px," + (cy - label.offsetHeight / 2) + "px)";
      if (Math.abs(tx - cx) > 0.1 || Math.abs(ty - cy) > 0.1) requestAnimationFrame(loop);
      else running = false;
    }
    shots.forEach(function (shot) {
      shot.addEventListener("mouseenter", function (e) {
        label.textContent = shot.getAttribute("data-cursor");
        cx = tx = e.clientX; cy = ty = e.clientY;
        label.classList.add("on");
        if (!running) { running = true; requestAnimationFrame(loop); }
      });
      shot.addEventListener("mousemove", function (e) {
        tx = e.clientX; ty = e.clientY;
        if (!running) { running = true; requestAnimationFrame(loop); }
      });
      shot.addEventListener("mouseleave", function () { label.classList.remove("on"); });
    });
  }

  /* ---------- Copy email ---------- */
  document.querySelectorAll("[data-copy]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var text = btn.getAttribute("data-copy");
      var done = function () {
        btn.classList.add("done");
        setTimeout(function () { btn.classList.remove("done"); }, 2200);
      };
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(done, function () { window.location.href = "mailto:" + text; });
      } else {
        var ta = document.createElement("textarea");
        ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "absolute"; ta.style.left = "-9999px";
        document.body.appendChild(ta); ta.select();
        try { document.execCommand("copy"); done(); } catch (err) { window.location.href = "mailto:" + text; }
        document.body.removeChild(ta);
      }
    });
  });

  /* ---------- Footer year ---------- */
  document.querySelectorAll("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* ---------- Forms (EmailJS, with mailto fallback) ---------- */
  var emailReady = false;
  if (window.emailjs) {
    try { window.emailjs.init("OxK45pvhYkMOX-phX"); emailReady = true; } catch (e) { emailReady = false; }
  }
  function wireForm(opts) {
    var form = document.getElementById(opts.form);
    if (!form) return;
    var status = document.getElementById(opts.status);
    var submit = document.getElementById(opts.button);
    var submitText = submit.querySelector(".btn-text");
    var label = submitText.textContent;
    function say(msg, kind) { status.textContent = msg; status.className = "form-status " + (kind || ""); }
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      var data = opts.collect(form);
      var fallback = function () {
        window.location.href = "mailto:khawajahasharahmed@gmail.com?subject=" + encodeURIComponent(opts.subject(data)) +
          "&body=" + encodeURIComponent(data.message + "\n\nReply to: " + data.email);
      };
      if (!emailReady) { say("Opening your email app with the message filled in.", "ok"); fallback(); return; }
      submit.disabled = true;
      form.classList.add("is-sending");
      submitText.textContent = "Sending";
      say("");
      window.emailjs.send("service_md0nj18", "template_jhmylri", data).then(function () {
        form.reset();
        say(opts.success, "ok");
        submitText.textContent = "Sent";
        setTimeout(function () { submitText.textContent = label; }, 3000);
      }, function () {
        say("That didn't go through. Try again, or email khawajahasharahmed@gmail.com directly.", "err");
        submitText.textContent = label;
      }).then(function () {
        submit.disabled = false;
        form.classList.remove("is-sending");
      });
    });
  }

  wireForm({
    form: "contact-form", status: "form-status", button: "submit-btn",
    success: "Message sent. I'll get back to you soon.",
    subject: function (d) { return "Project enquiry from " + d.name; },
    collect: function (f) {
      return {
        name: f.elements.name.value.trim(),
        email: f.elements.email.value.trim(),
        message: f.elements.message.value.trim(),
        interest: Array.prototype.map.call(f.querySelectorAll('input[name="interest"]:checked'), function (i) { return i.value; }).join(", ") || "Not specified"
      };
    }
  });

  wireForm({
    form: "audit-form", status: "audit-status", button: "audit-btn",
    success: "Got it. Your three fixes are on their way within two working days.",
    subject: function () { return "Free check-up request"; },
    collect: function (f) {
      var url = f.elements.url.value.trim();
      var note = f.elements.note.value.trim();
      return {
        name: "Free check-up request",
        email: f.elements.email.value.trim(),
        message: "Website: " + url + (note ? "\nNote: " + note : ""),
        interest: "Free site check-up"
      };
    }
  });
})();
