/* DBG.JS — labels + outlines on SH.JS anchors.
   <script src="SH.JS"></script>
   <script src="DBG.JS"></script>
   Optional after PG: load DBG last so labels sit above content. */
(function (global) {
  "use strict";

  var OPT = global.DBG || {};
  if (OPT.enabled === false) return;

  var COLORS = {
    header: { tag: "header", outline: "#66ccff", text: "#99ddff" },
    main: { tag: "main", outline: "#ffcc66", text: "#ffdd99" },
    "bg-left-half": { tag: "L-half", outline: "#66ff99", text: "#99ffcc" },
    "bg-right-half": { tag: "R-half", outline: "#cc66ff", text: "#ddaaff" },
    "bg-bottom": { tag: "bottom", outline: "#ff9966", text: "#ffbb99" }
  };

  function el(tag, attrs, parent) {
    var n = document.createElement(tag);
    var k;
    if (attrs) {
      for (k in attrs) {
        if (!attrs.hasOwnProperty(k)) continue;
        if (k === "className") n.className = attrs[k];
        else if (k === "text") n.appendChild(document.createTextNode(attrs[k]));
        else n.setAttribute(k, attrs[k]);
      }
    }
    if (parent) parent.appendChild(n);
    return n;
  }

  function injectCSS() {
    var midX = (global.SH && global.SH.config && global.SH.config.mainMidX) || 240;
    var css = ""
      + ".pin{position:absolute;z-index:5;margin:0;border:0;"
      + "background-color:#000000;color:#ffffff;"
      + "font-size:16px;line-height:16px;white-space:nowrap;"
      + "outline:2px solid #ffffff;outline-offset:-1px;}"
      + ".pin small{display:block;margin:0;font-size:14px;line-height:14px;"
      + 'color:#aaaaaa;font-family:"8x14","Courier New",Courier,monospace;}'
      + "#site-header .pin{outline-color:#66ccff;color:#99ddff;}"
      + "#site-main .pin{outline-color:#ffcc66;color:#ffdd99;}"
      + "#bg-left-half .pin{outline-color:#66ff99;color:#99ffcc;}"
      + "#bg-right-half .pin{outline-color:#cc66ff;color:#ddaaff;}"
      + "#bg-bottom .pin{outline-color:#ff9966;color:#ffbb99;}"
      + '#site-header .pin[data-at="left"]{left:0;top:32px;}'
      + '#site-header .pin[data-at="center"]{left:50%;top:32px;}'
      + '#site-header .pin[data-at="right"]{right:0;top:32px;}'
      + '.region--grid .pin[data-at="top-left"]{left:0;top:0;}'
      + '.region--grid .pin[data-at="top-center"]{left:50%;top:0;}'
      + '.region--grid .pin[data-at="top-right"]{right:0;top:0;}'
      + '.region--grid .pin[data-at="left"]{left:0;top:50%;}'
      + '.region--grid .pin[data-at="center"]{left:50%;top:50%;}'
      + '.region--grid .pin[data-at="right"]{right:0;top:50%;}'
      + '.region--grid .pin[data-at="bottom-left"]{left:0;bottom:0;}'
      + '.region--grid .pin[data-at="bottom-center"]{left:50%;bottom:0;}'
      + '.region--grid .pin[data-at="bottom-right"]{right:0;bottom:0;}'
      + '#site-main .pin[data-at="top-center"]{left:' + midX + "px;top:0;}"
      + '#site-main .pin[data-at="bottom-center"]{left:' + midX + "px;bottom:0;}"
      + '#site-main .pin[data-at="center"]{left:' + midX + "px;top:50%;}"
      + "body.shell-debug #site-header,body.shell-debug #site-main{"
      + "outline:2px solid #888888;outline-offset:-1px;}"
      + "body.shell-debug #bg-left-half,body.shell-debug #bg-right-half,"
      + "body.shell-debug #bg-bottom{outline:2px solid #666666;outline-offset:-1px;}"
      + "body.shell-debug .anchor{width:2px;height:2px;background-color:#ff00ff;}";

    var style = el("style", { type: "text/css" });
    if (style.styleSheet) style.styleSheet.cssText = css;
    else style.appendChild(document.createTextNode(css));
    document.getElementsByTagName("head")[0].appendChild(style);
  }

  function decorate() {
    var body = document.body;
    if (!body) return;
    if ((" " + body.className + " ").indexOf(" shell-debug ") < 0) {
      body.className = (body.className ? body.className + " " : "") + "shell-debug";
    }
    injectCSS();

    var nodes = document.getElementsByTagName("div");
    var i, region, name, meta, j, ch, pos, pin;
    for (i = 0; i < nodes.length; i++) {
      region = nodes[i];
      name = region.getAttribute("data-region");
      if (!name || !COLORS[name]) continue;
      meta = COLORS[name];
      for (j = 0; j < region.childNodes.length; j++) {
        ch = region.childNodes[j];
        if (!ch.getAttribute) continue;
        if ((" " + (ch.className || "") + " ").indexOf(" anchor ") < 0) continue;
        pos = ch.getAttribute("data-pos");
        if (!pos) continue;
        pin = el("div", { className: "pin", "data-at": pos }, region);
        el("small", { text: meta.tag }, pin);
        pin.appendChild(document.createTextNode(pos));
      }
    }
    global.DBG = global.DBG || {};
    global.DBG.ready = true;
  }

  function start() {
    if (global.SH && global.SH.whenReady) global.SH.whenReady(decorate);
    else if (global.SH && global.SH.ready) decorate();
    else {
      var t = global.setInterval(function () {
        if (global.SH && global.SH.ready) {
          global.clearInterval(t);
          decorate();
        }
      }, 10);
    }
  }
  start();
})(typeof window !== "undefined" ? window : this);
