# ScribeFlow

ScribeFlow is a premium, stateless web application designed to download and compile PDF books directly from embedded online document viewers. It features a responsive glassmorphic dark theme, real-time download pipelines, and a client-side interactive e-reader powered by PDF.js.

Designed with serverless architecture in mind, ScribeFlow compiles PDFs entirely in-memory—making it fully compatible with read-only filesystems on cloud hosting providers like Vercel.

## 🚀 Features

- **Concurrent Downloader Pipeline:** Concurrently resolves and downloads page background assets using a Python thread pool.
- **In-Memory Compilation:** Compiles files directly into a memory buffer (`BytesIO`), using zero persistent server storage.
- **Custom E-Book Reader:** Interactive viewer featuring full-screen, dual-page mode, fit-to-width, zoom controls, and page-turning keyboard binds.
- **Offline / Local Reading:** Load any compiled PDF from your device directly into the reader client-side.
- **Serverless Ready:** Pre-configured with routing and entry points for Vercel deployment.

## 🛠️ Tech Stack

- **Backend:** Python, Flask, Pillow (PIL)
- **Frontend:** Vanilla HTML5, CSS3 (Glassmorphism), JavaScript (ES6), PDF.js

## 💻 Local Quickstart

1. Create a virtual environment and install dependencies:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```
2. Run the application:
   ```bash
   python3 app.py
   ```
3. Open **[http://127.0.0.1:5000](http://127.0.0.1:5000)** in your browser.

## ☁️ Vercel Deployment

Deploy directly from your terminal using Vercel CLI:
```bash
vercel
```
Or connect your GitHub repository directly to Vercel for automatic continuous deployments!
