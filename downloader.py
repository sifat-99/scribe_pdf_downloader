import os
import re
import urllib.request
import json
import gzip
import tempfile
import shutil
import io
from concurrent.futures import ThreadPoolExecutor, as_completed

# pyrefly: ignore [missing-import]
from PIL import Image


class DocumentDownloader:
    def __init__(self):
        # We will create temp directory per run to avoid conflicts
        pass

    def extract_jsonp_urls(self, source_code):
        """Extracts JSONP URLs from source code."""
        jsonp_urls = re.findall(r'contentUrl:\s*"([^"]+)"', source_code)
        if not jsonp_urls:
            jsonp_urls = re.findall(
                r"https?://html\.scribdassets\.com/[^/]+/pages/\d+-[a-f0-9]+\.jsonp",
                source_code,
            )

        unique_urls = list(set(jsonp_urls))

        def get_page_num(url):
            match = re.search(r"/pages/(\d+)-", url)
            return int(match.group(1)) if match else 999999

        unique_urls.sort(key=get_page_num)

        tasks = []
        for url in unique_urls:
            page_num = get_page_num(url)
            tasks.append((page_num, url))

        return tasks

    def process_page(self, page_num, jsonp_url, images_dir):
        """Fetches JSONP, extracts the image URL, and downloads the image."""
        filename = f"page_{page_num:04d}.jpg"
        dest_path = os.path.join(images_dir, filename)

        # Step 1: Fetch and parse JSONP
        img_url = None
        req_jsonp = urllib.request.Request(
            jsonp_url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                "Accept-Encoding": "gzip, deflate",
            },
        )

        for attempt in range(3):
            try:
                with urllib.request.urlopen(req_jsonp, timeout=10) as response:
                    data = response.read()
                if data.startswith(b"\x1f\x8b"):
                    data = gzip.decompress(data)
                content = data.decode("utf-8")

                match = re.search(
                    r"window\.page\d+_callback\((.*)\)", content, re.DOTALL
                )
                if match:
                    arr = json.loads(match.group(1).strip())
                    html = arr[0]
                    img_match = re.search(r'class="absimg"[^>]*orig="([^"]+)"', html)
                    if not img_match:
                        img_match = re.search(r'orig="([^"]+)"', html)
                    if img_match:
                        orig_url = img_match.group(1)
                        img_url = orig_url.replace(
                            "http://html.scribd.com", "https://html.scribdassets.com"
                        )
                        break
            except Exception as e:
                if attempt == 2:
                    raise Exception(f"Failed to fetch JSONP for page {page_num}: {e}")

        if not img_url:
            raise Exception(f"No background image found in JSONP for page {page_num}")

        # Step 2: Download image
        req_img = urllib.request.Request(
            img_url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
        )

        for attempt in range(3):
            try:
                with urllib.request.urlopen(req_img, timeout=12) as response:
                    img_data = response.read()
                with open(dest_path, "wb") as f:
                    f.write(img_data)
                return page_num, dest_path
            except Exception as e:
                if attempt == 2:
                    raise Exception(
                        f"Failed to download image for page {page_num}: {e}"
                    )
        return page_num, None

    def compile_to_buffer(self, source_code, max_workers=20):
        """Downloads and compiles PDF into an in-memory BytesIO stream (serverless friendly)."""
        # Create unique temp directory
        images_dir = tempfile.mkdtemp()

        try:
            tasks = self.extract_jsonp_urls(source_code)
            if not tasks:
                raise Exception("No page URLs found in the provided source code.")

            downloaded_files = {}

            # Download concurrently
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                futures = {
                    executor.submit(
                        self.process_page, page_num, url, images_dir
                    ): page_num
                    for page_num, url in tasks
                }

                for future in as_completed(futures):
                    page_num = futures[future]
                    try:
                        _, filepath = future.result()
                        if filepath:
                            downloaded_files[page_num] = filepath
                    except Exception as e:
                        print(f"Error on page {page_num}: {e}")

            sorted_page_nums = sorted(downloaded_files.keys())
            sorted_files = [downloaded_files[p] for p in sorted_page_nums]

            if len(sorted_files) == 0:
                raise Exception("Failed to download any pages.")

            # Compile to PDF in-memory
            images = []
            for path in sorted_files:
                try:
                    img = Image.open(path)
                    if img.mode != "RGB":
                        img = img.convert("RGB")
                    images.append(img)
                except Exception as e:
                    print(f"Skipping corrupt image {path}: {e}")

            if not images:
                raise Exception("No valid images could be loaded to create the PDF.")

            # Save into memory
            pdf_buffer = io.BytesIO()
            images[0].save(
                pdf_buffer, format="PDF", save_all=True, append_images=images[1:]
            )
            pdf_buffer.seek(0)

            return pdf_buffer

        finally:
            # Clean up temp folder completely
            shutil.rmtree(images_dir, ignore_errors=True)
