/* =====================================================================
   GAMEDAYINMYCITY — main.js  (HONEST MVP)
   ---------------------------------------------------------------------
   This file deliberately contains NO fake/simulated data:
   - no randomized live scores, clocks, viewer counts or odds
   - no fake team names, leagues, products, prices or "LIVE" claims
   - Coach gives honest concierge guidance + real links (data/coach.json),
     and never fabricates scores, odds, listings or counts.
   Homepage grids are rendered from structured data files in /data.
   Design, layout and CSS classes are unchanged.
   ===================================================================== */
(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function loadJSON(path) {
    return fetch(path, { cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .catch(function () { return null; });
  }

  /* Mobile menu */
  var burger = $("#burger"), navMobile = $("#navMobile");
  if (burger && navMobile) {
    burger.addEventListener("click", function () {
      var o = navMobile.classList.toggle("open");
      burger.setAttribute("aria-expanded", o);
    });
    navMobile.addEventListener("click", function (e) {
      if (e.target.tagName === "A") {
        navMobile.classList.remove("open");
        burger.setAttribute("aria-expanded", false);
      }
    });
  }

  /* Honest ticker: platform messages (no fake scores) */
  var track = $("#ticker");
  if (track) {
    var msgs = [
      "Local-first sports \u00b7 rolling out city by city",
      "Browse 25+ sport hubs \u2014 youth to pro",
      "Coach \u2014 your AI sports concierge \u2014 is live",
      "GameDay Live streaming \u2014 join the waitlist",
      "Betting content is education-only \u00b7 where legal \u00b7 21+",
      "Shop category guides \u2014 honest, no fake prices",
      "Partner with us to launch your city"
    ];
    var html = "";
    for (var p = 0; p < 2; p++) {
      msgs.forEach(function (m) { html += '<span class="item">\u2605 ' + m + "</span>"; });
    }
    track.innerHTML = html;
  }

  /* Reveal on scroll */
  if ("IntersectionObserver" in window && !reduce) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    $$(".reveal").forEach(function (el) { io.observe(el); });
  } else {
    $$(".reveal").forEach(function (el) { el.classList.add("in"); });
  }
  ["hub-grid", "shop-grid", "city-grid", "partner-grid", "win-grid", "game-strip", "live-feats", "dir-grid"].forEach(function (c) {
    $$("." + c + ".reveal").forEach(function (el) { el.classList.add("stg"); });
  });

  /* Hero search: routes to the right hub */
  var search = $("#hero-search"), si = $("#searchInput");
  if (search && si) {
    si.addEventListener("focus", function () { search.classList.add("focus"); });
    si.addEventListener("blur", function () { search.classList.remove("focus"); });
    var route = function (q) {
      q = (q || "").toLowerCase();
      var map = [
        ["#explore", ["bet", "odds", "moneyline", "spread", "parlay", "sportsbook", "gambling"]],
        ["#live", ["stream", "watch", "livestream", "gameday live", "broadcast"]],
        ["#gaming", ["esport", "console", "vr", "gaming"]],
        ["#shop", ["gear", "jersey", "glove", "bat", "cleat", "shop", "buy", "card", "equipment"]],
        ["#gameday", ["ticket", "parking", "hotel", "restaurant", "tailgate", "travel", "weather"]],
        ["#states", ["state", "rollout", "near me", "new jersey", "texas", "florida"]],
        ["#coach", ["coach", "help", "recommend", "rule", "nutrition", "recruit", "camp", "trainer"]],
        ["#hub", ["sport", "baseball", "soccer", "basketball", "football", "league", "team", "youth"]]
      ];
      for (var i = 0; i < map.length; i++) {
        for (var j = 0; j < map[i][1].length; j++) {
          if (q.indexOf(map[i][1][j]) !== -1) return map[i][0];
        }
      }
      return "#hub";
    };
    search.addEventListener("submit", function (e) {
      e.preventDefault();
      var target = $(route(si.value));
      if (target) target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    });
  }
  var navSearch = $("#navSearch");
  if (navSearch && si) navSearch.addEventListener("click", function () { si.focus(); });

  /* Render directory grids from /data (no fake counts) */
  var PANELS = ["pn-stadium", "pn-court", "pn-arena", "pn-field"];

  function renderSports(data) {
    var grid = $("#sportGrid");
    if (!grid || !data || !data.sports) return;
    grid.innerHTML = data.sports.map(function (s, i) {
      var light = (i % 4 === 3) ? " light" : "";
      return '<a class="card hub-card panel ' + PANELS[i % 4] + light + ' dir-link" data-cat="' + s.category +
        '" href="#coach" aria-label="' + s.name + '">' +
        '<span class="badge chip">' + s.icon + "</span>" +
        '<div class="lvl">// ' + s.category + "</div>" +
        "<h3>" + s.name + "</h3>" +
        '<div class="meta">' + (s.blurb || "Explore the category") + " \u00b7 " +
        (s.coverage === "live" ? "available" : "rolling out") + "</div></a>";
    }).join("");
  }
  function renderGameday(data) {
    var grid = $("#gamedayGrid");
    if (!grid || !data || !data.hubs) return;
    grid.innerHTML = data.hubs.map(function (h, i) {
      var light = (i % 4 === 3) ? " light" : "";
      return '<a class="card hub-card panel ' + PANELS[i % 4] + light + ' dir-link" href="#coach" aria-label="' + h.name + '">' +
        '<span class="badge chip">' + h.icon + "</span>" +
        '<div class="lvl">// Game Day</div>' +
        "<h3>" + h.name + "</h3>" +
        '<div class="meta">' + (h.blurb || "") + "</div></a>";
    }).join("");
  }
  function renderShop(data) {
    var grid = $("#shopGrid");
    if (!grid || !data || !data.categories) return;
    grid.innerHTML = data.categories.map(function (c, i) {
      var hasLinks = c.affiliateLinks && c.affiliateLinks.length;
      var price = hasLinks ? "Shop now" : "Coming Soon";
      return '<article class="card product"><span class="badge aff">Category</span>' +
        '<div class="panel ' + PANELS[i % 4] + ' pic sweep"></div>' +
        '<div class="body"><div class="cat">' + c.name + "</div>" +
        "<h4>Explore " + c.name + "</h4>" +
        '<div class="pr"><span class="now">' + price + "</span></div></div></article>";
    }).join("");
  }

  function wireFilters() {
    var chips = $$(".chipf");
    if (!chips.length) return;
    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        chips.forEach(function (c) { c.setAttribute("aria-selected", "false"); });
        chip.setAttribute("aria-selected", "true");
        var f = chip.getAttribute("data-filter");
        $$("#sportGrid .dir-link").forEach(function (card) {
          var show = (f === "all") || (card.getAttribute("data-cat") === f);
          card.style.display = show ? "" : "none";
        });
      });
    });
  }

  loadJSON("data/sports.json").then(function (d) { renderSports(d); wireFilters(); });
  loadJSON("data/gameday.json").then(renderGameday);
  loadJSON("data/shop.json").then(renderShop);

  /* Tabs */
  var tabs = $$(".tab");
  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      tabs.forEach(function (t) { t.setAttribute("aria-selected", "false"); });
      tab.setAttribute("aria-selected", "true");
      $$(".tabpanel").forEach(function (pn) { pn.classList.remove("active"); });
      var panel = $("#panel-" + tab.getAttribute("data-tab"));
      if (panel) panel.classList.add("active");
    });
  });

  /* Coach: honest concierge from data/coach.json */
  var chatBody = $("#chatBody"), chatForm = $("#chatForm"), chatInput = $("#chatInput");
  var COACH = null;

  function addMsg(text, who, suggestions) {
    if (!chatBody) return;
    var div = document.createElement("div");
    div.className = "msg " + who;
    div.textContent = text;
    if (suggestions && suggestions.length) {
      var res = document.createElement("div");
      res.className = "res";
      suggestions.forEach(function (s) {
        var a = document.createElement("a");
        a.href = s.href || "#";
        a.innerHTML = "<span>" + s.label + '</span><span class="tag">Open</span>';
        res.appendChild(a);
      });
      div.appendChild(res);
    }
    chatBody.appendChild(div);
    chatBody.scrollTop = chatBody.scrollHeight;
    return div;
  }

  function matchIntent(q) {
    if (!COACH) return null;
    q = q.toLowerCase();
    var intents = COACH.intents || [];
    for (var i = 0; i < intents.length; i++) {
      var m = intents[i].match || [];
      for (var j = 0; j < m.length; j++) {
        if (q.indexOf(m[j].toLowerCase()) !== -1) return intents[i];
      }
    }
    return null;
  }

  function botReply(q) {
    if (!chatBody) return;
    var typing = document.createElement("div");
    typing.className = "msg bot";
    typing.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
    chatBody.appendChild(typing);
    chatBody.scrollTop = chatBody.scrollHeight;
    setTimeout(function () {
      chatBody.removeChild(typing);
      var hit = matchIntent(q);
      if (hit) { addMsg(hit.answer, "bot", hit.suggestions); }
      else if (COACH && COACH.fallback) { addMsg(COACH.fallback.answer, "bot", COACH.fallback.suggestions); }
      else { addMsg("I'm here to point you to real hubs across the platform. Try a suggestion above.", "bot"); }
    }, reduce ? 150 : 650);
  }

  function ask(q) { if (!q) return; addMsg(q, "user"); botReply(q); }

  var prompts = $("#prompts");
  if (prompts) {
    prompts.addEventListener("click", function (e) {
      var b = e.target.closest(".prompt");
      if (b) {
        ask(b.getAttribute("data-q") || b.textContent.trim());
        var anchor = $("#coach-chat");
        if (anchor) anchor.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
      }
    });
  }
  if (chatForm && chatInput) {
    chatForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = chatInput.value.trim();
      if (!v) return;
      chatInput.value = "";
      ask(v);
    });
  }

  loadJSON("data/coach.json").then(function (d) {
    COACH = d;
    if (d && chatBody && d.greeting) {
      var first = chatBody.querySelector(".msg.bot");
      if (first && !first.querySelector(".typing")) first.textContent = d.greeting;
    }
    if (d && prompts && d.prompts && d.prompts.length) {
      prompts.innerHTML = d.prompts.map(function (p) {
        return '<button class="prompt" data-q="' + p.replace(/"/g, "&quot;") + '">' + p + "</button>";
      }).join("");
    }
  });

  /* Waitlist / partner intake (honest: no fake submit) */
  $$(".waitlist").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var note = form.querySelector(".wl-note");
      var email = form.querySelector('input[name="email"]');
      if (email && !email.value) { if (note) note.textContent = "Please add an email so we can reach you."; return; }
      if (note) note.textContent = "Thanks \u2014 you're noted. The waitlist backend isn't connected yet, so nothing was submitted. We'll wire this to /api/waitlist next.";
    });
  });

  /* Coach floating tip: honest, dismissible (no fake stats) */
  var fab = $("#coachFab"), tip = $("#cfTip"), x = $("#cfX");
  if (fab && tip && x) {
    var tips = [
      "Ask me to find a local league or camp.",
      "I can explain any sport's rules.",
      "Need gear advice? Tell me the sport and age.",
      "Curious where we're rolling out next? Just ask.",
      "Betting questions? I keep it educational, 21+."
    ];
    var i = 0, dismissed = false;
    setTimeout(function () { if (!dismissed) fab.hidden = false; }, 3000);
    setInterval(function () {
      if (dismissed || fab.hidden) return;
      i = (i + 1) % tips.length;
      if (reduce) { tip.textContent = tips[i]; return; }
      tip.style.opacity = "0";
      setTimeout(function () { tip.textContent = tips[i]; tip.style.opacity = "1"; }, 300);
    }, 9000);
    x.addEventListener("click", function () { dismissed = true; fab.hidden = true; });
  }
})();

