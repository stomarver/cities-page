/* PG.JS — declarative page loader (.PG semi-markdown → shell anchors).
   Requires SH.JS first.

   Usage:
     <script src="SH.JS"></script>
     <script src="PG.JS" data-pg="CITIES.PG"></script>
   or:
     PG.load("CITIES.PG")

   ─── .PG format ───────────────────────────────────────────────

   # comment

   @shell
   main-width: 480

   @meta
   title: Page title

   @header center          # region + anchor (header: left|center|right)
   type: link              # text | link | gap
   href: PROJECTS.HTM
   text: PROJECTS
   size: 48                # font-size px (even preferred)
   line: 48                # line-height px (default = size)
   color: #ffff00
   hover: #ffffff
   font: 8x14              # 8x14 | 8x16
   bold: yes
   dx: 0                   # extra offset px from anchor
   dy: 0

   @main flow              # flow into #site-main .slot (grows main height)
   color: #ffff99
   size: 16
   line: 16
   gap: 16                 # blank space between paragraphs
   ---
   first paragraph...
   ---
   second paragraph...

   @main top-left          # absolute item on a grid anchor
   type: text
   text: hello
   size: 16
   color: #ccc
   dx: 0
   dy: 0

   @left-half center       # aliases: left-half, right-half, bottom, main, header
   ...

   ───────────────────────────────────────────────────────────── */
