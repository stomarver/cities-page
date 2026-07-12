/* PACK.JS — хранение и воспроизведение анимаций спрайтов.
   IIFE -> window.Pack. Загружается после PAGE-ANIM.JS (см. INDEX.HTM).
   Зона ответственности: только реестр анимаций + расчёт состояния + отрисовка.

   API (window.Pack):
     easingFunctions                          набор функций плавности
     defineAnimation(name, {keyframes, loopEnabled, loopDelay, springParams})
     hasAnimation(name) / listAnimations()
     getSpriteState(name, time)               состояние в момент time (мс)
     getAnimationBounds(name)                 min/max полей по ключам
     drawSpriteFrame(ctx, image, state, opts) отрисовать кадр
     opts: { width, height, centerX, centerY, scale }   scale — модификатор размера (1=натуральный) */
(function (global) {
  'use strict';

  var easingFunctions = {
    linear: function (t) { return t; },
    easeInQuad: function (t) { return t * t; },
    easeOutQuad: function (t) { return t * (2 - t); },
    easeInOutQuad: function (t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; },
    easeInCubic: function (t) { return t * t * t; },
    easeOutCubic: function (t) { return (--t) * t * t + 1; },
    easeInOutCubic: function (t) { return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1; },
    easeInQuart: function (t) { return t * t * t * t; },
    easeOutQuart: function (t) { return 1 - (--t) * t * t * t; },
    easeInOutQuart: function (t) { return t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t; },
    easeInQuint: function (t) { return t * t * t * t * t; },
    easeOutQuint: function (t) { return 1 + (--t) * t * t * t * t; },
    easeInOutQuint: function (t) { return t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * (--t) * t * t * t * t; },
    easeInSine: function (t) { return 1 - Math.cos((t * Math.PI) / 2); },
    easeOutSine: function (t) { return Math.sin((t * Math.PI) / 2); },
    easeInOutSine: function (t) { return -(Math.cos(Math.PI * t) - 1) / 2; },
    easeInExpo: function (t) { return t === 0 ? 0 : Math.pow(2, 10 * t - 10); },
    easeOutExpo: function (t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); },
    easeInOutExpo: function (t) {
      return t === 0 ? 0 : t === 1 ? 1
        : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2;
    },
    easeInCirc: function (t) { return 1 - Math.sqrt(1 - t * t); },
    easeOutCirc: function (t) { return Math.sqrt(1 - (--t) * t); },
    easeInOutCirc: function (t) {
      return t < 0.5 ? (1 - Math.sqrt(1 - 4 * t * t)) / 2
                     : (Math.sqrt(1 - 4 * (t - 1) * (t - 1)) + 1) / 2;
    },
    easeInBack: function (t) { return t * t * ((1.70158 + 1) * t - 1.70158); },
    easeOutBack: function (t) { return 1 + (--t) * t * ((1.70158 + 1) * t + 1.70158); },
    easeInOutBack: function (t) {
      var c1 = 1.70158, c2 = c1 * 1.525;
      return t < 0.5
        ? ((2 * t) * (2 * t) * ((c2 + 1) * 2 * t - c2)) / 2
        : ((2 * t - 2) * (2 * t - 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
    },
    easeInElastic: function (t) {
      return t === 0 ? 0 : t === 1 ? 1
        : -Math.pow(2, 10 * t - 10) * Math.sin(((t * 10 - 10.75) * (2 * Math.PI)) / 3);
    },
    easeOutElastic: function (t) {
      return t === 0 ? 0 : t === 1 ? 1
        : Math.pow(2, -10 * t) * Math.sin(((t * 10 - 0.75) * (2 * Math.PI)) / 3) + 1;
    },
    easeInOutElastic: function (t) {
      if (t === 0 || t === 1) return t;
      return t < 0.5
        ? -(Math.pow(2, 20 * t - 10) * Math.sin(((20 * t - 11.125) * (2 * Math.PI)) / 4.5)) / 2
        : (Math.pow(2, -20 * t + 10) * Math.sin(((20 * t - 11.125) * (2 * Math.PI)) / 4.5)) / 2 + 1;
    },
    easeInBounce: function (t) { return 1 - easingFunctions.easeOutBounce(1 - t); },
    easeOutBounce: function (t) {
      var n1 = 7.5625, d1 = 2.75;
      if (t < 1 / d1) return n1 * t * t;
      if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
      if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    },
    easeInOutBounce: function (t) {
      return t < 0.5
        ? (1 - easingFunctions.easeOutBounce(1 - 2 * t)) / 2
        : (1 + easingFunctions.easeOutBounce(2 * t - 1)) / 2;
    },
    spring: function (t, stiffness, damping) {
      var k = (stiffness == null) ? 170 : stiffness;
      var c = (damping == null) ? 26 : damping;
      var omega0 = Math.sqrt(k), zeta = c / (2 * Math.sqrt(k));
      if (zeta < 1) {
        var omegaD = omega0 * Math.sqrt(1 - zeta * zeta);
        var v = 1 - Math.exp(-zeta * omega0 * t) *
          (Math.cos(omegaD * t) + (zeta / Math.sqrt(1 - zeta * zeta)) * Math.sin(omegaD * t));
        return Math.min(1, Math.max(0, v));
      }
      return easingFunctions.easeOutExpo(t);
    }
  };

  /* --- реестр анимаций --- */

  var animations = Object.create(null);

  function clamp01(t) { return t < 0 ? 0 : t > 1 ? 1 : t; }

  function defineAnimation(name, config) {
    if (typeof name !== 'string' || !name) throw new Error('defineAnimation: имя обязательно');
    var cfg = config || {};
    var kfs = (cfg.keyframes || []).slice().sort(function (a, b) { return a.time - b.time; });
    animations[name] = {
      keyframes: kfs,
      loopEnabled: cfg.loopEnabled !== false,
      loopDelay: cfg.loopDelay || 0,
      springParams: cfg.springParams || {}
    };
    return animations[name];
  }

  function hasAnimation(name) { return Object.prototype.hasOwnProperty.call(animations, name); }
  function listAnimations() { return Object.keys(animations); }

  function mergeOwn(kf) {
    var out = {};
    for (var k in kf) if (Object.prototype.hasOwnProperty.call(kf, k)) out[k] = kf[k];
    return out;
  }

  /* --- состояние спрайта в момент time (мс) --- */

  function getSpriteState(name, time) {
    var anim = animations[name];
    if (!anim) throw new Error('Неизвестная анимация: ' + name);
    var kfs = anim.keyframes;
    if (!kfs.length) return null;
    if (kfs.length === 1) return mergeOwn(kfs[0]);

    var maxTime = kfs[kfs.length - 1].time;
    var sp = anim.springParams;

    if (!anim.loopEnabled) {
      if (time >= maxTime) return mergeOwn(kfs[kfs.length - 1]);
      return interpBetween(kfs, time, sp);
    }
    var cycle = maxTime + anim.loopDelay;
    if (cycle <= 0) return mergeOwn(kfs[0]);
    var t = ((time % cycle) + cycle) % cycle;

    if (t < maxTime) return interpBetween(kfs, t, sp);
    if (t < maxTime + anim.loopDelay) return mergeOwn(kfs[kfs.length - 1]);   // пауза на последнем кадре

    var span = cycle - maxTime - anim.loopDelay;                              // переход last -> first
    if (span <= 0) return mergeOwn(kfs[kfs.length - 1]);
    var last = kfs[kfs.length - 1];
    return interpolate(last, kfs[0], clamp01((t - maxTime - anim.loopDelay) / span), last.easing, sp[kfs.length - 1]);
  }

  function interpBetween(kfs, time, sp) {
    var i = 1;
    while (i < kfs.length && kfs[i].time <= time) i++;
    if (i >= kfs.length) i = kfs.length - 1;
    var prev = kfs[i - 1], curr = kfs[i];
    var p = clamp01((time - prev.time) / (curr.time - prev.time));
    return interpolate(prev, curr, p, prev.easing, sp[i - 1]);
  }

  function interpolate(prev, curr, t, easing, springParamsKey) {
    var e = t;
    if (easing) {
      if (easing === 'spring') {
        var p = springParamsKey || { stiffness: 170, damping: 26 };
        e = easingFunctions.spring(t, p.stiffness, p.damping);
      } else if (easingFunctions[easing]) {
        e = easingFunctions[easing](t);
      }
    }
    return {
      x: prev.x + (curr.x - prev.x) * e,
      y: prev.y + (curr.y - prev.y) * e,
      scaleX: prev.scaleX + (curr.scaleX - prev.scaleX) * e,
      scaleY: prev.scaleY + (curr.scaleY - prev.scaleY) * e,
      shearX: prev.shearX + (curr.shearX - prev.shearX) * e,
      shearY: prev.shearY + (curr.shearY - prev.shearY) * e,
      rotation: prev.rotation + (curr.rotation - prev.rotation) * e,
      pivotX: prev.pivotX + (curr.pivotX - prev.pivotX) * e,
      pivotY: prev.pivotY + (curr.pivotY - prev.pivotY) * e
    };
  }

  /* --- границы анимации (min/max по ключам) --- */

  function getAnimationBounds(name) {
    var anim = animations[name];
    if (!anim) throw new Error('Неизвестная анимация: ' + name);
    var kfs = anim.keyframes;
    if (!kfs.length) return null;
    var fields = ['x', 'y', 'scaleX', 'scaleY', 'shearX', 'shearY', 'rotation', 'pivotX', 'pivotY'];
    var out = {};
    fields.forEach(function (f) {
      var mn = Infinity, mx = -Infinity;
      kfs.forEach(function (kf) { if (kf[f] == null) return; if (kf[f] < mn) mn = kf[f]; if (kf[f] > mx) mx = kf[f]; });
      out[f] = { min: mn === Infinity ? 0 : mn, max: mx === -Infinity ? 0 : mx };
    });
    return out;
  }

  /* --- отрисовка кадра. Порядок transform как в редакторе.
        opts.scale — модификатор размера (1 = натуральный), не трогает canvas. --- */

  function drawSpriteFrame(ctx, image, state, options) {
    var o = options || {};
    var w = o.width || (image && image.naturalWidth) || 0;
    var h = o.height || (image && image.naturalHeight) || 0;
    var cx = o.centerX != null ? o.centerX : ctx.canvas.width / 2;
    var cy = o.centerY != null ? o.centerY : ctx.canvas.height / 2;
    var scale = o.scale != null ? o.scale : 1;
    var px = (state.pivotX != null ? state.pivotX : 0.5) * w;
    var py = (state.pivotY != null ? state.pivotY : 0.5) * h;

    ctx.save();
    ctx.translate(cx + (state.x || 0), cy + (state.y || 0));
    ctx.scale(scale, scale);
    ctx.translate(px, py);
    ctx.transform(1, Math.tan(((state.shearY || 0) * Math.PI) / 180),
                     Math.tan(((state.shearX || 0) * Math.PI) / 180), 1, 0, 0);
    ctx.rotate(((state.rotation || 0) * Math.PI) / 180);
    ctx.scale(state.scaleX != null ? state.scaleX : 1, state.scaleY != null ? state.scaleY : 1);
    ctx.translate(-px, -py);
    if (image) ctx.drawImage(image, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  /* --- встроенная анимация «sway» (исходный пример редактора) --- */

  var SWAY = [
    { time: 0,     x: 0, y: 0, scaleX: 1, scaleY: 1.35, shearX: 12,  shearY: 0, rotation: 0, pivotX: 0.5, pivotY: 0.5, easing: 'easeInSine' },
    { time: 499.5, x: 0, y: 0, scaleX: 1, scaleY: 1,    shearX: 0,   shearY: 0, rotation: 0, pivotX: 0.5, pivotY: 0.5, easing: 'easeOutSine' },
    { time: 1000,  x: 0, y: 0, scaleX: 1, scaleY: 1.35, shearX: -12, shearY: 0, rotation: 0, pivotX: 0.5, pivotY: 0.5, easing: 'easeInSine' },
    { time: 1500,  x: 0, y: 0, scaleX: 1, scaleY: 1,    shearX: 0,   shearY: 0, rotation: 0, pivotX: 0.5, pivotY: 0.5, easing: 'easeOutSine' },
    { time: 2000,  x: 0, y: 0, scaleX: 1, scaleY: 1.35, shearX: 12,  shearY: 0, rotation: 0, pivotX: 0.5, pivotY: 0.5, easing: 'easeInSine' }
  ];
  defineAnimation('sway', { keyframes: SWAY, loopEnabled: true, loopDelay: 0, springParams: {} });

  global.Pack = {
    easingFunctions: easingFunctions,
    defineAnimation: defineAnimation,
    hasAnimation: hasAnimation,
    listAnimations: listAnimations,
    getSpriteState: getSpriteState,
    interpolate: interpolate,
    getAnimationBounds: getAnimationBounds,
    drawSpriteFrame: drawSpriteFrame,
    DEFAULT_SWAY_KEYFRAMES: SWAY
  };
})(typeof window !== 'undefined' ? window : this);
