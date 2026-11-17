/* Tibet Corner — public website interactions */
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const store = window.TCStore;

  $("#year").textContent = new Date().getFullYear();

  /* ---------- Simple page-view counter (shown in the admin overview) ---------- */
  (function trackView() {
    if (window.top !== window) return; // don't count the admin preview frame
    const d = store.load();
    const day = new Date().toISOString().slice(0, 10);
    d.views = d.views || {};
    const rec = d.views[day] || { visitors: 0, views: 0 };
    rec.views += 1;
    try {
      if (sessionStorage.getItem("tc.visited") !== day) { rec.visitors += 1; sessionStorage.setItem("tc.visited", day); }
    } catch (e) { /* ignore */ }
    d.views[day] = rec;
    store.save(d);
  })();

  /* ---------- Header: sticky on scroll ---------- */
  const header = $(".site-header");
  const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 120);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---------- Mobile nav ---------- */
  const toggle = $(".nav-toggle");
  const setNav = (open) => {
    document.body.classList.toggle("nav-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  };
  toggle.addEventListener("click", () => setNav(!document.body.classList.contains("nav-open")));
  $$("#nav a").forEach((a) => a.addEventListener("click", () => setNav(false)));
  document.addEventListener("click", (e) => {
    if (document.body.classList.contains("nav-open") && !e.target.closest("#nav, .nav-toggle")) setNav(false);
  });

  /* ---------- Active link on scroll ---------- */
  const links = $$("#nav a[href^='#']:not([data-open-contact])");
  const sections = ["story", "menu", "atmosphere", "visit"].map((id) => document.getElementById(id));
  const setActive = () => {
    let current = "top";
    sections.forEach((s) => { if (s && s.getBoundingClientRect().top < window.innerHeight * 0.45) current = s.id; });
    links.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + current));
  };
  setActive();
  window.addEventListener("scroll", setActive, { passive: true });

  /* ---------- Data from admin (menu + settings) ---------- */
  const data = store.load();
  const signature = data.menu.filter((m) => m.signature).slice(0, 8);
  if (signature.length) {
    $("#dishGrid").innerHTML = signature.map((m) => `
      <article class="dish reveal">
        <img src="${esc(m.image)}" alt="${esc(m.alt || m.name)}" width="410" height="294" loading="lazy">
        <h3>${esc(m.name)}</h3>
      </article>`).join("");
  }
  if (data.settings) {
    const [addr, hours] = $$(".vi span");
    if (data.settings.address) addr.innerHTML = esc(data.settings.address).replace(/\n/g, "<br>");
    if (data.settings.hours) hours.innerHTML = "Open Daily<br>" + esc(data.settings.hours);
  }

  /* ---------- Reveal on scroll ---------- */
  const io = "IntersectionObserver" in window ? new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }) : null;
  $$(".reveal").forEach((el) => (io ? io.observe(el) : el.classList.add("in")));

  /* ---------- Modals ---------- */
  let lastFocus = null;
  const openModal = (m) => {
    lastFocus = document.activeElement;
    m.hidden = false;
    document.body.style.overflow = "hidden";
    const f = m.querySelector("input, button.tab, .modal-close");
    f && f.focus();
  };
  const closeModal = (m) => {
    m.hidden = true;
    document.body.style.overflow = "";
    lastFocus && lastFocus.focus();
  };
  $$(".modal").forEach((m) => m.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) closeModal(m); }));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { $$(".modal:not([hidden])").forEach(closeModal); setNav(false); }
  });

  const contactModal = $("#contactModal");
  $$("[data-open-contact]").forEach((b) => b.addEventListener("click", (e) => { e.preventDefault(); setNav(false); openModal(contactModal); }));

  const galleryModal = $("#galleryModal");
  $$("[data-open-gallery]").forEach((b) => b.addEventListener("click", (e) => {
    e.preventDefault();
    $("#galleryGrid").innerHTML = store.load().gallery.map((g) =>
      `<figure><img src="${esc(g.image)}" alt="${esc(g.title)}" loading="lazy"><figcaption>${esc(g.title)}</figcaption></figure>`).join("");
    openModal(galleryModal);
  }));

  /* ---------- Contact / booking form ---------- */
  const form = $("#contactForm");
  const note = $(".form-note", form);
  $$(".tab", contactModal).forEach((t) => t.addEventListener("click", () => {
    $$(".tab", contactModal).forEach((x) => { x.classList.toggle("active", x === t); x.setAttribute("aria-selected", String(x === t)); });
    form.type.value = t.dataset.tab;
    $(".booking-only", form).style.display = t.dataset.tab === "booking" ? "" : "none";
    note.textContent = "";
  }));
  form.date.min = new Date().toISOString().slice(0, 10);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(form));
    const required = ["name", "phone"].concat(f.type === "booking" ? ["date", "time"] : ["message"]);
    let ok = true;
    required.forEach((k) => {
      const bad = !String(f[k] || "").trim() || (k === "phone" && !/^[+\d][\d\s-]{6,}$/.test(f.phone));
      form[k].classList.toggle("invalid", bad);
      if (bad) ok = false;
    });
    if (!ok) { note.className = "form-note err"; note.textContent = "Please fill in the highlighted fields."; return; }

    const d = store.load();
    const entry = { id: store.uid(f.type[0]), name: f.name.trim(), phone: f.phone.trim(), message: f.message.trim(), status: "new", createdAt: new Date().toISOString() };
    if (f.type === "booking") {
      Object.assign(entry, { date: f.date, time: f.time, guests: Number(f.guests) || 1 });
      d.bookings.unshift(entry);
      store.log(d, "booking", "New Booking Received", `Table for ${entry.guests} • ${new Date(entry.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`);
    } else {
      d.enquiries.unshift(entry);
      store.log(d, "enquiry", "New Enquiry", entry.message.slice(0, 60));
    }
    store.save(d);
    form.reset();
    form.type.value = f.type;
    note.className = "form-note";
    note.textContent = f.type === "booking" ? "Thank you! Your table request has been received. We'll call to confirm." : "Thank you! We've received your message.";
  });
})();
