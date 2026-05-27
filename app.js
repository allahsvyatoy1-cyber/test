/* AETHER — scroll-driven morphing object + scene timeline (GSAP ScrollTrigger + Lenis) */
(function () {
  "use strict";
  gsap.registerPlugin(ScrollTrigger);

  /* ================================================================== */
  /*  Smooth scroll                                                      */
  /* ================================================================== */
  const lenis = new Lenis({
    duration: 1.15,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
  });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  /* ================================================================== */
  /*  Particle morph engine                                              */
  /*  Builds N points for K shapes, then lerps between them by progress  */
  /* ================================================================== */
  const N = 1600;
  const GA = Math.PI * (3 - Math.sqrt(5)); // golden angle

  function sphere() {
    const a = [];
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = i * GA;
      a.push([Math.cos(th) * r * 1.45, y * 1.45, Math.sin(th) * r * 1.45]);
    }
    return a;
  }
  function torus() {
    const a = [], R = 1.15, r = 0.45, GA2 = GA * 2.0;
    for (let i = 0; i < N; i++) {
      const u = (i * GA) % (Math.PI * 2);
      const v = (i * GA2) % (Math.PI * 2);
      a.push([(R + r * Math.cos(v)) * Math.cos(u), r * Math.sin(v), (R + r * Math.cos(v)) * Math.sin(u)]);
    }
    return a;
  }
  function helix() {
    const a = [], turns = 3.2, rad = 0.62;
    for (let i = 0; i < N; i++) {
      const t = i / N;
      const strand = i % 2;
      const ang = t * Math.PI * 2 * turns + strand * Math.PI;
      a.push([Math.cos(ang) * rad, (t - 0.5) * 2.9, Math.sin(ang) * rad]);
    }
    return a;
  }
  function box() {
    const a = [], h = 1.05;
    for (let i = 0; i < N; i++) {
      const face = i % 6;
      const u = (Math.random() - 0.5) * 2 * h;
      const v = (Math.random() - 0.5) * 2 * h;
      if (face === 0) a.push([h, u, v]);
      else if (face === 1) a.push([-h, u, v]);
      else if (face === 2) a.push([u, h, v]);
      else if (face === 3) a.push([u, -h, v]);
      else if (face === 4) a.push([u, v, h]);
      else a.push([u, v, -h]);
    }
    return a;
  }
  function galaxy() {
    const a = [], arms = 3;
    for (let i = 0; i < N; i++) {
      const t = i / N;
      const arm = i % arms;
      const ang = t * Math.PI * 2 * 2.2 + (arm * Math.PI * 2) / arms;
      const rad = t * 1.9 + Math.random() * 0.12;
      a.push([Math.cos(ang) * rad, (Math.random() - 0.5) * 0.3 * (1 - t), Math.sin(ang) * rad]);
    }
    return a;
  }
  const SHAPES = [sphere(), torus(), helix(), box(), galaxy()];
  const K = SHAPES.length;

  /* per-particle color along the brand gradient */
  const STOPS = [[124, 92, 255], [56, 225, 255], [255, 92, 171]];
  function gradAt(t) {
    const x = t * (STOPS.length - 1);
    const i = Math.min(STOPS.length - 2, Math.floor(x));
    const f = x - i, a = STOPS[i], b = STOPS[i + 1];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  }
  const COLORS = [];
  for (let i = 0; i < N; i++) {
    const c = gradAt(i / N);
    COLORS.push("rgba(" + (c[0] | 0) + "," + (c[1] | 0) + "," + (c[2] | 0) + ",");
  }

  const canvas = document.getElementById("scene");
  const ctx = canvas.getContext("2d");
  let W, H, DPR, CX, CY, S;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.width = window.innerWidth * DPR;
    H = canvas.height = window.innerHeight * DPR;
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    CX = W / 2; CY = H * 0.46; S = Math.min(W, H) * 0.27;
  }
  window.addEventListener("resize", resize);
  resize();

  const engine = { progress: 0 };

  function render(time) {
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";

    const p = Math.max(0, Math.min(1, engine.progress));
    const seg = p * (K - 1);
    const i0 = Math.min(K - 1, Math.floor(seg));
    const i1 = Math.min(K - 1, i0 + 1);
    let f = seg - i0;
    f = f * f * (3 - 2 * f); // smoothstep
    const A = SHAPES[i0], B = SHAPES[i1];

    // rotation: gentle auto-spin + scroll-reactive twist
    const ry = time * 0.00018 + p * Math.PI * 1.6;
    const rx = 0.42 + Math.sin(time * 0.0002) * 0.18;
    const cosY = Math.cos(ry), sinY = Math.sin(ry);
    const cosX = Math.cos(rx), sinX = Math.sin(rx);
    const depth = 2.6;

    for (let n = 0; n < N; n++) {
      const a = A[n], b = B[n];
      let x = a[0] + (b[0] - a[0]) * f;
      let y = a[1] + (b[1] - a[1]) * f;
      let z = a[2] + (b[2] - a[2]) * f;

      // rotate Y then X
      const x1 = x * cosY + z * sinY;
      const z1 = -x * sinY + z * cosY;
      const y2 = y * cosX - z1 * sinX;
      const z2 = y * sinX + z1 * cosX;

      const k = depth / (depth - z2); // perspective
      const sx = CX + x1 * S * k;
      const sy = CY + y2 * S * k;
      const pr = (k - 0.55) * 1.7 * DPR;
      if (pr <= 0) continue;
      const alpha = Math.max(0.05, Math.min(0.95, (k - 0.5) * 0.7));

      ctx.fillStyle = COLORS[n] + alpha + ")";
      ctx.beginPath();
      ctx.arc(sx, sy, pr, 0, 6.2832);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);

  /* ================================================================== */
  /*  Scenes — fade in/out along a scrubbed timeline                     */
  /* ================================================================== */
  const scenes = gsap.utils.toArray(".scene");
  const dots = gsap.utils.toArray("#dots b");
  gsap.set(scenes[0], { autoAlpha: 1 });
  gsap.set(scenes.slice(1), { autoAlpha: 0, y: 50 });

  // master timeline pinned to the stage; scroll = timeline
  const tl = gsap.timeline({
    defaults: { ease: "power2.out" },
    scrollTrigger: {
      trigger: "#stage",
      start: "top top",
      end: "+=6200",
      pin: true,
      scrub: 1,
      onUpdate: (self) => {
        engine.progress = self.progress;
        gsap.set("#progress", { scaleX: self.progress });
        const idx = Math.round(self.progress * (K - 1));
        dots.forEach((d, i) => d.classList.toggle("on", i === idx));
        gsap.to("#scrollHint", { autoAlpha: self.progress > 0.04 ? 0 : 1, duration: 0.3, overwrite: true });
      },
    },
  });

  tl.to({}, { duration: 10 }); // fix total length to 10 units

  const IN = { autoAlpha: 1, y: 0, duration: 0.7, ease: "power3.out" };
  const OUT = { autoAlpha: 0, y: -50, duration: 0.7, ease: "power3.in" };
  // scene 0 starts visible -> leaves
  tl.to(scenes[0], OUT, 1.3);
  // scene 1
  tl.fromTo(scenes[1], { autoAlpha: 0, y: 50 }, IN, 2.2).to(scenes[1], OUT, 3.6);
  // scene 2
  tl.fromTo(scenes[2], { autoAlpha: 0, y: 50 }, IN, 4.6).to(scenes[2], OUT, 6.0);
  // scene 3
  tl.fromTo(scenes[3], { autoAlpha: 0, y: 50 }, IN, 6.8).to(scenes[3], OUT, 8.2);
  // scene 4 (stays to the end)
  tl.fromTo(scenes[4], { autoAlpha: 0, y: 50 }, IN, 9.0);

  /* ================================================================== */
  /*  Jump links (dots / buttons) -> scroll to a scene fraction          */
  /* ================================================================== */
  function jumpTo(idx) {
    const st = tl.scrollTrigger;
    const frac = idx / (K - 1);
    const target = st.start + (st.end - st.start) * frac;
    lenis.scrollTo(target, { duration: 1.4 });
  }
  document.querySelectorAll("[data-jump]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      jumpTo(parseInt(el.dataset.jump, 10));
    });
  });

  /* ================================================================== */
  /*  Ambiance: cursor glow + twinkling starfield                        */
  /* ================================================================== */
  const glow = document.getElementById("cursorGlow");
  if (window.matchMedia("(pointer:fine)").matches) {
    window.addEventListener("pointermove", (e) =>
      gsap.to(glow, { x: e.clientX, y: e.clientY, opacity: 1, duration: 0.6, ease: "power2.out" })
    );
    window.addEventListener("pointerout", () => gsap.to(glow, { opacity: 0, duration: 0.4 }));
  }

  (function starfield() {
    const c = document.getElementById("stars");
    const sctx = c.getContext("2d");
    let w, h, dpr, stars;
    function rs() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = c.width = window.innerWidth * dpr;
      h = c.height = window.innerHeight * dpr;
      c.style.width = window.innerWidth + "px";
      c.style.height = window.innerHeight + "px";
      const count = Math.floor((window.innerWidth * window.innerHeight) / 7000);
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        r: Math.random() * 1.2 + 0.2, z: Math.random() * 0.7 + 0.3,
        tw: Math.random() * Math.PI * 2,
      }));
    }
    function draw(t) {
      sctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        const fl = 0.55 + Math.sin(t * 0.001 + s.tw) * 0.45;
        sctx.globalAlpha = s.z * fl;
        sctx.fillStyle = s.z > 0.7 ? "rgba(200,230,255,1)" : "rgba(180,170,255,1)";
        sctx.beginPath();
        sctx.arc(s.x, s.y, s.r * dpr, 0, 6.2832);
        sctx.fill();
      }
      sctx.globalAlpha = 1;
      requestAnimationFrame(draw);
    }
    window.addEventListener("resize", rs);
    rs();
    requestAnimationFrame(draw);
  })();

  /* recompute pin math after fonts load */
  window.addEventListener("load", () => ScrollTrigger.refresh());
})();
