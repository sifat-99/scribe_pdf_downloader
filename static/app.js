// ScribeFlow Client-Side Application Logic

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
    let pollingInterval = null;
    const circleCircumference = 2 * Math.PI * 76; // 477.52
    
    // E-Reader state
    let pdfDoc = null;
    let currentPageNum = 1;
    let currentScale = 1.0;
    let currentBookFilename = '';

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

    // --- Downloader Progress Utility ---
    function setProgress(percent) {
        const offset = circleCircumference - (percent / 100 * circleCircumference);
        progressCircle.style.strokeDashoffset = offset;
        percentageLabel.textContent = `${Math.round(percent)}%`;
    }

    // --- Compilation Execution ---
    btnCompile.addEventListener('click', () => {
        const sourceCode = activeFileContent || sourceTextarea.value.trim();
        
        if (!sourceCode) {
            alert('Please upload a page source text file or paste the raw HTML source code first.');
            return;
        }

        // Reset progress UI
        setProgress(0);
        pagesLabel.textContent = 'Processing...';
        updateStatusBadge('parsing');
        statusMessage.textContent = 'Connecting to server and extracting page links...';
        btnDownloadPdf.style.display = 'none';
        btnCompile.disabled = true;

        // Start simulated progress bar to show activity
        let simulatedPercent = 0;
        const progressInterval = setInterval(() => {
            if (simulatedPercent < 95) {
                simulatedPercent += Math.random() * 8 + 2;
                if (simulatedPercent > 95) simulatedPercent = 95;
                setProgress(simulatedPercent);
                pagesLabel.textContent = `Processing pages...`;
                if (simulatedPercent > 70) {
                    statusMessage.textContent = 'Assembling images and building PDF document...';
                    updateStatusBadge('compiling');
                } else if (simulatedPercent > 30) {
                    statusMessage.textContent = 'Downloading high-resolution page assets...';
                    updateStatusBadge('downloading');
                }
            }
        }, 400);

        // Send start request as JSON
        fetch('/compile', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ source_code: sourceCode })
        })
        .then(async res => {
            clearInterval(progressInterval);
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Server error during compilation.');
            }
            
            // Extract filename from Content-Disposition header
            let filename = 'compiled_document.pdf';
            const disposition = res.headers.get('Content-Disposition');
            if (disposition && disposition.indexOf('attachment') !== -1) {
                const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                const matches = filenameRegex.exec(disposition);
                if (matches != null && matches[1]) { 
                    filename = matches[1].replace(/['"]/g, '');
                }
            }
            
            const blob = await res.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            
            // Trigger automatic file download
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            
            // Update UI to completion state
            setProgress(100);
            updateStatusBadge('completed');
            pagesLabel.textContent = '100% Complete';
            statusMessage.textContent = 'Document compiled and downloaded successfully!';
            
            // Display glow save button for redundant downloads
            btnDownloadPdf.style.display = 'flex';
            btnDownloadPdf.onclick = () => {
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                a.remove();
            };
            
            btnCompile.disabled = false;
        })
        .catch(err => {
            clearInterval(progressInterval);
            showFailure(err.message || 'Failed to communicate with the server.');
            console.error(err);
        });
    });

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

    // --- Library Management ---
    function loadLibrary() {
        bookList.innerHTML = '<div class="reader-placeholder"><i class="fa-solid fa-spinner fa-spin book-icon"></i><p style="font-size:12px;">Scanning library...</p></div>';
        
        fetch('/books')
        .then(res => res.json())
        .then(books => {
            bookList.innerHTML = '';
            if (books.length === 0) {
                bookList.innerHTML = '<div class="reader-placeholder"><i class="fa-solid fa-box-open book-icon"></i><p style="font-size:12px;text-align:center;">No compiled books found yet.<br>Go to Downloader tab to build a book!</p></div>';
                return;
            }

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
                        <div class="book-meta">${book.size_mb} MB &bull; ${new Date(book.created_at * 1000).toLocaleDateString()}</div>
                    </div>
                `;
                
                item.addEventListener('click', () => {
                    document.querySelectorAll('.book-item').forEach(el => el.classList.remove('active'));
                    item.classList.add('active');
                    openBook(book.filename);
                });
                
                bookList.appendChild(item);
            });
        })
        .catch(err => {
            bookList.innerHTML = '<div class="reader-placeholder"><i class="fa-solid fa-circle-exclamation book-icon"></i><p style="font-size:12px;">Failed to load library.</p></div>';
            console.error(err);
        });
    }

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

    // --- Interactive E-Reader Implementation (PDF.js) ---
    function openBook(filename) {
        currentBookFilename = filename;
        readerPlaceholder.style.display = 'none';
        readerViewArea.style.display = 'block';
        
        // Show loading spinner
        canvasContext.clearRect(0, 0, pdfCanvas.width, pdfCanvas.height);
        
        const url = `/downloads/${filename}`;
        
        pdfjsLib.getDocument(url).promise.then(pdf => {
            pdfDoc = pdf;
            currentPageNum = 1;
            totalPagesSpan.textContent = pdf.numPages;
            pageNumInput.max = pdf.numPages;
            
            // Set initial scale to fit the viewport width nicely
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
            
            // Adjust canvas resolution for high-DPI displays
            const dpr = window.devicePixelRatio || 1;
            pdfCanvas.width = viewport.width * dpr;
            pdfCanvas.height = viewport.height * dpr;
            pdfCanvas.style.width = `${viewport.width}px`;
            pdfCanvas.style.height = `${viewport.height}px`;
            
            // Context scaling for DPI
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
            const containerWidth = document.querySelector('.pdf-display-container').clientWidth - 40; // padding
            currentScale = containerWidth / viewport.width;
            renderPage(currentPageNum);
        });
    }

    // Fullscreen trigger
    btnFullscreen.addEventListener('click', () => {
        const container = document.querySelector('.pdf-display-container');
        if (!document.fullscreenElement) {
            container.requestFullscreen().catch(err => {
                alert(`Error enabling full-screen mode: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    });

    // Handle keypresses for reading
    document.addEventListener('keydown', (e) => {
        // Only active if library panel is in focus
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
});
