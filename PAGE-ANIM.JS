/* PAGE-ANIM.JS — постепенное появление элементов страницы (reveal).
   IIFE -> window.PageAnim. Загружается перед PACK.JS (см. INDEX.HTM).
   Зона ответственности: только «медленная» подгрузка/появление элементов. */
(function (global) {
  'use strict';

  var STAGE_ORDER = ['title', 'text', 'sprites'];
  var STAGE_TIMING = { initialDelay: 140, stageDelay: 240, itemDelay: 80 };
  var CITY_TIMING = { initialDelay: 90, delay: 38 };

  function slice(list) { return Array.prototype.slice.call(list); }

  function delay(ms) {
    return new Promise(function (res) { window.setTimeout(res, ms); });
  }

  function waitForFonts() {
    return (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
  }

  function waitForImages() {
    var imgs = slice(document.images);
    return Promise.all(imgs.map(function (img) {
      if (img.complete) return Promise.resolve();
      return new Promise(function (res) {
        img.addEventListener('load', res, { once: true });
        img.addEventListener('error', res, { once: true });
      });
    }));
  }

  function waitForLayout(n) {
    var frames = n || 2;
    return new Promise(function (res) {
      (function step(left) {
        if (left <= 0) return res();
        window.requestAnimationFrame(function () { step(left - 1); });
      })(frames);
    });
  }

  function waitForStableLayout() {
    return Promise.all([waitForFonts(), waitForImages()]).then(function () {
      return waitForLayout(2);
    });
  }

  function getElementRect(el) {
    var r = el.getBoundingClientRect();
    return {
      top: r.top + window.scrollY, bottom: r.bottom + window.scrollY,
      left: r.left + window.scrollX, right: r.right + window.scrollX
    };
  }

  /* --- поэтапное появление блоков по data-load-stage / data-load-children --- */

  function uniqueDom(elements) {
    var seen = [];
    elements.forEach(function (el) { if (seen.indexOf(el) === -1) seen.push(el); });
    return seen.sort(function (a, b) {
      if (a === b) return 0;
      return (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_PRECEDING) ? 1 : -1;
    });
  }

  function getStageElements(stage, options) {
    var o = options || {};
    var attr = o.attribute || 'data-load-stage';
    var cattr = o.childrenAttribute || 'data-load-children';
    var direct = slice(document.querySelectorAll('[' + attr + '="' + stage + '"]'));
    var children = slice(document.querySelectorAll('[' + cattr + '="' + stage + '"] > *'));
    return uniqueDom(direct.concat(children));
  }

  function revealStages(options) {
    var o = options || {};
    var loadingClass = o.loadingClass || 'page-loading';
    var visibleClass = o.visibleClass || 'load-visible';
    var stages = o.stages || STAGE_ORDER;
    var t = {
      initialDelay: (o.initialDelay != null) ? o.initialDelay : STAGE_TIMING.initialDelay,
      stageDelay: (o.stageDelay != null) ? o.stageDelay : STAGE_TIMING.stageDelay,
      itemDelay: (o.itemDelay != null) ? o.itemDelay : STAGE_TIMING.itemDelay
    };

    return delay(t.initialDelay).then(function () {
      var chain = Promise.resolve();
      stages.forEach(function (stage) {
        chain = chain.then(function () {
          var elements = getStageElements(stage, o);
          var sc = Promise.resolve();
          elements.forEach(function (el) {
            sc = sc.then(function () { el.classList.add(visibleClass); return delay(t.itemDelay); });
          });
          return sc.then(function () { return delay(t.stageDelay); });
        });
      });
      return chain;
    }).then(function () {
      document.body.classList.remove(loadingClass);
      if (o.onComplete) o.onComplete();
    });
  }

  /* --- появление города (skyline) волной слева направо --- */

  function drawLeftToRight(items, drawItem, options) {
    var o = options || {};
    var sorted = items.slice().sort(function (a, b) {
      if (a.x !== b.x) return a.x - b.x;
      if (a.y !== b.y) return a.y - b.y;
      return 0;
    });
    var i = 0, timer = null, cancelled = false, resolveP;
    var promise = new Promise(function (res) { resolveP = res; });

    function val(opt, fb) {
      return (typeof opt === 'function') ? opt(i, sorted) : ((opt != null) ? opt : fb);
    }
    function finish() { if (o.onComplete) o.onComplete(); resolveP(); }
    function step() {
      if (cancelled || (o.isCancelled && o.isCancelled())) return;
      if (i >= sorted.length) return finish();
      var batch = val(o.batchSize, 12);
      for (var k = 0; k < batch && i < sorted.length; k++) { drawItem(sorted[i], i, sorted); i++; }
      timer = window.setTimeout(step, val(o.delay, 0));
    }
    timer = window.setTimeout(step, o.initialDelay || 0);
    return { promise: promise, cancel: function () { cancelled = true; if (timer) window.clearTimeout(timer); } };
  }

  function getCityPieces(options) {
    var o = options || {};
    var sky = slice(document.querySelectorAll(o.skylineSelector || '.skyline .bar'));
    var ext = slice(document.querySelectorAll(o.extendedSelector || '.skyline-extended .bar'));
    return ext.map(function (bar, index) {
      var rect = getElementRect(bar);
      return { x: rect.left, y: rect.top, bars: [sky[index], bar].filter(Boolean) };
    });
  }

  function revealCity(options) {
    var o = options || {};
    var loadingClass = o.loadingClass || 'city-loading';
    var visibleClass = o.visibleClass || 'city-piece-visible';
    var pieces = getCityPieces(o);
    if (!pieces.length) { document.body.classList.remove(loadingClass); return Promise.resolve(); }

    return drawLeftToRight(pieces, function (piece) {
      piece.bars.forEach(function (bar) { bar.classList.add(visibleClass); });
    }, {
      batchSize: o.batchSize || 1,
      initialDelay: (o.initialDelay != null) ? o.initialDelay : CITY_TIMING.initialDelay,
      delay: (o.delay != null) ? o.delay : CITY_TIMING.delay,
      onComplete: function () {
        document.body.classList.remove(loadingClass);
        if (o.onComplete) o.onComplete();
      }
    }).promise;
  }

  global.PageAnim = {
    waitForFonts: waitForFonts,
    waitForImages: waitForImages,
    waitForLayout: waitForLayout,
    waitForStableLayout: waitForStableLayout,
    delay: delay,
    getElementRect: getElementRect,
    getStageElements: getStageElements,
    revealStages: revealStages,
    drawLeftToRight: drawLeftToRight,
    getCityPieces: getCityPieces,
    revealCity: revealCity
  };
})(window);
