# Tibet Corner Ooty — website

Static website + admin dashboard, built from the two design mockups in `reference/`.

| Page | What it is |
|---|---|
| `index.html` | Public website (Home, Our Story, Signature Dishes, Atmosphere, Visit Us, footer). Fully responsive with a slide-in mobile menu. "Contact Us" opens a Book-a-Table / Enquiry form. |
| `admin.html` | Admin dashboard: stats, visits chart, quick actions, recent activity, menu / gallery / offers / bookings / enquiries management, Visit Us details, website settings. |

## Run locally
```
python -m http.server 5173
```
Then open http://localhost:5173 and http://localhost:5173/admin.html

## Deploy
Upload the whole folder to any static host (Netlify, Vercel, GitHub Pages, cPanel).
`reference/` and `work/` are not needed on the server.

## Important: data storage
Menu edits, photos, bookings and enquiries are saved in the **browser's localStorage**
(`assets/js/store.js`). That means bookings made on a customer's phone will NOT reach the
owner's admin page, and the admin page has no password. Before going live, replace the
functions in `store.js` with a real backend (e.g. Supabase or Firebase) and add a login.

## Images
`assets/img/` was cut from the mockups by `work/extract.py` (text removed with inpainting).
They're upscaled from the mockup, so swap in the original high-resolution photos when you have them
(keep the same file names).
