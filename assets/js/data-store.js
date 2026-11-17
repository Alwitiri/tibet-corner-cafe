/* Tibet Corner — tiny data store shared by the website and the admin dashboard.
   Data lives in the browser's localStorage. Swap these functions for API calls
   (e.g. Supabase / Firebase / your own backend) to make it multi-device. */
(function () {
  const KEY = "tibetCorner.v1";

  const defaults = {
    menu: [
      { id: "m1", name: "Momos", category: "Momos", price: 120, veg: false, signature: true, image: "assets/img/dish-momos.webp", alt: "Plate of steamed momos with red chutney" },
      { id: "m2", name: "Thukpa", category: "Soups", price: 150, veg: false, signature: true, image: "assets/img/dish-thukpa.webp", alt: "Steaming bowl of thukpa noodle soup" },
      { id: "m3", name: "Tibetan Noodles", category: "Noodles", price: 140, veg: false, signature: true, image: "assets/img/dish-tibetan-noodles.webp", alt: "Bowl of stir-fried Tibetan noodles" },
      { id: "m4", name: "Vegetable Thukpa", category: "Soups", price: 130, veg: true, signature: true, image: "assets/img/dish-veg-thukpa.webp", alt: "Vegetable thukpa with dumplings and greens" },
      { id: "m5", name: "Chicken Momos", category: "Momos", price: 140, veg: false, signature: false, image: "assets/img/dish-momos.webp", alt: "Chicken momos" }
    ],
    gallery: [
      { id: "g1", title: "Restaurant Interior", image: "assets/img/atmosphere.webp" },
      { id: "g2", title: "Our Story", image: "assets/img/story.webp" },
      { id: "g3", title: "Momos", image: "assets/img/dish-momos.webp" },
      { id: "g4", title: "Thukpa", image: "assets/img/dish-thukpa.webp" },
      { id: "g5", title: "Tibetan Noodles", image: "assets/img/dish-tibetan-noodles.webp" },
      { id: "g6", title: "Vegetable Thukpa", image: "assets/img/dish-veg-thukpa.webp" }
    ],
    offers: [],
    bookings: [],
    enquiries: [],
    activity: [],
    settings: { address: "Tibet Corner,\nOoty, Tamil Nadu – 643001", hours: "8:00 AM – 10:00 PM", phone: "", live: true },
    lastLogin: null
  };

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return structuredClone(defaults);
      return Object.assign(structuredClone(defaults), JSON.parse(raw));
    } catch (e) {
      return structuredClone(defaults);
    }
  }

  function save(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* storage full / blocked */ }
  }

  function uid(prefix) { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function log(data, type, title, detail) {
    data.activity.unshift({ id: uid("a"), type, title, detail, at: new Date().toISOString() });
    data.activity = data.activity.slice(0, 50);
  }

  window.TCStore = { KEY, defaults, load, save, uid, log };
})();
