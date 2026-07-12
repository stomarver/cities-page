/* SH.JS — page shell (regions + anchors).
   Fonts: ./fonts/WebPlus_IBM_VGA_8x14.woff , 8x16.woff

   Usage:
     <script src="SH.JS"></script>
   Optional before load:
     window.SH = { mainWidth: 480 };

   Main height is ALWAYS content-driven (.slot). Bottom row fills the
   remaining viewport via table layout (no fixed mainHeight / bottomTop).

   API after ready:
     SH.ready, SH.root, SH.config
     SH.whenReady(fn)
     SH.relayout()          — re-measure after fonts/content (usually noop for table)
     SH.getRegion(name)     — element by data-region
     SH.getAnchor(region, pos)
*/
(function (global) {
  "use strict";

  var CFG = global.SH || {};
  var MAIN_W = CFG.mainWidth != null ? CFG.mainWidth | 0 : 480;
  if (MAIN_W < 2) MAIN_W = 480;
  if (MAIN_W & 1) MAIN_W += 1; /* keep even */
  var HEADER_H = 64;
  var MID_X = (MAIN_W / 2) | 0;

  var GRID = [
    "top-left", "top-center", "top-right",
    "left", "center", "right",
    "bottom-left", "bottom-center", "bottom-right"
  ];
  var HEADER_POS = ["left", "center", "right"];
  var waiters = [];

  function el(tag, attrs, parent) {
    var n = document.createElement(tag);
    var k;
    if (attrs) {
      for (k in attrs) {
        if (!attrs.hasOwnProperty(k)) continue;
        if (k === "className") n.className = attrs[k];
        else if (k === "cssText") n.style.cssText = attrs[k];
        else if (k === "id") {
          n.id = attrs[k];
          n.setAttribute("id", attrs[k]);
        } else n.setAttribute(k, attrs[k]);
      }
    }
    if (parent) parent.appendChild(n);
    return n;
  }

  function addAnchors(region, positions) {
    var i;
    for (i = 0; i < positions.length; i++) {
      el("i", { className: "anchor", "data-pos": positions[i] }, region);
    }
  }

  function injectCSS() {
    var css = ""
      + '@font-face{font-family:"8x16";src:url("./fonts/WebPlus_IBM_VGA_8x16.woff");}'
      + '@font-face{font-family:"8x14";src:url("./fonts/WebPlus_IBM_VGA_8x14.woff");}'
      + "html,body,div,i,small,a,p,span{margin:0;border:0;}"
      + "html,body{width:100%;height:100%;overflow-x:hidden;overflow-y:auto;}"
      + 'body{background-color:rgb(48,48,48);color:#cccccc;'
      + 'font-family:"8x16","Courier New",Courier,monospace;'
      + "font-size:16px;line-height:16px;}"
      /* page = 3-row table: header | body | foot(fills rest) */
      + "#page{display:table;width:100%;height:100%;min-height:100%;"
      + "border-collapse:collapse;border-spacing:0;table-layout:fixed;}"
      + ".page-row{display:table-row;}"
      + ".page-cell{display:table-cell;vertical-align:top;}"
      + ".page-row--pack .page-cell{height:1px;}"
      + ".page-row--fill{height:100%;}"
      + ".page-row--fill .page-cell{height:100%;}"
      + ".region{position:relative;}"
      + "#site-header{width:100%;height:" + HEADER_H + "px;"
      + "background-color:rgb(64,64,64);"
      + 'font-family:"8x14","Courier New",Courier,monospace;}'
      + "#content-row{display:table;width:100%;table-layout:fixed;"
      + "border-collapse:collapse;border-spacing:0;}"
      + "#bg-left-half,#site-main,#bg-right-half{"
      + "display:table-cell;vertical-align:top;position:relative;}"
      + "#bg-left-half,#bg-right-half{background-color:rgb(48,48,48);}"
      + "#site-main{width:" + MAIN_W + "px;background-color:rgb(64,64,64);}"
      + "#site-main .slot{width:" + MAIN_W + "px;font-size:16px;line-height:16px;}"
      + "#bg-bottom{position:relative;width:100%;height:100%;"
      + "background-color:rgb(48,48,48);}"
      + ".anchor{position:absolute;width:0;height:0;margin:0;border:0;"
      + "line-height:0;font-size:0;}"
      + '#site-header .anchor[data-pos="left"]{left:0;top:32px;}'
      + '#site-header .anchor[data-pos="center"]{left:50%;top:32px;}'
      + '#site-header .anchor[data-pos="right"]{right:0;top:32px;}'
      + '.region--grid .anchor[data-pos="top-left"]{left:0;top:0;}'
      + '.region--grid .anchor[data-pos="top-center"]{left:50%;top:0;}'
      + '.region--grid .anchor[data-pos="top-right"]{right:0;top:0;}'
      + '.region--grid .anchor[data-pos="left"]{left:0;top:50%;}'
      + '.region--grid .anchor[data-pos="center"]{left:50%;top:50%;}'
      + '.region--grid .anchor[data-pos="right"]{right:0;top:50%;}'
      + '.region--grid .anchor[data-pos="bottom-left"]{left:0;bottom:0;}'
      + '.region--grid .anchor[data-pos="bottom-center"]{left:50%;bottom:0;}'
      + '.region--grid .anchor[data-pos="bottom-right"]{right:0;bottom:0;}'
      + '#site-main .anchor[data-pos="top-center"]{left:' + MID_X + "px;top:0;}"
      + '#site-main .anchor[data-pos="bottom-center"]{left:' + MID_X + "px;bottom:0;}"
      + '#site-main .anchor[data-pos="center"]{left:' + MID_X + "px;top:50%;}";

    var style = el("style", { type: "text/css" });
    if (style.styleSheet) style.styleSheet.cssText = css;
    else style.appendChild(document.createTextNode(css));
    document.getElementsByTagName("head")[0].appendChild(style);
  }

  function build() {
    injectCSS();

    var page = el("div", { id: "page" }, document.body);

    var rowHead = el("div", { className: "page-row page-row--pack" }, page);
    var cellHead = el("div", { className: "page-cell" }, rowHead);
    var header = el("div", {
      id: "site-header",
      className: "region",
      "data-region": "header"
    }, cellHead);
    addAnchors(header, HEADER_POS);

    var rowBody = el("div", { className: "page-row page-row--pack" }, page);
    var cellBody = el("div", { className: "page-cell" }, rowBody);
    var row = el("div", { id: "content-row" }, cellBody);

    var left = el("div", {
      id: "bg-left-half",
      className: "region region--grid",
      "data-region": "bg-left-half"
    }, row);
    addAnchors(left, GRID);

    var main = el("div", {
      id: "site-main",
      className: "region region--grid",
      "data-region": "main"
    }, row);
    addAnchors(main, GRID);
    el("div", { className: "slot" }, main);

    var right = el("div", {
      id: "bg-right-half",
      className: "region region--grid",
      "data-region": "bg-right-half"
    }, row);
    addAnchors(right, GRID);

    var rowFoot = el("div", { className: "page-row page-row--fill" }, page);
    var bottom = el("div", {
      id: "bg-bottom",
      className: "page-cell region region--grid",
      "data-region": "bg-bottom"
    }, rowFoot);
    addAnchors(bottom, GRID);

    var api = global.SH || {};
    api.root = page;
    api.config = {
      mainWidth: MAIN_W,
      headerHeight: HEADER_H,
      mainMidX: MID_X
    };
    api.ready = true;
    api.getRegion = function (name) {
      var nodes = document.getElementsByTagName("*");
      var i;
      for (i = 0; i < nodes.length; i++) {
        if (nodes[i].getAttribute && nodes[i].getAttribute("data-region") === name) {
          return nodes[i];
        }
      }
      return null;
    };
    api.getAnchor = function (regionName, pos) {
      var region = typeof regionName === "string" ? api.getRegion(regionName) : regionName;
      if (!region) return null;
      var nodes = region.childNodes;
      var i, n, cls;
      for (i = 0; i < nodes.length; i++) {
        n = nodes[i];
        if (!n.getAttribute) continue;
        cls = " " + (n.className || "") + " ";
        if (cls.indexOf(" anchor ") < 0) continue;
        if (n.getAttribute("data-pos") === pos) return n;
      }
      return null;
    };
    api.relayout = function () {
      /* table foot absorbs free space; force reflow for consumers */
      var m = document.getElementById("site-main");
      if (m) api.config.mainHeight = m.offsetHeight;
      return api.config.mainHeight;
    };
    api.whenReady = function (fn) {
      if (typeof fn !== "function") return;
      if (api.ready) fn(api);
      else waiters.push(fn);
    };
    global.SH = api;

    var i;
    for (i = 0; i < waiters.length; i++) waiters[i](api);
    waiters = [];
  }

  function start() {
    if (document.body) build();
    else if (global.addEventListener) {
      global.addEventListener("DOMContentLoaded", build, false);
    } else {
      global.onload = build;
    }
  }

  start();
})(typeof window !== "undefined" ? window : this);