/* ===================== TOP STATES / ROLLOUT EXPLORER ===================== */
(function () {
  "use strict";
  var STATES = window.GDIMC_STATES || [];
  var rail = document.getElementById("stateRail");
  var detail = document.getElementById("stateDetail");
  if (!rail || !detail) return;

  function dotColor(c) { return c === "legal" ? "var(--neon)" : (c === "limited" ? "var(--amber)" : "#cf6b6b"); }
  function betClass(c) { return c === "legal" ? "bet-legal" : (c === "limited" ? "bet-limited" : "bet-no"); }
  function facet(ic, label, n, txt) {
    return '<div class="facet-card"><div class="fc-h"><span class="fc-ic">' + ic + "</span>" + label +
      (n ? '<span class="fc-n">' + n + "</span>" : "") + "</div><p>" + txt + "</p></div>";
  }
  function facetBet(b) {
    return '<div class="facet-card facet-bet ' + betClass(b.cls) + '"><div class="fc-h"><span class="fc-ic">\uD83D\uDCB0</span>Betting (education)' +
      '<span class="fc-pill">' + b.label + "</span></div><p>" + b.note + "</p></div>";
  }
  function renderDetail(s) {
    var html = '<div class="sd-head">' +
      '<div class="sd-flag">' + s.ab + "</div>" +
      '<div class="sd-titles"><h3>' + s.name + '</h3><div class="sd-tag">' + s.tag + "</div></div>" +
      '<span class="badge ' + betClass(s.bet.cls) + ' sd-bet">\u25CF ' + s.bet.label + "</span>" +
      "</div>" +
      '<div class="sd-coach"><span class="sd-cav">C</span><span><b>Coach:</b> ' + s.coach + "</span></div>" +
      '<div class="sd-cities">' + s.cities.map(function (c) { return '<span class="chip-city">\uD83D\uDCCD ' + c + "</span>"; }).join("") + "</div>" +
      '<div class="sd-facets">' +
      facet("\uD83C\uDFDF", "Pro Teams", s.pro.n, s.pro.txt) +
      facet("\uD83C\uDF93", "College", null, s.college) +
      facet("\uD83C\uDFEB", "High School", null, s.hs) +
      facetBet(s.bet) +
      facet("\uD83C\uDFAE", "Gaming & Esports", null, s.gaming) +
      "</div>";
    detail.classList.remove("sd-in");
    detail.innerHTML = html;
    void detail.offsetWidth;
    detail.classList.add("sd-in");
  }

  rail.innerHTML = STATES.map(function (s, i) {
    return '<button class="state-btn" role="tab" aria-selected="' + (i === 0) + '" data-i="' + i + '">' +
      '<span class="ab">' + s.ab + "</span>" +
      '<span class="nm-wrap"><span class="nm">' + s.name + '</span><span class="sub">' + s.tag + "</span></span>" +
      '<span class="bdot" style="background:' + dotColor(s.bet.cls) + '"></span></button>';
  }).join("");

  rail.addEventListener("click", function (e) {
    var b = e.target.closest(".state-btn");
    if (!b) return;
    rail.querySelectorAll(".state-btn").forEach(function (x) { x.setAttribute("aria-selected", "false"); });
    b.setAttribute("aria-selected", "true");
    renderDetail(STATES[+b.getAttribute("data-i")]);
  });

  if (STATES.length) renderDetail(STATES[0]);
})();
