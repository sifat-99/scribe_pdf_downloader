# ScribeFlow | Premium Scribd PDF Downloader & E-Reader

ScribeFlow is a premium, 100% client-side web application designed to download, compile, and read PDF books directly in your browser. Paste or drag-and-drop the source code of an embedded Scribd viewer, and the application will concurrently download the pages directly from the Scribd assets CDN, compile them into a high-quality PDF using `jsPDF`, save them in your local browser library (`IndexedDB`), and let you read them in an interactive glassmorphic PDF reader powered by `PDF.js`.

Since it runs entirely in the browser, it has zero serverless execution timeouts, zero backend dependencies, and can be hosted completely free on static hosting platforms like Vercel, GitHub Pages, or Netlify.

---

## 🚀 Features

- **Direct CDN Asset Fetching:** Direct downloads of page background images and JSONP configurations from Scribd's CDN bypassing CORS restrictions natively.
- **Concurrent Download Pipeline:** Leverages standard Javascript browser concurrency to fetch up to 20 pages simultaneously for rapid compilation.
- **Client-Side PDF Assembly:** Constructs standard multi-page PDF documents entirely in-memory using `jsPDF`.
- **Offline Library (IndexedDB):** Locally persists compiled books in your browser storage so you can access them anytime without re-downloading.
- **Interactive E-Book Reader:** Full-featured reader with zoom (in, out, fit to width), fullscreen mode, keyboard navigation support (arrow keys, page up/down), and a clean glassmorphic sidebar.
- **Local File Support:** Open any PDF from your local device directly in the reader interface.

---

## 🛠️ Tech Stack

- **HTML5:** Semantic architecture with support for upload drag-and-drop zones and SVG rings.
- **CSS3:** Sleek animated dark mode styling with premium glassmorphism overlays and responsive layouts.
- **JavaScript (ES6+):** Pure vanilla JavaScript driving concurrent network pipelines, IndexedDB CRUD operations, and canvas rendering.
- **jsPDF (v2.5.1):** Programmatic PDF building and layout.
- **PDF.js (v3.4.120):** High-performance rendering of standard PDF documents on standard HTML5 canvas.

---

## 💻 Local Quickstart

No dependencies, build steps, or Python virtual environments are required.

1. Start a simple static web server in the directory:
   ```bash
   # Using Python 3
   python3 -m http.server 5000
   
   # Or using Node.js/npx
   npx http-server -p 5000
   ```
2. Open **[http://127.0.0.1:5000](http://127.0.0.1:5000)** in your web browser.

---

## ☁️ Vercel Deployment

Deploy directly from your terminal using Vercel CLI:
```bash
vercel
```
Since it is a purely static site, Vercel will automatically serve it as a Static Project with zero configuration required.