(function (global) {
  "use strict";

  var REGION_ALIAS = {
    header: "header",
    main: "main",
    "left-half": "bg-left-half",
    "right-half": "bg-right-half",
    bottom: "bg-bottom",
    "bg-left-half": "bg-left-half",
    "bg-right-half": "bg-right-half",
    "bg-bottom": "bg-bottom"
  };

  function trim(s) {
    return String(s || "").replace(/^\s+|\s+$/g, "");
  }

  function parseBool(v) {
    v = trim(v).toLowerCase();
    return v === "1" || v === "yes" || v === "true" || v === "on";
  }

  function parsePx(v, fb) {
    if (v == null || v === "") return fb;
    var n = parseInt(String(v).replace(/px$/i, ""), 10);
    return isNaN(n) ? fb : n;
  }

  function even(n) {
    n = n | 0;
    return n & 1 ? n + 1 : n;
  }

  /* ── parser ── */

  function parsePG(src) {
    var lines = String(src).replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    var doc = { shell: {}, meta: {}, blocks: [] };
    var i = 0;
    var cur = null;
    var mode = null; /* null | props | flow-text */
    var buf = [];

    function flushText() {
      if (!cur || mode !== "flow-text") return;
      var t = trim(buf.join("\n"));
      buf = [];
      if (t) {
        if (!cur.paragraphs) cur.paragraphs = [];
        cur.paragraphs.push(t);
      }
    }

    function startBlock(kind, anchor) {
      flushText();
      cur = { kind: kind, anchor: anchor || null, props: {}, paragraphs: [] };
      doc.blocks.push(cur);
      mode = "props";
    }

    for (i = 0; i < lines.length; i++) {
      var raw = lines[i];
      var line = trim(raw);

      if (mode === "flow-text") {
        if (line.charAt(0) === "@") {
          flushText();
          mode = "props";
          /* fall through to handle @ */
        } else if (line === "---") {
          flushText();
          buf = [];
          continue;
        } else {
          buf.push(raw.replace(/\s+$/g, ""));
          continue;
        }
      }

      if (!line || line.charAt(0) === "#") continue;

      if (line.charAt(0) === "@") {
        var head = trim(line.slice(1));
        var parts = head.split(/\s+/);
        var tag = (parts[0] || "").toLowerCase();
        var arg = parts[1] ? parts.slice(1).join(" ") : "";

        if (tag === "shell") {
          cur = { kind: "shell", props: doc.shell };
          mode = "props";
        } else if (tag === "meta") {
          cur = { kind: "meta", props: doc.meta };
          mode = "props";
        } else if (REGION_ALIAS[tag]) {
          startBlock(REGION_ALIAS[tag], arg || "flow");
        } else {
          startBlock(tag, arg || null);
        }
        continue;
      }

      if (line === "---") {
        if (cur && (cur.anchor === "flow" || cur.kind === "main")) {
          mode = "flow-text";
          buf = [];
          if (cur.anchor !== "flow") cur.anchor = "flow";
        }
        continue;
      }

      /* key: value */
      var colon = line.indexOf(":");
      if (colon > 0 && cur && cur.props) {
        var key = trim(line.slice(0, colon)).toLowerCase();
        var val = trim(line.slice(colon + 1));
        cur.props[key] = val;
      }
    }
    flushText();
    return doc;
  }

  /* ── apply ── */

  function applyShell(props) {
    /* Width is fixed when SH boots. Prefer:
         <script>window.SH={mainWidth:480}</script> before SH.JS
       or put main-width in @shell for documentation; live width = SH.config.mainWidth.
    */
    if (props["main-width"] && global.console && console.info) {
      var want = parsePx(props["main-width"], null);
      var have = global.SH && global.SH.config && global.SH.config.mainWidth;
      if (want != null && have != null && want !== have) {
        console.info("[PG] @shell main-width:" + want + " ignored (SH already built at " + have + "px). Set window.SH.mainWidth before SH.JS.");
      }
    }
  }

  function applyMeta(props) {
    if (props.title) document.title = props.title;
  }

  function styleFont(node, props) {
    var size = parsePx(props.size, 16);
    var line = parsePx(props.line, size);
    var font = trim(props.font || "8x16");
    node.style.fontSize = size + "px";
    node.style.lineHeight = line + "px";
    if (font === "8x14") {
      node.style.fontFamily = '"8x14","Courier New",Courier,monospace';
    } else {
      node.style.fontFamily = '"8x16","Courier New",Courier,monospace';
    }
    if (parseBool(props.bold)) node.style.fontWeight = "bold";
    if (props.color) node.style.color = props.color;
    if (props["text-transform"]) node.style.textTransform = props["text-transform"];
    else if (parseBool(props.uppercase)) node.style.textTransform = "uppercase";
  }

  function placeAbsolute(node, region, anchor, props) {
    var dx = parsePx(props.dx, 0);
    var dy = parsePx(props.dy, 0);
    var size = parsePx(props.size, 16);
    var line = parsePx(props.line, size);

    node.style.position = "absolute";
    node.style.margin = "0";
    node.style.border = "0";
    node.style.whiteSpace = props.wrap === "yes" ? "normal" : "nowrap";

    /* match anchor corner; header vertical mid for left/center/right */
    var pos = anchor || "top-left";
    node.style.left = "";
    node.style.right = "";
    node.style.top = "";
    node.style.bottom = "";

    if (region.getAttribute("data-region") === "header") {
      var y = ((64 - line) / 2) | 0;
      if (y < 0) y = 0;
      node.style.top = (y + dy) + "px";
      if (pos === "left") node.style.left = (0 + dx) + "px";
      else if (pos === "right") node.style.right = (0 + dx) + "px";
      else {
        /* center: integer left after measure */
        region.appendChild(node);
        var x = ((region.offsetWidth - node.offsetWidth) / 2) | 0;
        node.style.left = (x + dx) + "px";
        return node;
      }
      region.appendChild(node);
      return node;
    }

    /* grid */
    if (pos.indexOf("left") >= 0 || pos === "left") node.style.left = (0 + dx) + "px";
    if (pos.indexOf("right") >= 0 || pos === "right") node.style.right = (0 + dx) + "px";
    if (pos.indexOf("top") >= 0) node.style.top = (0 + dy) + "px";
    if (pos.indexOf("bottom") >= 0) node.style.bottom = (0 + dy) + "px";
    if (pos === "center" || pos === "left" || pos === "right" || pos === "top-center" || pos === "bottom-center") {
      if (pos === "center" || pos === "left" || pos === "right") {
        if (pos === "left") node.style.left = (0 + dx) + "px";
        if (pos === "right") node.style.right = (0 + dx) + "px";
        if (pos === "center") {
          region.appendChild(node);
          node.style.left = (((region.offsetWidth - node.offsetWidth) / 2) | 0) + dx + "px";
          node.style.top = (((region.offsetHeight - node.offsetHeight) / 2) | 0) + dy + "px";
          return node;
        }
        region.appendChild(node);
        node.style.top = (((region.offsetHeight - node.offsetHeight) / 2) | 0) + dy + "px";
        return node;
      }
      if (pos === "top-center" || pos === "bottom-center") {
        region.appendChild(node);
        node.style.left = (((region.offsetWidth - node.offsetWidth) / 2) | 0) + dx + "px";
        if (pos === "top-center") node.style.top = (0 + dy) + "px";
        else node.style.bottom = (0 + dy) + "px";
        return node;
      }
    }
    if (!node.style.top && !node.style.bottom) node.style.top = (0 + dy) + "px";
    if (!node.style.left && !node.style.right) node.style.left = (0 + dx) + "px";
    region.appendChild(node);
    return node;
  }

  function renderFlow(block) {
    var main = global.SH.getRegion("main");
    if (!main) return;
    var slot = null;
    var kids = main.childNodes;
    var i;
    for (i = 0; i < kids.length; i++) {
      if (kids[i].className && (" " + kids[i].className + " ").indexOf(" slot ") >= 0) {
        slot = kids[i];
        break;
      }
    }
    if (!slot) {
      slot = document.createElement("div");
      slot.className = "slot";
      main.appendChild(slot);
    }

    var props = block.props || {};
    var size = parsePx(props.size, 16);
    var line = parsePx(props.line, size);
    var gap = parsePx(props.gap, 16);
    var color = props.color || "#ffff99";

    slot.style.color = color;
    slot.style.fontSize = size + "px";
    slot.style.lineHeight = line + "px";
    slot.innerHTML = "";

    var paras = block.paragraphs || [];
    for (i = 0; i < paras.length; i++) {
      if (i > 0 && gap > 0) {
        var g = document.createElement("div");
        g.style.height = gap + "px";
        g.style.lineHeight = gap + "px";
        g.style.fontSize = size + "px";
        slot.appendChild(g);
      }
      var p = document.createElement("p");
      p.style.margin = "0";
      p.style.border = "0";
      p.style.lineHeight = line + "px";
      p.style.fontSize = size + "px";
      p.style.color = color;
      p.appendChild(document.createTextNode(paras[i]));
      slot.appendChild(p);
    }
  }

  function renderItem(block) {
    var regionName = block.kind;
    var anchor = block.anchor;
    var props = block.props || {};

    if (anchor === "flow" || (!anchor && regionName === "main" && block.paragraphs && block.paragraphs.length)) {
      block.anchor = "flow";
      renderFlow(block);
      return;
    }

    /* flow blocks may only have --- paragraphs without type */
    if (block.paragraphs && block.paragraphs.length && (anchor === "flow" || regionName === "main" && (!props.type || props.type === "flow"))) {
      if (!anchor || anchor === "flow") {
        renderFlow(block);
        return;
      }
    }

    var region = global.SH.getRegion(regionName);
    if (!region) return;

    var type = (props.type || "text").toLowerCase();
    if (type === "gap") {
      /* only meaningful in flow; ignore absolute gap */
      return;
    }

    var node;
    if (type === "link") {
      node = document.createElement("a");
      node.setAttribute("href", props.href || props.url || "#");
      node.appendChild(document.createTextNode(props.text || props.label || props.href || ""));
      node.style.textDecoration = "none";
      if (props.hover) {
        var base = props.color || "#ffff00";
        var hover = props.hover;
        node.onmouseover = function () { node.style.color = hover; };
        node.onmouseout = function () { node.style.color = base; };
      }
    } else {
      node = document.createElement("div");
      node.appendChild(document.createTextNode(props.text || props.label || (block.paragraphs && block.paragraphs[0]) || ""));
    }

    styleFont(node, props);
    placeAbsolute(node, region, anchor, props);
  }

  function applyDoc(doc) {
    applyShell(doc.shell || {});
    applyMeta(doc.meta || {});

    var i, b;
    for (i = 0; i < doc.blocks.length; i++) {
      b = doc.blocks[i];
      if (b.kind === "shell" || b.kind === "meta") continue;
      renderItem(b);
    }

    /* after content + fonts */
    function done() {
      if (global.SH && global.SH.relayout) global.SH.relayout();
      if (global.PG) global.PG.ready = true;
      if (global.PG && global.PG.onReady) global.PG.onReady(doc);
    }

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        /* re-center header absolute items that depend on font metrics */
        reflowCenters(doc);
        done();
      });
    } else {
      global.setTimeout(function () {
        reflowCenters(doc);
        done();
      }, 50);
    }
  }

  function reflowCenters(doc) {
    /* second pass: header center links with real text width */
    var i, b, region, nodes, n, props, dx, line, y, x;
    for (i = 0; i < doc.blocks.length; i++) {
      b = doc.blocks[i];
      if (b.kind !== "header" || b.anchor !== "center") continue;
      region = global.SH.getRegion("header");
      if (!region) continue;
      props = b.props || {};
      nodes = region.childNodes;
      for (var j = nodes.length - 1; j >= 0; j--) {
        n = nodes[j];
        if (!n.tagName) continue;
        if (n.tagName !== "A" && n.tagName !== "DIV") continue;
        if (n.className && (" " + n.className + " ").indexOf(" anchor ") >= 0) continue;
        dx = parsePx(props.dx, 0);
        line = parsePx(props.line, parsePx(props.size, 16));
        y = ((64 - line) / 2) | 0;
        if (y < 0) y = 0;
        x = ((region.offsetWidth - n.offsetWidth) / 2) | 0;
        n.style.left = (x + dx) + "px";
        n.style.top = (y + parsePx(props.dy, 0)) + "px";
        n.style.right = "";
        break;
      }
    }
    if (global.SH && global.SH.relayout) global.SH.relayout();
  }

  function loadText(url, ok, err) {
    if (global.fetch) {
      global.fetch(url).then(function (r) {
        if (!r.ok) throw new Error("PG HTTP " + r.status);
        return r.text();
      }).then(ok).catch(err);
      return;
    }
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (xhr.status === 0 || (xhr.status >= 200 && xhr.status < 300)) ok(xhr.responseText);
      else err(new Error("PG HTTP " + xhr.status));
    };
    xhr.send(null);
  }

  function load(url) {
    var api = global.PG || {};
    api.src = url;
    api.ready = false;
    global.PG = api;

    function run(src) {
      var doc = parsePG(src);
      api.doc = doc;
      function go() {
        applyDoc(doc);
      }
      if (global.SH && global.SH.whenReady) global.SH.whenReady(go);
      else if (global.SH && global.SH.ready) go();
      else {
        var t = global.setInterval(function () {
          if (global.SH && global.SH.ready) {
            global.clearInterval(t);
            go();
          }
        }, 10);
      }
    }

    loadText(url, run, function (e) {
      if (global.console && console.error) console.error("[PG]", url, e);
    });
    return api;
  }

  function bootFromScript() {
    var scripts = document.getElementsByTagName("script");
    var i, s, src;
    for (i = scripts.length - 1; i >= 0; i--) {
      s = scripts[i];
      src = s.getAttribute("data-pg") || s.getAttribute("data-src");
      if (src) {
        load(src);
        return;
      }
    }
  }

  global.PG = global.PG || {};
  global.PG.load = load;
  global.PG.parse = parsePG;

  if (document.currentScript) {
    var ds = document.currentScript.getAttribute("data-pg") || document.currentScript.getAttribute("data-src");
    if (ds) load(ds);
    else {
      /* defer: maybe attribute on later? scan after DOM ready */
      if (global.addEventListener) {
        global.addEventListener("DOMContentLoaded", bootFromScript, false);
      }
    }
  } else if (global.addEventListener) {
    global.addEventListener("DOMContentLoaded", bootFromScript, false);
  }
})(typeof window !== "undefined" ? window : this);
