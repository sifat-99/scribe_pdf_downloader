// ScribeFlow Client-Side Application Logic (100% Client-Side Static Downloader & Viewer)

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const tabDownloader = document.getElementById('tab-downloader');
    const tabLibrary = document.getElementById('tab-library');
    const panelDownloader = document.getElementById('panel-downloader');
    const panelLibrary = document.getElementById('panel-library');
    
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const sourceTextarea = document.getElementById('source-textarea');
    const btnCompile = document.getElementById('btn-compile');
    
    const progressCircle = document.getElementById('progress-circle');
    const percentageLabel = document.getElementById('percentage-label');
    const pagesLabel = document.getElementById('pages-label');
    const statusBadge = document.getElementById('status-badge');
    const statusMessage = document.getElementById('status-message');
    const btnDownloadPdf = document.getElementById('btn-download-pdf');
    
    const bookList = document.getElementById('book-list');
    const readerViewArea = document.getElementById('reader-view-area');
    const readerPlaceholder = document.getElementById('reader-placeholder');
    const pageNumInput = document.getElementById('page-num-input');
    const totalPagesSpan = document.getElementById('total-pages');
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    const btnZoomIn = document.getElementById('btn-zoom-in');
    const btnZoomOut = document.getElementById('btn-zoom-out');
    const btnFitWidth = document.getElementById('btn-fit-width');
    const zoomPercentSpan = document.getElementById('zoom-percent');
    const btnFullscreen = document.getElementById('btn-fullscreen');
    const pdfCanvas = document.getElementById('pdf-canvas');
    const canvasContext = pdfCanvas.getContext('2d');

    // --- State variables ---
    let activeFileContent = '';
    const circleCircumference = 2 * Math.PI * 76; // 477.52
    
    // E-Reader state
    let pdfDoc = null;
    let currentPageNum = 1;
    let currentScale = 1.0;
    let currentBookFilename = '';
    let currentBlobUrl = null;

    // --- IndexedDB Local Storage Helper ---
    const dbName = 'ScribeFlowDB';
    const storeName = 'books';

    function openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(dbName, 1);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                db.createObjectStore(storeName, { keyPath: 'filename' });
            };
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async function saveBook(filename, blob) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            store.put({
                filename: filename,
                blob: blob,
                size_mb: (blob.size / (1024 * 1024)).toFixed(2),
                created_at: Date.now()
            });
            transaction.oncomplete = () => resolve();
            transaction.onerror = (e) => reject(e.target.error);
        });
    }

    async function getBooks() {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async function deleteBookFromDB(filename) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            store.delete(filename);
            transaction.oncomplete = () => resolve();
            transaction.onerror = (e) => reject(e.target.error);
        });
    }

    // --- Tab Switching ---
    tabDownloader.addEventListener('click', () => switchTab('downloader'));
    tabLibrary.addEventListener('click', () => switchTab('library'));

    function switchTab(tabName) {
        if (tabName === 'downloader') {
            tabDownloader.classList.add('active');
            tabLibrary.classList.remove('active');
            tabDownloader.setAttribute('aria-selected', 'true');
            tabLibrary.setAttribute('aria-selected', 'false');
            panelDownloader.classList.add('active');
            panelLibrary.classList.remove('active');
        } else {
            tabDownloader.classList.remove('active');
            tabLibrary.classList.add('active');
            tabDownloader.setAttribute('aria-selected', 'false');
            tabLibrary.setAttribute('aria-selected', 'true');
            panelDownloader.classList.remove('active');
            panelLibrary.classList.add('active');
            loadLibrary();
        }
    }

    // --- Drag and Drop File Handlers ---
    dropZone.addEventListener('click', () => fileInput.click());
    
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleFile(file);
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    });

    function handleFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            activeFileContent = e.target.result;
            sourceTextarea.value = ''; // Clear textarea to prioritize file
            dropZone.querySelector('p').innerHTML = `Selected file: <strong>${file.name}</strong> (${(file.size / 1024).toFixed(1)} KB)`;
            dropZone.querySelector('i').className = 'fa-solid fa-file-circle-check upload-icon';
        };
        reader.readAsText(file);
    }

    // --- Progress Bar Utility ---
    function setProgress(percent) {
        const offset = circleCircumference - (percent / 100 * circleCircumference);
        progressCircle.style.strokeDashoffset = offset;
        percentageLabel.textContent = `${Math.round(percent)}%`;
    }

    function updateStatusBadge(status) {
        statusBadge.className = 'status-badge';
        statusBadge.classList.add(`status-${status}`);
        statusBadge.textContent = status;
    }

    function showFailure(message) {
        updateStatusBadge('failed');
        statusMessage.textContent = message;
        btnCompile.disabled = false;
    }

    // --- Utility: Blob to Data URL ---
    function blobToDataURL(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
        });
    }

    // --- Clean Filenames ---
    function cleanFilename(title) {
        let cleaned = title.replace(/[\\/*?:"<>|]/g, '');
        cleaned = cleaned.replace(/\s+/g, '_');
        return cleaned.substring(0, 100);
    }

    function extractTitle(sourceCode) {
        let match = sourceCode.match(/<meta property="og:title"\s+content="([^"]+)"/);
        if (!match) match = sourceCode.match(/content="([^"]+)"\s+property="og:title"/);
        if (!match) match = sourceCode.match(/<title>([^<]+)<\/title>/);
        if (match) {
            let title = match[1].trim();
            title = title.replace(/\s*\|\s*Scribd\s*$/i, '');
            return cleanFilename(title);
        }
        return "document";
    }

    // --- Client-Side Parsing, Downloading, and jsPDF Compilation ---
    btnCompile.addEventListener('click', async () => {
        const sourceCode = activeFileContent || sourceTextarea.value.trim();
        
        if (!sourceCode) {
            alert('Please upload a page source text file or paste the raw HTML source code first.');
            return;
        }

        // Reset progress UI
        setProgress(0);
        pagesLabel.textContent = 'Parsing...';
        updateStatusBadge('parsing');
        statusMessage.textContent = 'Analyzing source code and extracting page links...';
        btnDownloadPdf.style.display = 'none';
        btnCompile.disabled = true;

        try {
            // Step 1: Extract JSONP URLs
            const jsonpUrls = [];
            const matches = sourceCode.matchAll(/contentUrl:\s*"([^"]+)"/g);
            for (const match of matches) {
                jsonpUrls.push(match[1]);
            }
            
            // Fallback match
            if (jsonpUrls.length === 0) {
                const fallbackMatches = sourceCode.matchAll(/https?:\/\/html\.scribdassets\.com\/[^\/]+\/pages\/\d+-[a-f0-9]+\.jsonp/g);
                for (const match of fallbackMatches) {
                    jsonpUrls.push(match[0]);
                }
            }

            const uniqueUrls = [...new Set(jsonpUrls)];
            
            function getPageNum(url) {
                const match = url.match(/\/pages\/(\d+)-/);
                return match ? parseInt(match[1]) : 999999;
            }

            uniqueUrls.sort((a, b) => getPageNum(a) - getPageNum(b));

            if (uniqueUrls.length === 0) {
                throw new Error("No page links found in the provided source code.");
            }

            const totalPages = uniqueUrls.length;
            pagesLabel.textContent = `0 / ${totalPages} pages`;
            updateStatusBadge('downloading');
            statusMessage.textContent = `Downloading ${totalPages} pages concurrently in the browser...`;

            // Step 2: Download pages concurrently using a queue
            const results = {};
            const queue = uniqueUrls.map(url => ({ pageNum: getPageNum(url), jsonpUrl: url }));
            const maxConcurrency = 20;
            let downloadedCount = 0;

            async function worker() {
                while (queue.length > 0) {
                    const task = queue.shift();
                    if (!task) break;
                    const { pageNum, jsonpUrl } = task;

                    // Retry logic for each page
                    let success = false;
                    for (let attempt = 0; attempt < 3; attempt++) {
                        try {
                            const res = await fetch(jsonpUrl);
                            if (!res.ok) throw new Error(`HTTP ${res.status}`);
                            const text = await res.text();

                            const callbackMatch = text.match(/window\.page\d+_callback\(\[(.*)\]\)/s);
                            if (!callbackMatch) throw new Error("Callback pattern mismatch");

                            const jsonStr = `[${callbackMatch[1]}]`;
                            const arr = JSON.parse(jsonStr);
                            const html = arr[0];

                            // Extract the background image orig URL
                             const imgMatch = html.match(/<img[^>]+orig="([^"]+)"/) || html.match(/orig="(https?:\/\/[^"]+)"/);
                             if (!imgMatch) throw new Error("Image target url missing");
                             
                             const origUrl = imgMatch[1];
                             const imgUrl = origUrl.replace("http://html.scribd.com", "https://html.scribdassets.com");

                            // Extract page dimensions
                            let width = 902;
                            let height = 1276;
                            const widthMatch = html.match(/width:\s*(\d+)px/);
                            const heightMatch = html.match(/height:\s*(\d+)px/);
                            if (widthMatch) width = parseInt(widthMatch[1]);
                            if (heightMatch) height = parseInt(heightMatch[1]);

                            // Download the image
                            const imgRes = await fetch(imgUrl);
                            if (!imgRes.ok) throw new Error(`Image HTTP ${imgRes.status}`);
                            const blob = await imgRes.blob();
                            const dataUrl = await blobToDataURL(blob);

                            results[pageNum] = { dataUrl, width, height };
                            success = true;
                            break;
                        } catch (err) {
                            console.warn(`Retry ${attempt + 1} for page ${pageNum} failed:`, err);
                        }
                    }

                    if (!success) {
                        throw new Error(`Failed to load page ${pageNum} after multiple attempts.`);
                    }

                    downloadedCount++;
                    const percent = (downloadedCount / totalPages) * 100;
                    setProgress(percent);
                    pagesLabel.textContent = `${downloadedCount} / ${totalPages} pages`;
                }
            }

            // Fire up workers
            const workers = Array(Math.min(maxConcurrency, totalPages)).fill(null).map(() => worker());
            await Promise.all(workers);

            // Step 3: Compile PDF using jsPDF client-side
            updateStatusBadge('compiling');
            statusMessage.textContent = 'Compiling PDF book in-memory...';
            await new Promise(resolve => setTimeout(resolve, 200)); // Yield to paint DOM

            const sortedPageNums = Object.keys(results).map(Number).sort((a, b) => a - b);
            const firstPage = results[sortedPageNums[0]];
            
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'px',
                format: [firstPage.width, firstPage.height]
            });
            doc.addImage(firstPage.dataUrl, 'JPEG', 0, 0, firstPage.width, firstPage.height);

            for (let i = 1; i < sortedPageNums.length; i++) {
                const page = results[sortedPageNums[i]];
                doc.addPage([page.width, page.height], 'portrait');
                doc.addImage(page.dataUrl, 'JPEG', 0, 0, page.width, page.height);
            }

            // Generate output blob
            const pdfBlob = doc.output('blob');
            const pdfFilename = `${extractTitle(sourceCode)}.pdf`;
            const downloadUrl = window.URL.createObjectURL(pdfBlob);

            // Save PDF to IndexedDB local storage
            try {
                await saveBook(pdfFilename, pdfBlob);
            } catch (dbErr) {
                console.error("Failed to save book to local browser database:", dbErr);
            }

            // Trigger download
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = pdfFilename;
            document.body.appendChild(a);
            a.click();
            a.remove();

            // Set completed state
            setProgress(100);
            updateStatusBadge('completed');
            statusMessage.textContent = 'Document compiled, saved to local library, and downloaded!';
            
            btnDownloadPdf.style.display = 'flex';
            btnDownloadPdf.onclick = () => {
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = pdfFilename;
                document.body.appendChild(a);
                a.click();
                a.remove();
            };

            btnCompile.disabled = false;

        } catch (err) {
            showFailure(err.message || "Failed during PDF generation.");
            console.error(err);
        }
    });

    // --- Library Management (IndexedDB) ---
    async function loadLibrary() {
        bookList.innerHTML = '<div class="reader-placeholder"><i class="fa-solid fa-spinner fa-spin book-icon"></i><p style="font-size:12px;">Reading browser storage...</p></div>';
        
        try {
            const books = await getBooks();
            bookList.innerHTML = '';
            
            if (books.length === 0) {
                bookList.innerHTML = '<div class="reader-placeholder"><i class="fa-solid fa-box-open book-icon"></i><p style="font-size:12px;text-align:center;">No compiled books found locally.<br>Go to Downloader tab to build a book!</p></div>';
                return;
            }

            // Sort books (newest first)
            books.sort((a, b) => b.created_at - a.created_at);

            books.forEach(book => {
                const item = document.createElement('div');
                item.className = 'book-item';
                if (book.filename === currentBookFilename) {
                    item.classList.add('active');
                }
                
                item.innerHTML = `
                    <i class="fa-solid fa-file-pdf book-icon"></i>
                    <div class="book-info">
                        <div class="book-title" title="${book.filename}">${book.filename.replace('.pdf', '').replace(/_/g, ' ')}</div>
                        <div class="book-meta">${book.size_mb} MB &bull; ${new Date(book.created_at).toLocaleDateString()}</div>
                    </div>
                    <i class="fa-solid fa-trash book-delete-btn" title="Delete Book" style="color: var(--accent); padding: 8px; cursor: pointer; transition: var(--transition-smooth); margin-left: auto;"></i>
                `;
                
                // Open book on click (ignoring delete button clicks)
                item.addEventListener('click', (e) => {
                    if (e.target.classList.contains('book-delete-btn')) return;
                    document.querySelectorAll('.book-item').forEach(el => el.classList.remove('active'));
                    item.classList.add('active');
                    openBookFromBlob(book.filename, book.blob);
                });

                // Delete book handler
                item.querySelector('.book-delete-btn').addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (confirm(`Are you sure you want to delete "${book.filename.replace('.pdf', '').replace(/_/g, ' ')}" from browser storage?`)) {
                        try {
                            await deleteBookFromDB(book.filename);
                            if (currentBookFilename === book.filename) {
                                closeReader();
                            }
                            loadLibrary();
                        } catch (err) {
                            alert("Failed to delete book: " + err.message);
                        }
                    }
                });
                
                bookList.appendChild(item);
            });
        } catch (err) {
            bookList.innerHTML = '<div class="reader-placeholder"><i class="fa-solid fa-circle-exclamation book-icon"></i><p style="font-size:12px;">Failed to load local database.</p></div>';
            console.error(err);
        }
    }

    // --- Interactive E-Reader Implementation (PDF.js) ---
    function closeReader() {
        pdfDoc = null;
        currentBookFilename = '';
        if (currentBlobUrl) {
            window.URL.revokeObjectURL(currentBlobUrl);
            currentBlobUrl = null;
        }
        readerViewArea.style.display = 'none';
        readerPlaceholder.style.display = 'flex';
    }

    function openBookFromBlob(filename, blob) {
        currentBookFilename = filename;
        readerPlaceholder.style.display = 'none';
        readerViewArea.style.display = 'block';
        
        canvasContext.clearRect(0, 0, pdfCanvas.width, pdfCanvas.height);
        
        if (currentBlobUrl) {
            window.URL.revokeObjectURL(currentBlobUrl);
        }
        currentBlobUrl = window.URL.createObjectURL(blob);
        
        pdfjsLib.getDocument(currentBlobUrl).promise.then(pdf => {
            pdfDoc = pdf;
            currentPageNum = 1;
            totalPagesSpan.textContent = pdf.numPages;
            pageNumInput.max = pdf.numPages;
            fitToWidth();
        }).catch(err => {
            alert('Error loading PDF document.');
            console.error(err);
        });
    }

    function renderPage(num) {
        if (!pdfDoc) return;
        
        pdfDoc.getPage(num).then(page => {
            const viewport = page.getViewport({ scale: currentScale });
            
            const dpr = window.devicePixelRatio || 1;
            pdfCanvas.width = viewport.width * dpr;
            pdfCanvas.height = viewport.height * dpr;
            pdfCanvas.style.width = `${viewport.width}px`;
            pdfCanvas.style.height = `${viewport.height}px`;
            
            canvasContext.setTransform(dpr, 0, 0, dpr, 0, 0);
            
            const renderContext = {
                canvasContext: canvasContext,
                viewport: viewport
            };
            
            page.render(renderContext);
            pageNumInput.value = num;
            zoomPercentSpan.textContent = `${Math.round(currentScale * 100)}%`;
        });
    }

    // Navigation triggers
    btnPrev.addEventListener('click', () => {
        if (currentPageNum <= 1) return;
        currentPageNum--;
        renderPage(currentPageNum);
    });

    btnNext.addEventListener('click', () => {
        if (currentPageNum >= pdfDoc.numPages) return;
        currentPageNum++;
        renderPage(currentPageNum);
    });

    pageNumInput.addEventListener('change', (e) => {
        let value = parseInt(e.target.value);
        if (isNaN(value)) return;
        
        if (value < 1) value = 1;
        if (value > pdfDoc.numPages) value = pdfDoc.numPages;
        
        currentPageNum = value;
        renderPage(currentPageNum);
    });

    // Zoom triggers
    btnZoomIn.addEventListener('click', () => {
        if (currentScale >= 3.0) return;
        currentScale += 0.1;
        renderPage(currentPageNum);
    });

    btnZoomOut.addEventListener('click', () => {
        if (currentScale <= 0.4) return;
        currentScale -= 0.1;
        renderPage(currentPageNum);
    });

    btnFitWidth.addEventListener('click', fitToWidth);

    function fitToWidth() {
        if (!pdfDoc) return;
        pdfDoc.getPage(currentPageNum).then(page => {
            const viewport = page.getViewport({ scale: 1.0 });
            const containerWidth = document.querySelector('.pdf-display-container').clientWidth - 40;
            currentScale = containerWidth / viewport.width;
            renderPage(currentPageNum);
        });
    }

    // Fullscreen trigger
    btnFullscreen.addEventListener('click', () => {
        const container = document.querySelector('.pdf-display-container');
        if (!document.fullscreenElement) {
            container.requestFullscreen().catch(err => {
                alert(`Error enabling full-screen: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    });

    // Keyboard bindings for reader
    document.addEventListener('keydown', (e) => {
        if (panelLibrary.classList.contains('active') && pdfDoc) {
            if (e.key === 'ArrowRight' || e.key === 'PageDown') {
                if (currentPageNum < pdfDoc.numPages) {
                    currentPageNum++;
                    renderPage(currentPageNum);
                }
            } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
                if (currentPageNum > 1) {
                    currentPageNum--;
                    renderPage(currentPageNum);
                }
            }
        }
    });

    // --- Local PDF File Loading ---
    const btnOpenLocal = document.getElementById('btn-open-local');
    const localPdfInput = document.getElementById('local-pdf-input');
    
    btnOpenLocal.addEventListener('click', () => localPdfInput.click());
    
    localPdfInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            currentBookFilename = file.name;
            readerPlaceholder.style.display = 'none';
            readerViewArea.style.display = 'block';
            
            canvasContext.clearRect(0, 0, pdfCanvas.width, pdfCanvas.height);
            
            const fileReader = new FileReader();
            fileReader.onload = function() {
                const typedarray = new Uint8Array(this.result);
                
                pdfjsLib.getDocument(typedarray).promise.then(pdf => {
                    pdfDoc = pdf;
                    currentPageNum = 1;
                    totalPagesSpan.textContent = pdf.numPages;
                    pageNumInput.max = pdf.numPages;
                    fitToWidth();
                }).catch(err => {
                    alert('Error loading local PDF file: ' + err.message);
                    console.error(err);
                });
            };
            fileReader.readAsArrayBuffer(file);
        }
    });
});
