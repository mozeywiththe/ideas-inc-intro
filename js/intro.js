/* ideas.inc — intro playback and hand-off to the site.
   Plays at most once per browser session, can be skipped or replayed, starts muted,
   respects prefers-reduced-motion and picks a portrait composition on tall screens. */
(function () {
  "use strict";
  var d = document.documentElement;
  var overlay = document.getElementById("intro");
  var video = document.getElementById("intro-video");
  var skipBtn = document.getElementById("skip");
  var replayBtn = document.getElementById("replay");
  var soundBtn = document.getElementById("sound");
  var soundOn = false;  // sound is always off until the visitor asks for it
  var KEY = "ideasinc-intro-seen";
  var info = null;
  var playing = false;
  var watchdog = null;

  // ---------- placeholder cards (replace with real ideas) ----------
  var grid = document.getElementById("grid");
  for (var i = 1; i <= 8; i++) {
    var li = document.createElement("li");
    li.className = "card" + (i === 2 ? " blue" : "");
    var n = (i < 10 ? "0" : "") + i;
    li.innerHTML =
      '<div class="dots" aria-hidden="true"></div>' +
      '<div><span class="mono tag">Placeholder</span>' +
      "<h3>Idea " + n + "</h3>" +
      "<p>Replace with a real idea: a name and one line on what it is.</p></div>";
    grid.appendChild(li);
  }

  function store(v) { try { sessionStorage.setItem(KEY, v); } catch (e) {} }

  function formatName() {
    if (!info || !info.formats) return "landscape";
    var portrait = window.innerWidth / window.innerHeight < 0.8;
    return portrait && info.formats.portrait ? "portrait" : "landscape";
  }

  function pickSource(fmt) {
    var f = info.formats[fmt];
    var ar = f.width / f.height;
    var boxW = Math.min(window.innerWidth, window.innerHeight * ar);
    var need = boxW * (window.devicePixelRatio || 1);
    var srcs = f.sources.slice().sort(function (a, b) { return a.w - b.w; });
    for (var i = 0; i < srcs.length; i++) if (srcs[i].w >= need * 0.9) return srcs[i].src;
    return srcs[srcs.length - 1].src;
  }

  function lockScroll(on) {
    document.body.style.overflow = on ? "hidden" : "";
  }

  function finish(fast) {
    if (!playing) {
      d.classList.remove("intro-pending");
      d.classList.add("site-ready");
      lockScroll(false);
      return;
    }
    playing = false;
    clearTimeout(watchdog);
    overlay.classList.add("leaving");
    d.classList.add("site-ready");
    lockScroll(false);
    setTimeout(function () {
      d.classList.remove("intro-playing", "intro-pending");
      overlay.classList.remove("leaving");
      overlay.setAttribute("aria-hidden", "true");
      video.pause();
      video.removeAttribute("src");
      video.load();
    }, fast ? 330 : 540);
  }

  function play() {
    if (!info) { finish(true); return; }
    window.scrollTo(0, 0);
    playing = true;
    store("1");
    d.classList.remove("site-ready");
    d.classList.add("intro-playing");
    overlay.classList.remove("leaving");
    overlay.setAttribute("aria-hidden", "false");
    lockScroll(true);
    video.muted = !soundOn;
    video.src = pickSource(formatName());
    video.currentTime = 0;
    var p = video.play();
    if (p && p.catch) p.catch(function () { finish(true); });
    // if the video cannot start (slow network, blocked autoplay), never trap the visitor
    clearTimeout(watchdog);
    watchdog = setTimeout(function () { if (playing && video.currentTime < 0.05) finish(true); }, 4000);
    skipBtn.focus({ preventScroll: true });
  }

  video.addEventListener("ended", function () { finish(false); });
  video.addEventListener("error", function () { finish(true); });
  soundBtn.addEventListener("click", function () {
    soundOn = !soundOn;
    video.muted = !soundOn;
    soundBtn.textContent = soundOn ? "Sound on" : "Sound off";
    soundBtn.setAttribute("aria-pressed", soundOn ? "true" : "false");
  });
  skipBtn.addEventListener("click", function () { finish(true); });
  document.addEventListener("keydown", function (e) { if (playing && e.key === "Escape") finish(true); });
  replayBtn.addEventListener("click", function () { play(); });

  function onScroll() { d.classList.toggle("scrolled", window.scrollY > window.innerHeight * 0.55); }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  fetch("intro.json", { cache: "no-cache" })
    .then(function (r) { return r.json(); })
    .then(function (j) {
      info = j;
      // match the page background to the colour the video actually decodes to
      var f = j.formats && (j.formats.landscape || j.formats.portrait);
      if (f && f.decoded_bg) {
        var c = f.decoded_bg;
        d.style.setProperty("--bg", "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")");
      }
      if (d.classList.contains("intro-pending")) {
        // a tab opened in the background waits until it is actually seen
        if (document.hidden) {
          document.addEventListener("visibilitychange", function once() {
            if (!document.hidden) { document.removeEventListener("visibilitychange", once); play(); }
          });
        } else play();
      }
    })
    .catch(function () { finish(true); });

  if (d.classList.contains("intro-pending")) lockScroll(true);
})();
