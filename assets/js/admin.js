/* Tibet Corner — admin dashboard */
(function () {
  const store = window.TCStore;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const icon = (id) => `<svg><use href="#i-${id}"/></svg>`;
  const view = $("#view");
  let data = store.load();
  const persist = () => { store.save(data); };

  /* ---------- Formatting helpers ---------- */
  const fmtDate = (d, opts = { day: "numeric", month: "short", year: "numeric" }) => new Date(d).toLocaleDateString("en-US", opts);
  const fmtTime = (d) => new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const ago = (iso) => {
    const s = Math.max(1, (Date.now() - new Date(iso)) / 1000);
    if (s < 60) return "just now";
    const m = s / 60, h = m / 60, d = h / 24;
    if (m < 60) return `${Math.floor(m)} min${m >= 2 ? "s" : ""} ago`;
    if (h < 24) return `${Math.floor(h)} hour${h >= 2 ? "s" : ""} ago`;
    return `${Math.floor(d)} day${d >= 2 ? "s" : ""} ago`;
  };
  const dayKey = (d) => new Date(d).toISOString().slice(0, 10);
  const lastDays = (n) => Array.from({ length: n }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (n - 1 - i)); return dayKey(d); });

  /* ---------- Toast ---------- */
  let tt;
  const toast = (msg) => { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(tt); tt = setTimeout(() => t.classList.remove("show"), 2400); };

  /* ---------- Login timestamp (shows the previous login) ---------- */
  const prevLogin = data.lastLogin;
  data.lastLogin = new Date().toISOString();
  persist();

  /* ---------- Sidebar ---------- */
  const burger = $("#burger");
  const mobile = () => matchMedia("(max-width: 900px)").matches;
  burger.addEventListener("click", () => {
    const cls = mobile() ? "side-open" : "side-collapsed";
    const on = document.body.classList.toggle(cls);
    burger.setAttribute("aria-expanded", String(mobile() ? on : !on));
  });
  $("#sideBackdrop").addEventListener("click", () => document.body.classList.remove("side-open"));
  $("#logout").addEventListener("click", () => { try { sessionStorage.clear(); } catch (e) {} });

  /* ---------- Live pill ---------- */
  const renderLive = () => {
    const p = $("#livePill");
    p.classList.toggle("off", !data.settings.live);
    $("span", p).textContent = data.settings.live ? "Website Live" : "Website Offline";
  };
  renderLive();

  /* ---------- Modal form ---------- */
  const modal = $("#modal");
  let onSave = null;
  function openForm(title, fieldsHtml, save) {
    $("#modalTitle").textContent = title;
    $("#modalBody").innerHTML = fieldsHtml;
    onSave = save;
    modal.hidden = false;
    const first = $("input, select, textarea", modal);
    first && first.focus();
  }
  const closeForm = () => { modal.hidden = true; onSave = null; };
  modal.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) closeForm(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeForm(); document.body.classList.remove("side-open"); } });
  $("#modalForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const invalid = $$("[required]", form).filter((i) => !i.value.trim());
    invalid.forEach((i) => i.style.borderColor = "#c0392b");
    if (invalid.length) { invalid[0].focus(); return; }
    const fd = Object.fromEntries(new FormData(form));
    const file = $("input[type=file]", form);
    if (file && file.files[0]) fd.imageData = await readImage(file.files[0]);
    if (onSave && onSave(fd) !== false) { persist(); closeForm(); route(); }
  });

  // Read + downscale an uploaded image so it fits in browser storage
  function readImage(file) {
    return new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => {
        const img = new Image();
        img.onload = () => {
          const max = 900, k = Math.min(1, max / Math.max(img.width, img.height));
          const c = document.createElement("canvas");
          c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL("image/jpeg", 0.8));
        };
        img.src = r.result;
      };
      r.readAsDataURL(file);
    });
  }

  /* ---------- Small chart helpers ---------- */
  function smoothPath(pts) {
    if (!pts.length) return "";
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      const cx = (x0 + x1) / 2;
      d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`;
    }
    return d;
  }
  function spark(values, color) {
    const w = 110, h = 44, max = Math.max(1, ...values), min = Math.min(...values);
    const pts = values.map((v, i) => [i * (w / (values.length - 1)), h - 4 - ((v - min) / (max - min || 1)) * (h - 10)]);
    const line = smoothPath(pts);
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
      <path d="${line} L${w},${h} L0,${h}Z" fill="${color}" opacity=".14"/>
      <path d="${line}" fill="none" stroke="${color}" stroke-width="2"/></svg>`;
  }
  const seriesFor = (list, field = "createdAt", n = 7) => {
    const days = lastDays(n);
    let running = list.filter((x) => !x[field] || x[field] < days[0]).length;
    return days.map((d) => (running += list.filter((x) => x[field] && dayKey(x[field]) === d).length));
  };
  const addedThisWeek = (list, field = "createdAt") => list.filter((x) => x[field] && Date.now() - new Date(x[field]) < 7 * 864e5).length;

  function overviewChart(range) {
    const days = lastDays(range);
    const views = data.views || {};
    const vis = days.map((d) => (views[d] || {}).visitors || 0);
    const pv = days.map((d) => (views[d] || {}).views || 0);
    const W = 520, H = 230, L = 36, R = 10, T = 10, B = 28;
    const top = Math.max(4, ...pv, ...vis);
    const nice = (() => { const p = Math.pow(10, Math.floor(Math.log10(top))); return Math.ceil(top / p) * p; })();
    const x = (i) => L + i * ((W - L - R) / (days.length - 1));
    const y = (v) => T + (H - T - B) * (1 - v / nice);
    const pVis = smoothPath(vis.map((v, i) => [x(i), y(v)]));
    const pPv = smoothPath(pv.map((v, i) => [x(i), y(v)]));
    const fmt = (n) => (n >= 1000 ? (n / 1000).toFixed(n % 1000 ? 1 : 0) + "K" : n);
    const grid = [0, 1, 2, 3].map((k) => { const v = (nice / 3) * k; return `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#efe0cf"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${fmt(Math.round(v))}</text>`; }).join("");
    const step = Math.max(1, Math.round(days.length / 5));
    const labels = days.map((d, i) => (i % step === 0 || i === days.length - 1) && (days.length - 1 - i >= step / 2 || i === days.length - 1) ? `<text x="${x(i)}" y="${H - 8}" text-anchor="${i === days.length - 1 ? "end" : i === 0 ? "start" : "middle"}">${fmtDate(d + "T12:00", { month: "short", day: "2-digit" })}</text>` : "").join("");
    const total = pv.reduce((a, b) => a + b, 0);
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Visitors and page views, last ${range} days">
      <defs><linearGradient id="gv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a33a3f" stop-opacity=".22"/><stop offset="1" stop-color="#a33a3f" stop-opacity="0"/></linearGradient></defs>
      ${grid}
      <path d="${pPv} L${x(days.length - 1)},${y(0)} L${x(0)},${y(0)}Z" fill="url(#gv)"/>
      <path d="${pVis}" fill="none" stroke="#e0b48a" stroke-width="2"/>
      <path d="${pPv}" fill="none" stroke="#7a1b22" stroke-width="2.4"/>
      <circle cx="${x(days.length - 1)}" cy="${y(pv[pv.length - 1])}" r="3.5" fill="#7a1b22"/>
      <circle cx="${x(days.length - 1)}" cy="${y(vis[vis.length - 1])}" r="3" fill="#e0b48a"/>
      ${labels}
    </svg>${total ? "" : `<p class="chart-empty">Visits to the website will appear here.</p>`}`;
  }

  /* ---------- Activity thumbnails ---------- */
  const actIcon = { booking: "cal", enquiry: "mail", menu: "fork", gallery: "image", offer: "gift", settings: "gear" };
  function activityThumb(a) {
    if (a.image) return `<img class="th" src="${esc(a.image)}" alt="">`;
    return `<span class="th">${icon(actIcon[a.type] || "history")}</span>`;
  }

  /* ======================================================
     VIEWS
     ====================================================== */
  const views = {};

  views.dashboard = () => {
    const unread = data.enquiries.filter((e) => e.status === "new").length;
    const login = prevLogin || data.lastLogin;
    view.innerHTML = `
      <section class="welcome">
        <div>
          <h2>Welcome back, Admin!</h2>
          <p>Manage your Tibet Corner website with ease.</p>
          <small>${icon("cal")} Last Login: ${fmtDate(login)} &nbsp;•&nbsp; ${fmtTime(login)}</small>
        </div>
      </section>

      <section class="stats">
        ${[
          ["fork", "Total Menu Items", data.menu.length, addedThisWeek(data.menu), seriesFor(data.menu), "#c99877", "menu"],
          ["image", "Gallery Photos", data.gallery.length, addedThisWeek(data.gallery), seriesFor(data.gallery), "#c99877", "gallery"],
          ["mail", "Enquiries", data.enquiries.length, addedThisWeek(data.enquiries), seriesFor(data.enquiries), "#c7414a", "enquiries"],
          ["cal", "Bookings", data.bookings.length, addedThisWeek(data.bookings), seriesFor(data.bookings), "#3aa461", "bookings"]
        ].map(([ic, lbl, num, delta, ser, col, link]) => `
          <a class="card stat" href="#${link}">
            <span class="ic">${icon(ic)}</span>
            <div><p class="lbl">${lbl}</p><p class="num">${num}</p><p class="delta">${icon("up")} +${delta}</p></div>
            ${spark(ser, col)}
          </a>`).join("")}
      </section>

      <section class="row-3">
        <div class="card">
          <div class="card-head"><h2>${icon("chart")} Website Overview</h2>
            <select class="select" id="range" aria-label="Date range">
              <option value="7">Last 7 Days</option><option value="30" selected>Last 30 Days</option><option value="90">Last 90 Days</option>
            </select>
          </div>
          <div class="legend"><span><i style="background:#7a1b22"></i>Visitors</span><span><i style="background:#e0b48a"></i>Page Views</span></div>
          <div id="chartBox">${overviewChart(30)}</div>
        </div>

        <div class="card">
          <div class="card-head"><h2>${icon("bolt")} Quick Actions</h2></div>
          <div class="qa-grid">
            <button class="qa" data-act="addMenu">${icon("fork")}Add Menu Item</button>
            <button class="qa" data-act="addPhoto">${icon("image")}Upload Photos</button>
            <button class="qa" data-act="addOffer">${icon("gift")}Create Offer</button>
            <a class="qa" href="#bookings">${icon("cal")}Manage Bookings</a>
            <a class="qa" href="#enquiries">${icon("mail")}View Enquiries${unread ? ` (${unread})` : ""}</a>
            <a class="qa" href="#settings">${icon("pen")}Update Content</a>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h2>${icon("history")} Recent Activity</h2><a class="link" href="#activity">View All ${icon("arrow")}</a></div>
          ${data.activity.length ? `<ul class="activity">${data.activity.slice(0, 4).map((a) => `
            <li>${activityThumb(a)}<div><b>${esc(a.title)}</b><span>${esc(a.detail)}</span><small>${ago(a.at)}</small></div></li>`).join("")}</ul>`
            : `<p class="empty">No activity yet. New bookings, enquiries and edits will show here.</p>`}
        </div>
      </section>

      <section class="row-2">
        <div class="card">
          <div class="card-head"><h2>${icon("layers")} Manage Sections</h2></div>
          <div class="sec-grid">
            ${[["hero", "Hero Section", "Update main banner", "website"], ["menu", "Our Menu", "Manage dishes", "menu"], ["atmosphere", "Our Atmosphere", "Update gallery", "gallery"], ["visit", "Visit Us", "Update details", "settings"]]
              .map(([img, t, s, link]) => `<a class="sec" href="#${link}"><img src="assets/img/admin-sec-${img}.webp" alt="" loading="lazy"><div><b>${t}</b><small>${s}</small></div><span class="go">${icon("arrow")}</span></a>`).join("")}
          </div>
        </div>
        <div class="card">
          <div class="card-head"><h2>${icon("eye")} Website Preview</h2><a class="btn" href="index.html" target="_blank" rel="noopener">Open Website ${icon("ext")}</a></div>
          <div class="preview" id="preview"><iframe src="index.html" title="Website preview" loading="lazy" tabindex="-1"></iframe></div>
        </div>
      </section>`;

    $("#range").addEventListener("change", (e) => { $("#chartBox").innerHTML = overviewChart(Number(e.target.value)); });
    $$("[data-act]").forEach((b) => b.addEventListener("click", () => actions[b.dataset.act]()));
    fitPreview();
  };

  function fitPreview() {
    const p = $("#preview");
    if (!p) return;
    const f = $("iframe", p);
    const scale = p.clientWidth / 1280;
    f.style.transform = `scale(${scale})`;
    f.style.height = p.clientHeight / scale + "px";
  }
  window.addEventListener("resize", fitPreview);

  /* ---------- Shared form pieces ---------- */
  const menuFields = (m = {}) => `
    <div class="form-grid">
      <label class="f full">Dish name<input name="name" required value="${esc(m.name)}"></label>
      <label class="f">Category<input name="category" list="cats" value="${esc(m.category || "")}"><datalist id="cats">${[...new Set(data.menu.map((x) => x.category))].map((c) => `<option value="${esc(c)}">`).join("")}</datalist></label>
      <label class="f">Price (₹)<input name="price" type="number" min="0" inputmode="numeric" value="${esc(m.price ?? "")}"></label>
      <label class="f full">Photo<input name="image" type="file" accept="image/*"></label>
      <label class="check"><input type="checkbox" name="veg" ${m.veg ? "checked" : ""}> Vegetarian</label>
      <label class="check"><input type="checkbox" name="signature" ${m.signature ? "checked" : ""}> Show in “Our Signature Dishes”</label>
    </div>`;

  const actions = {
    addMenu(edit) {
      const m = edit || {};
      openForm(edit ? "Edit Menu Item" : "Add Menu Item", menuFields(m), (fd) => {
        const item = Object.assign(m, {
          name: fd.name.trim(), category: fd.category.trim() || "Other", price: Number(fd.price) || 0,
          veg: !!fd.veg, signature: !!fd.signature, alt: fd.name.trim()
        });
        if (fd.imageData) item.image = fd.imageData;
        if (!item.image) item.image = "assets/img/dish-momos.webp";
        if (!edit) { item.id = store.uid("m"); item.createdAt = new Date().toISOString(); data.menu.push(item); }
        store.log(data, "menu", edit ? "Menu Item Updated" : "New Menu Item Added", item.name);
        data.activity[0].image = item.image.startsWith("data:") ? "" : item.image;
        toast(edit ? "Menu item updated" : "Menu item added");
      });
    },
    addPhoto() {
      openForm("Upload Photo", `<div class="form-grid"><label class="f full">Title<input name="title" required></label><label class="f full">Photo<input name="image" type="file" accept="image/*" required></label></div>
        <p class="note">Photos are resized before saving.</p>`, (fd) => {
        if (!fd.imageData) return false;
        data.gallery.unshift({ id: store.uid("g"), title: fd.title.trim(), image: fd.imageData, createdAt: new Date().toISOString() });
        store.log(data, "gallery", "Gallery Updated", fd.title.trim());
        toast("Photo uploaded");
      });
    },
    addOffer(edit) {
      const o = edit || {};
      openForm(edit ? "Edit Offer" : "Create Offer", `<div class="form-grid">
        <label class="f full">Title<input name="title" required value="${esc(o.title)}"></label>
        <label class="f">Starts<input name="start" type="date" value="${esc(o.start)}"></label>
        <label class="f">Ends<input name="end" type="date" value="${esc(o.end)}"></label>
        <label class="f full">Details<textarea name="details" rows="3">${esc(o.details)}</textarea></label></div>`, (fd) => {
        Object.assign(o, { title: fd.title.trim(), start: fd.start, end: fd.end, details: fd.details.trim() });
        if (!edit) { o.id = store.uid("o"); o.createdAt = new Date().toISOString(); data.offers.unshift(o); }
        store.log(data, "offer", edit ? "Offer Updated" : "New Offer Created", o.title);
        toast("Offer saved");
      });
    }
  };

  /* ---------- Menu ---------- */
  views.menu = () => {
    view.innerHTML = `<div class="card">
      <div class="toolbar"><input type="search" id="q" placeholder="Search dishes…" aria-label="Search dishes"><button class="btn" id="add">+ Add Menu Item</button></div>
      <div class="table-wrap"><table class="resp"><thead><tr><th></th><th>Dish</th><th>Category</th><th>Price</th><th>Signature</th><th></th></tr></thead><tbody id="rows"></tbody></table></div></div>`;
    const draw = (q = "") => {
      const list = data.menu.filter((m) => (m.name + m.category).toLowerCase().includes(q.toLowerCase()));
      $("#rows").innerHTML = list.map((m) => `<tr>
        <td class="no-l"><img class="thumb" src="${esc(m.image)}" alt=""></td>
        <td data-l="Dish"><b>${esc(m.name)}</b>${m.veg ? ' <span class="badge yes">Veg</span>' : ""}</td>
        <td data-l="Category">${esc(m.category)}</td>
        <td data-l="Price">₹${esc(m.price)}</td>
        <td data-l="Signature">${m.signature ? '<span class="badge yes">Yes</span>' : '<span class="badge">No</span>'}</td>
        <td class="no-l"><div class="acts"><button class="btn sm ghost" data-edit="${m.id}">Edit</button><button class="btn sm danger" data-del="${m.id}" aria-label="Delete ${esc(m.name)}">${icon("trash")}</button></div></td></tr>`).join("")
        || `<tr><td colspan="6" class="empty no-l">No dishes found.</td></tr>`;
    };
    draw();
    $("#q").addEventListener("input", (e) => draw(e.target.value));
    $("#add").addEventListener("click", () => actions.addMenu());
    $("#rows").addEventListener("click", (e) => {
      const ed = e.target.closest("[data-edit]"), del = e.target.closest("[data-del]");
      if (ed) actions.addMenu(data.menu.find((m) => m.id === ed.dataset.edit));
      if (del) {
        const m = data.menu.find((x) => x.id === del.dataset.del);
        if (confirm(`Delete “${m.name}” from the menu?`)) { data.menu = data.menu.filter((x) => x !== m); store.log(data, "menu", "Menu Item Removed", m.name); persist(); draw($("#q").value); toast("Deleted"); }
      }
    });
  };

  /* ---------- Gallery ---------- */
  views.gallery = () => {
    view.innerHTML = `<div class="card"><div class="toolbar"><p class="note">These photos appear when visitors tap “Experience the Vibe”.</p><button class="btn" id="add">+ Upload Photo</button></div>
      <div class="gal-grid">${data.gallery.map((g) => `<figure class="gal"><img src="${esc(g.image)}" alt="${esc(g.title)}" loading="lazy"><figcaption><span>${esc(g.title)}</span><button data-del="${g.id}" aria-label="Delete ${esc(g.title)}">${icon("trash")}</button></figcaption></figure>`).join("") || '<p class="empty">No photos yet.</p>'}</div></div>`;
    $("#add").addEventListener("click", actions.addPhoto);
    $$("[data-del]").forEach((b) => b.addEventListener("click", () => {
      if (!confirm("Delete this photo?")) return;
      data.gallery = data.gallery.filter((g) => g.id !== b.dataset.del); persist(); route(); toast("Photo deleted");
    }));
  };

  /* ---------- Offers ---------- */
  views.offers = () => {
    view.innerHTML = `<div class="card"><div class="toolbar"><p class="note">Plan events and special offers.</p><button class="btn" id="add">+ Create Offer</button></div>
      <div class="table-wrap"><table class="resp"><thead><tr><th>Offer</th><th>Starts</th><th>Ends</th><th>Details</th><th></th></tr></thead><tbody>
      ${data.offers.map((o) => `<tr><td data-l="Offer"><b>${esc(o.title)}</b></td><td data-l="Starts">${o.start ? fmtDate(o.start) : "—"}</td><td data-l="Ends">${o.end ? fmtDate(o.end) : "—"}</td><td data-l="Details">${esc(o.details) || "—"}</td>
        <td class="no-l"><div class="acts"><button class="btn sm ghost" data-edit="${o.id}">Edit</button><button class="btn sm danger" data-del="${o.id}" aria-label="Delete">${icon("trash")}</button></div></td></tr>`).join("")
        || '<tr><td colspan="5" class="empty no-l">No offers yet — create your first one.</td></tr>'}</tbody></table></div></div>`;
    $("#add").addEventListener("click", () => actions.addOffer());
    $$("[data-edit]").forEach((b) => b.addEventListener("click", () => actions.addOffer(data.offers.find((o) => o.id === b.dataset.edit))));
    $$("[data-del]").forEach((b) => b.addEventListener("click", () => {
      if (!confirm("Delete this offer?")) return;
      data.offers = data.offers.filter((o) => o.id !== b.dataset.del); persist(); route();
    }));
  };

  /* ---------- Bookings & enquiries ---------- */
  const statusSelect = (id, cur, opts) => `<select data-status="${id}" aria-label="Status">${opts.map((o) => `<option ${o === cur ? "selected" : ""}>${o}</option>`).join("")}</select>`;

  views.bookings = () => {
    const list = [...data.bookings].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    view.innerHTML = `<div class="card"><div class="toolbar"><p class="note">Table requests from the website’s Contact Us form.</p></div>
      <div class="table-wrap"><table class="resp"><thead><tr><th>Guest</th><th>Phone</th><th>Date</th><th>Time</th><th>Guests</th><th>Note</th><th>Status</th></tr></thead><tbody>
      ${list.map((b) => `<tr><td data-l="Guest"><b>${esc(b.name)}</b></td><td data-l="Phone"><a href="tel:${esc(b.phone)}">${esc(b.phone)}</a></td><td data-l="Date">${fmtDate(b.date + "T12:00")}</td><td data-l="Time">${esc(b.time)}</td><td data-l="Guests">${esc(b.guests)}</td><td data-l="Note">${esc(b.message) || "—"}</td>
        <td data-l="Status">${statusSelect(b.id, b.status, ["new", "confirmed", "cancelled"])}</td></tr>`).join("")
        || '<tr><td colspan="7" class="empty no-l">No bookings yet.</td></tr>'}</tbody></table></div></div>`;
    $$("[data-status]").forEach((s) => s.addEventListener("change", () => {
      data.bookings.find((b) => b.id === s.dataset.status).status = s.value; persist(); toast("Booking " + s.value);
    }));
  };

  views.enquiries = () => {
    view.innerHTML = `<div class="card"><div class="toolbar"><p class="note">Messages sent from the website.</p></div>
      <div class="table-wrap"><table class="resp"><thead><tr><th>From</th><th>Phone</th><th>Message</th><th>Received</th><th>Status</th></tr></thead><tbody>
      ${data.enquiries.map((q) => `<tr><td data-l="From"><b>${esc(q.name)}</b></td><td data-l="Phone"><a href="tel:${esc(q.phone)}">${esc(q.phone)}</a></td><td data-l="Message">${esc(q.message)}</td><td data-l="Received">${ago(q.createdAt)}</td>
        <td data-l="Status">${statusSelect(q.id, q.status, ["new", "replied"])}</td></tr>`).join("")
        || '<tr><td colspan="5" class="empty no-l">No enquiries yet.</td></tr>'}</tbody></table></div></div>`;
    $$("[data-status]").forEach((s) => s.addEventListener("change", () => {
      data.enquiries.find((q) => q.id === s.dataset.status).status = s.value; persist(); toast("Marked " + s.value);
    }));
  };

  /* ---------- Activity (full list) ---------- */
  views.activity = () => {
    view.innerHTML = `<div class="card">${data.activity.length ? `<ul class="activity">${data.activity.map((a) => `<li>${activityThumb(a)}<div><b>${esc(a.title)}</b><span>${esc(a.detail)}</span><small>${ago(a.at)}</small></div></li>`).join("")}</ul>` : '<p class="empty">No activity yet.</p>'}</div>`;
  };

  /* ---------- Settings (Visit Us details) ---------- */
  views.settings = () => {
    const s = data.settings;
    view.innerHTML = `<form class="card" id="setForm"><div class="card-head"><h2>${icon("pen")} Visit Us details</h2></div>
      <div class="form-grid">
        <label class="f full">Address<textarea name="address" rows="2">${esc(s.address)}</textarea></label>
        <label class="f">Opening hours<input name="hours" value="${esc(s.hours)}"></label>
        <label class="f">Phone<input name="phone" type="tel" value="${esc(s.phone)}"></label>
      </div>
      <div class="modal-actions"><button class="btn">Save changes</button></div></form>`;
    $("#setForm").addEventListener("submit", (e) => {
      e.preventDefault();
      Object.assign(data.settings, Object.fromEntries(new FormData(e.target)));
      store.log(data, "settings", "Content Updated", "Visit Us details"); persist(); toast("Saved — the website is updated");
    });
  };

  /* ---------- Website settings ---------- */
  views.website = () => {
    view.innerHTML = `<div class="card"><div class="card-head"><h2>${icon("globe")} Website Settings</h2></div>
      <label class="check"><input type="checkbox" id="live" ${data.settings.live ? "checked" : ""}> Website is live</label>
      <p class="note">Data is stored in this browser. Connect a backend to share it across devices.</p>
      <div class="modal-actions" style="justify-content:flex-start">
        <button class="btn ghost" id="export">Export data (JSON)</button>
        <button class="btn danger" id="reset">Reset to defaults</button>
      </div></div>`;
    $("#live").addEventListener("change", (e) => { data.settings.live = e.target.checked; persist(); renderLive(); toast(e.target.checked ? "Website marked live" : "Website marked offline"); });
    $("#export").addEventListener("click", () => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      a.download = "tibet-corner-data.json"; a.click(); URL.revokeObjectURL(a.href);
    });
    $("#reset").addEventListener("click", () => {
      if (!confirm("Reset all menu items, photos, bookings and enquiries to defaults? This cannot be undone.")) return;
      data = structuredClone(store.defaults); data.lastLogin = new Date().toISOString(); persist(); renderLive(); toast("Reset complete");
    });
  };

  /* ---------- Router ---------- */
  const titles = { dashboard: "Dashboard", menu: "Menu Management", gallery: "Gallery", offers: "Events & Offers", bookings: "Bookings", enquiries: "Contact Enquiries", settings: "Settings", website: "Website Settings", activity: "Recent Activity" };
  function route() {
    data = store.load();
    const key = (location.hash.slice(1) || "dashboard");
    const name = views[key] ? key : "dashboard";
    $("#pageTitle").textContent = titles[name];
    document.title = `${titles[name]} | Tibet Corner Admin`;
    $$(".side-nav a[data-view]").forEach((a) => a.classList.toggle("active", a.dataset.view === name));
    views[name]();
    document.body.classList.remove("side-open");
  }
  window.addEventListener("hashchange", () => { route(); view.focus({ preventScroll: true }); window.scrollTo(0, 0); });
  // refresh when the website (another tab) adds a booking / enquiry
  window.addEventListener("storage", (e) => { if (e.key === store.KEY && modal.hidden) route(); });
  route();
})();
