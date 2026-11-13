/* Shared behavior for every page. Settings live in config.js. */
(function () {
  "use strict";

  const C = window.CONTEST || {};
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const page = ($("main[data-page]") || { dataset: {} }).dataset.page || "";
  const live = Boolean(C.supabaseUrl && C.supabaseAnonKey && window.supabase);
  const sb = live ? window.supabase.createClient(C.supabaseUrl, C.supabaseAnonKey) : null;
  const gradeName = (g) => (g === "K" ? "Kindergarten" : "Grade " + g);
  const dates = Object.assign({}, C.dates);
  dates.judgingWindow = dates.judgingOpens === dates.judgingCloses
    ? dates.judgingOpens : dates.judgingOpens + " to " + dates.judgingCloses;

  // Build elements without innerHTML so entry text can never run as code.
  function h(tag, attrs, kids) {
    const el = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v === false || v == null) return;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    });
    [].concat(kids || []).forEach((kid) => kid && el.append(kid));
    return el;
  }

  function showMsg(box, text, kind) {
    box.textContent = text;
    box.className = "msg " + (kind || "");
    box.hidden = !text;
  }

  function busy(btn, on, label) {
    if (on) { btn.dataset.label = btn.textContent; btn.textContent = label || "Working..."; btn.disabled = true; }
    else { btn.textContent = btn.dataset.label || btn.textContent; btn.disabled = false; }
  }

  /* ---------- Header, footer, shared fills ---------- */

  function chrome() {
    const links = [
      ["index.html", "Home", "home"],
      ["submit.html", "Submit an entry", "submit"],
      ["judges.html", "Be a judge", "judges"],
      ["sponsors.html", "Sponsor", "sponsors"],
      ["rules.html", "Rules", "rules"]
    ];
    const head = $("#site-header");
    if (head) {
      if (C.draft) {
        head.append(h("div", { class: "notice" }, h("div", { class: "wrap", text: "Preview site. Dates, prizes and partners are not final." })));
      }
      if (!live && page !== "home" && page !== "rules") {
        head.append(h("div", { class: "notice" }, h("div", { class: "wrap", text: "Demo mode. Forms on this page work, but nothing is saved yet." })));
      }
      const nav = h("nav", { class: "site-nav", "aria-label": "Main" }, links.map(([href, label, key]) =>
        h("a", { href, text: label, "aria-current": (key === page || (key === "judges" && page === "vote")) ? "page" : null })));
      const mark = h("a", { class: "wordmark", href: "index.html" }, [C.name + " ", h("span", { text: C.season })]);
      head.append(h("header", { class: "site-header" }, h("div", { class: "wrap" }, [mark, nav])));
    }
    const foot = $("#site-footer");
    if (foot) {
      const lines = [
        h("p", { text: C.name + " is an independent community contest organized by " + C.organizer + "." }),
        h("p", { text: "It is not run, sponsored or endorsed by the Bellevue School District or the City of Bellevue." })
      ];
      if (C.contactEmail) lines.push(h("p", { text: "Questions: " + C.contactEmail }));
      lines.push(h("p", {}, [h("a", { href: "rules.html", text: "Rules and privacy" })]));
      foot.append(h("footer", { class: "site-footer" }, h("div", { class: "wrap" }, lines)));
    }
    $$("[data-date]").forEach((el) => { el.textContent = dates[el.dataset.date] || ""; });
    $$("[data-fill]").forEach((el) => { el.textContent = C[el.dataset.fill] || ""; });
  }

  function fillLists() {
    const d = dates;
    const tl = $("#timeline");
    if (tl) {
      [
        [d.submissionsOpen, "Submissions open"],
        [d.submissionsClose, "Last day to submit"],
        [d.judgingWindow, "Community judging"],
        [d.winnersAnnounced, "Winners and runners-up announced"],
        [d.presentations, "Winners present their ideas"]
      ].forEach(([when, what]) => tl.append(h("li", {}, [h("span", { class: "when", text: when }), h("span", { text: what })])));
    }
    const wl = $("#word-limits");
    if (wl) {
      (C.wordLimits || []).forEach((b) => wl.append(h("tr", {}, [
        h("td", { text: b.label }), h("td", { text: "Up to " + b.max + " words" }), h("td", { text: b.note || "" })
      ])));
    }
    $$("select[data-options='grades']").forEach((sel) =>
      C.grades.forEach((g) => sel.append(h("option", { value: g, text: gradeName(g) }))));
    $$("select[data-options='departments']").forEach((sel) =>
      C.departments.forEach((x) => sel.append(h("option", { value: x, text: x }))));
    $$("select[data-options='tiers']").forEach((sel) =>
      C.sponsorTiers.forEach((t) => sel.append(h("option", { value: t.name, text: t.name + " (" + t.amount + ")" }))));
  }

  /* ---------- Submit an entry ---------- */

  const MAX_ART_BYTES = 8 * 1024 * 1024;
  const ART_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
  const countWords = (s) => (s.trim().match(/\S+/g) || []).length;
  const limitFor = (g) => ((C.wordLimits || []).find((b) => b.grades.includes(g)) || {}).max || null;

  async function initSubmit() {
    const form = $("#entry-form"), msg = $("#entry-msg"), count = $("#essay-count");
    const grade = $("#grade"), essay = $("#essay"), art = $("#art"), preview = $("#art-preview");

    if (live) {
      const { data } = await sb.from("settings").select("submissions_open").eq("id", 1).maybeSingle();
      if (data && !data.submissions_open) {
        form.hidden = true;
        $("#entry-closed").hidden = false;
        return;
      }
    }

    function updateCount() {
      const n = countWords(essay.value), max = limitFor(grade.value);
      count.textContent = max ? n + " of " + max + " words" : n + " words. Pick a grade to see the limit.";
      count.classList.toggle("over", Boolean(max && n > max));
      return !max || n <= max;
    }
    essay.addEventListener("input", updateCount);
    grade.addEventListener("change", updateCount);
    updateCount();

    function checkArt() {
      const f = art.files[0];
      preview.hidden = true;
      if (!f) return "Add a photo or scan of the art.";
      if (!ART_TYPES[f.type]) return "The art must be a JPG, PNG or WebP image.";
      if (f.size > MAX_ART_BYTES) return "That image is larger than 8 MB. Try a smaller photo.";
      preview.src = URL.createObjectURL(f);
      preview.hidden = false;
      return "";
    }
    art.addEventListener("change", () => showMsg(msg, checkArt(), "err"));

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      showMsg(msg, "");
      if (!form.reportValidity()) return;
      if ($("#website").value) return; // honeypot: bots fill this, people never see it
      if (countWords(essay.value) < 1) return showMsg(msg, "The essay is empty.", "err");
      if (!updateCount()) return showMsg(msg, "The essay is over the word limit for " + gradeName(grade.value) + ".", "err");
      const artProblem = checkArt();
      if (artProblem) return showMsg(msg, artProblem, "err");

      const btn = $("#entry-send"), f = art.files[0];
      const id = crypto.randomUUID();
      const val = (name) => form.elements[name].value.trim();
      busy(btn, true, "Sending...");
      try {
        if (live) {
          const path = id + "." + ART_TYPES[f.type];
          const up = await sb.storage.from("art").upload(path, f, { contentType: f.type });
          if (up.error) throw up.error;
          const ins = await sb.from("entries").insert({
            id,
            student_first_name: val("student_first_name"),
            student_last_name: val("student_last_name"),
            grade: grade.value,
            school: val("school"),
            title: val("title"),
            department: val("department"),
            essay: essay.value.trim(),
            art_path: path,
            art_caption: val("art_caption"),
            contact_email: val("contact_email"),
            contact_phone: val("contact_phone"),
            consent_original: true,
            consent_display: true,
            consent_media: form.elements.consent_media.checked
          });
          if (ins.error) throw ins.error;
        }
        form.hidden = true;
        $("#entry-ref").textContent = id.slice(0, 8).toUpperCase();
        $("#entry-done-email").textContent = val("contact_email");
        $("#entry-demo-note").hidden = live;
        const done = $("#entry-done");
        done.hidden = false;
        done.scrollIntoView({ block: "start" });
      } catch (err) {
        showMsg(msg, "We could not save the entry. " + (err.message || "Please try again.") , "err");
      } finally {
        busy(btn, false);
      }
    });
  }

  /* ---------- Judge sign-up ---------- */

  const ballotUrl = () => new URL("vote.html", window.location.href).href.split("#")[0];

  function initJudges() {
    const form = $("#judge-form"), msg = $("#judge-msg");
    const chips = $("#recuse");
    C.grades.forEach((g) => chips.append(h("label", {}, [
      h("input", { type: "checkbox", name: "recused", value: g, id: "recuse-" + g }), gradeName(g)
    ])));

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      showMsg(msg, "");
      if (!form.reportValidity()) return;
      if ($("#company").value) return; // honeypot
      const btn = $("#judge-send");
      const email = form.elements.email.value.trim();
      busy(btn, true, "Sending...");
      try {
        if (live) {
          const { error } = await sb.auth.signInWithOtp({
            email,
            options: {
              emailRedirectTo: ballotUrl(),
              data: {
                name: form.elements.name.value.trim(),
                connection: form.elements.connection.value,
                recused_grades: $$("input[name='recused']:checked", form).map((c) => c.value)
              }
            }
          });
          if (error) throw error;
        }
        form.hidden = true;
        $("#judge-done-email").textContent = email;
        $("#judge-demo-note").hidden = live;
        $("#judge-done").hidden = false;
      } catch (err) {
        showMsg(msg, "We could not sign you up. " + (err.message || "Please try again."), "err");
      } finally {
        busy(btn, false);
      }
    });
  }

  /* ---------- Ballot ---------- */

  function demoBallot() {
    const ideas = [
      ["A crosswalk light kids can reach", "Transportation", "The button at the crosswalk by my school is too high for little kids. I want the city to add a lower button so we can cross safely by ourselves when we walk with our class."],
      ["Shade sails over the playground", "Parks & Community Services", "In June the slide gets too hot to use. Shade sails would keep the playground cool. They could be painted by students so every park looks different."],
      ["Storm drain art that says where the water goes", "Utilities", "Most people do not know that storm drains lead to the lake. If we paint salmon next to each drain, people will think before they dump things in the street."],
      ["A bus pass that works at the library", "Transportation", "Students already carry a bus pass. If the same card worked as a library card, more of us would use both. One card is easier to keep track of than two."],
      ["Quiet hours at the community center", "Parks & Community Services", "Some kids need a calm place after school. One room with low lights and no music for two hours a day would help a lot of students do homework."],
      ["Text alerts when a trail is flooded", "Information Technology", "Trails near the slough flood in winter and nobody knows until they get there. A sign up page for text alerts would save people a wasted trip."],
      ["Teen seats on city advisory boards", "City Manager's Office", "Decisions about parks and buses affect students for longer than anyone. Each board should have one seat for a high school student with a real vote."],
      ["More bike racks downtown", "Development Services", "New buildings downtown have lots of car parking and almost no bike racks. The city should require racks near the front door of every new building."]
    ];
    const entries = [];
    C.grades.forEach((g, gi) => {
      for (let i = 0; i < 3; i++) {
        const idea = ideas[(gi * 3 + i) % ideas.length];
        entries.push({ id: "demo-" + g + "-" + i, entry_no: 100 + gi * 3 + i, grade: g, title: idea[0], department: idea[1], essay: idea[2], art_url: null, art_caption: "" });
      }
    });
    return {
      demo: true, open: true, name: "", recused: new Set(), entries, votes: {},
      save: async () => {}
    };
  }

  async function loadBallot() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return null;
    const uid = session.user.id;
    const [settings, judge, entries, votes] = await Promise.all([
      sb.from("settings").select("voting_open").eq("id", 1).maybeSingle(),
      sb.from("judges").select("name, recused_grades").eq("id", uid).maybeSingle(),
      sb.from("ballot_entries").select("id, entry_no, grade, title, department, essay, art_path, art_caption"),
      sb.from("votes").select("grade, rank, entry_id")
    ]);
    const failed = [settings, judge, entries, votes].find((r) => r.error);
    if (failed) throw failed.error;
    if (!judge.data) throw new Error("This email is signed in but is not registered as a judge. Sign up on the judge page first.");

    const list = entries.data || [];
    const paths = list.map((x) => x.art_path).filter(Boolean);
    if (paths.length) {
      const signed = await sb.storage.from("art").createSignedUrls(paths, 4 * 60 * 60);
      const byPath = {};
      (signed.data || []).forEach((s) => { if (s.signedUrl) byPath[s.path] = s.signedUrl; });
      list.forEach((x) => { x.art_url = byPath[x.art_path] || null; });
    }
    const mine = {};
    (votes.data || []).forEach((v) => { (mine[v.grade] = mine[v.grade] || {})[v.rank] = v.entry_id; });

    return {
      demo: false,
      open: Boolean(settings.data && settings.data.voting_open),
      name: judge.data.name || "",
      recused: new Set(judge.data.recused_grades || []),
      entries: list,
      votes: mine,
      save: async (grade, rank, entryId) => {
        const q = entryId
          ? sb.from("votes").upsert({ judge_id: uid, grade, rank, entry_id: entryId }, { onConflict: "judge_id,grade,rank" })
          : sb.from("votes").delete().eq("judge_id", uid).eq("grade", grade).eq("rank", rank);
        const { error } = await q;
        if (error) throw error;
      }
    };
  }

  function renderBallot(ctx) {
    const tabs = $("#grade-tabs"), panel = $("#grade-panel"), status = $("#ballot-status"), msg = $("#ballot-msg");
    $("#ballot").hidden = false;
    if (ctx.name) $("#ballot-hello").textContent = "Signed in as " + ctx.name + ".";
    if (!ctx.open) showMsg(msg, "Voting is not open right now. You can read the entries, but picks are locked.", "");

    // Shuffle once per visit so no entry always sits at the top.
    const byGrade = {};
    C.grades.forEach((g) => { byGrade[g] = ctx.entries.filter((x) => x.grade === g).sort(() => Math.random() - 0.5); });
    let current = C.grades.find((g) => byGrade[g].length && !ctx.recused.has(g)) || C.grades[0];
    const picksFor = (g) => ctx.votes[g] || (ctx.votes[g] = {});
    const doneCount = (g) => [1, 2].filter((r) => picksFor(g)[r]).length;

    async function pick(entry, rank) {
      const p = picksFor(entry.grade), other = rank === 1 ? 2 : 1;
      const before = { 1: p[1], 2: p[2] };
      try {
        if (p[rank] === entry.id) {            // tap again to clear
          await ctx.save(entry.grade, rank, null); delete p[rank];
        } else {
          if (p[other] === entry.id) {         // moving an entry from one slot to the other
            await ctx.save(entry.grade, other, null); delete p[other];
          }
          await ctx.save(entry.grade, rank, entry.id); p[rank] = entry.id;
        }
        showMsg(msg, "");
      } catch (err) {
        ctx.votes[entry.grade] = before;
        showMsg(msg, "That pick was not saved. " + (err.message || ""), "err");
      }
      draw();
    }

    function entryCard(x) {
      const p = picksFor(x.grade);
      const rank = p[1] === x.id ? 1 : p[2] === x.id ? 2 : 0;
      const essay = h("p", { class: "essay clamp", text: x.essay });
      const more = h("button", { class: "linkbtn", type: "button", text: "Read the full essay", "aria-expanded": "false", onclick: () => {
        const open = essay.classList.toggle("clamp") === false;
        more.textContent = open ? "Show less" : "Read the full essay";
        more.setAttribute("aria-expanded", String(open));
      } });
      const art = x.art_url
        ? h("a", { href: x.art_url, target: "_blank", rel: "noopener" }, h("img", { src: x.art_url, alt: x.art_caption || "Art for entry " + x.entry_no, loading: "lazy" }))
        : h("p", { class: "sample", text: ctx.demo ? "Sample entry. Student art shows here." : "No art on file." });
      const btn = (r, label) => h("button", {
        class: "pick", type: "button", text: rank === r ? label + " (your pick)" : "Pick as " + label.toLowerCase(),
        "aria-pressed": String(rank === r), disabled: !ctx.open, onclick: () => pick(x, r)
      });
      return h("article", { class: "agenda entry" + (rank ? " picked-" + rank : "") }, [
        h("div", { class: "entry-art" }, art),
        h("div", {}, [
          h("div", { class: "agenda-head" }, [h("span", { text: "Entry No. " + x.entry_no }), h("span", { text: "For: " + x.department })]),
          h("div", { class: "agenda-body" }, [
            h("h3", { text: x.title }),
            x.art_caption ? h("p", { class: "small muted", text: "About the art: " + x.art_caption }) : null,
            essay, h("div", {}, more),
            h("div", { class: "picks" }, [btn(1, "Winner"), btn(2, "Runner-up")])
          ])
        ])
      ]);
    }

    function draw() {
      tabs.replaceChildren(...C.grades.map((g) => {
        const n = doneCount(g);
        return h("button", {
          type: "button", role: "tab", "aria-selected": String(g === current),
          title: gradeName(g) + ": " + n + " of 2 picks made", onclick: () => { current = g; draw(); }
        }, [g, h("span", { class: "dot" + (n === 2 ? " full" : n === 1 ? " half" : ""), "aria-hidden": "true" })]);
      }));
      const total = C.grades.reduce((sum, g) => sum + doneCount(g), 0);
      const open = C.grades.filter((g) => !ctx.recused.has(g) && byGrade[g].length).length * 2;
      status.textContent = total + " of " + open + " picks made. Picks save as you go.";

      const list = byGrade[current];
      const kids = [h("h2", { text: gradeName(current) })];
      if (ctx.recused.has(current)) {
        kids.push(h("p", { class: "msg", text: "You told us a family member entered in this grade, so this ballot is closed to you." }));
      } else if (!list.length) {
        kids.push(h("p", { class: "msg", text: "No entries in this grade yet." }));
      } else {
        kids.push(h("p", { class: "muted", text: list.length + " entries, shown in random order. Pick one winner and one runner-up. Names and schools are hidden." }));
        kids.push(h("div", { class: "entries" }, list.map(entryCard)));
      }
      panel.replaceChildren(...kids);
    }
    draw();
  }

  async function initVote() {
    const msg = $("#ballot-msg"), signin = $("#signin");
    if (!live) return renderBallot(demoBallot());
    try {
      const ctx = await loadBallot();
      if (ctx) {
        $("#signout").hidden = false;
        $("#signout").addEventListener("click", async () => { await sb.auth.signOut(); window.location.reload(); });
        return renderBallot(ctx);
      }
    } catch (err) {
      $("#ballot").hidden = false;
      return showMsg(msg, err.message || "The ballot could not be loaded.", "err");
    }
    signin.hidden = false;
    signin.addEventListener("submit", async (e) => {
      e.preventDefault();
      const out = $("#signin-msg"), btn = $("#signin-send");
      busy(btn, true, "Sending...");
      const { error } = await sb.auth.signInWithOtp({
        email: $("#signin-email").value.trim(),
        options: { emailRedirectTo: ballotUrl(), shouldCreateUser: false }
      });
      busy(btn, false);
      showMsg(out, error ? "No judge found with that email. Sign up on the judge page first." : "Check your email for a link to your ballot.", error ? "err" : "ok");
    });
  }

  /* ---------- Sponsors ---------- */

  function initSponsors() {
    const tiers = $("#tiers");
    C.sponsorTiers.forEach((t) => tiers.append(h("div", { class: "tier" }, [
      h("h3", { text: t.name }),
      h("p", { class: "amount", text: t.amount }),
      h("ul", {}, t.perks.map((p) => h("li", { text: p })))
    ])));
    const list = $("#sponsor-list");
    if ((C.sponsors || []).length) {
      $("#sponsor-empty").hidden = true;
      C.sponsors.forEach((s) => {
        const label = s.name + " · " + s.tier + (s.grade ? ", " + gradeName(s.grade) : "");
        list.append(h("li", {}, s.url ? h("a", { href: s.url, text: label, rel: "noopener" }) : label));
      });
    }
    const form = $("#sponsor-form"), msg = $("#sponsor-msg");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      showMsg(msg, "");
      if (!form.reportValidity()) return;
      if ($("#fax").value) return; // honeypot
      const btn = $("#sponsor-send");
      const val = (name) => form.elements[name].value.trim();
      busy(btn, true, "Sending...");
      try {
        if (live) {
          const { error } = await sb.from("sponsor_inquiries").insert({
            organization: val("organization"), contact_name: val("contact_name"),
            email: val("email"), tier: val("tier"), message: val("message")
          });
          if (error) throw error;
        }
        form.hidden = true;
        $("#sponsor-demo-note").hidden = live;
        $("#sponsor-done").hidden = false;
      } catch (err) {
        showMsg(msg, "We could not send that. " + (err.message || "Please try again."), "err");
      } finally {
        busy(btn, false);
      }
    });
  }

  chrome();
  fillLists();
  ({ submit: initSubmit, judges: initJudges, vote: initVote, sponsors: initSponsors }[page] || function () {})();
})();
