import os
import re
import io

# pyrefly: ignore [missing-import]
from flask import (
    Flask,
    render_template,
    request,
    jsonify,
    send_file,
    send_from_directory,
)
from downloader import DocumentDownloader

# Directory setup
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DOWNLOADS_DIR = os.path.join(BASE_DIR, "downloads")
os.makedirs(DOWNLOADS_DIR, exist_ok=True)

app = Flask(
    __name__,
    template_folder=os.path.join(BASE_DIR, "templates"),
    static_folder=os.path.join(BASE_DIR, "static")
)
# Increase max payload size to 50 MB to accommodate large page source files
app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024
# Set Werkzeug max form field size limit to 50 MB
app.request_class.max_form_memory_size = 50 * 1024 * 1024


def clean_filename(title):
    cleaned = re.sub(r'[\\/*?:"<>|]', "", title)
    cleaned = cleaned.replace(" ", "_")
    return cleaned[:100]


def extract_title(source_code):
    match = re.search(r'<meta property="og:title"\s+content="([^"]+)"', source_code)
    if not match:
        match = re.search(r'content="([^"]+)"\s+property="og:title"', source_code)
    if not match:
        match = re.search(r"<title>([^<]+)</title>", source_code)

    if match:
        title = match.group(1).strip()
        title = re.sub(r"\s*\|\s*Scribd\s*$", "", title, flags=re.IGNORECASE)
        return clean_filename(title)
    return "document"


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/compile", methods=["POST"])
def compile_pdf():
    """Synchronously compiles the PDF in-memory and streams it back (Serverless/Vercel friendly)."""
    source_code = ""

    if request.is_json:
        try:
            data = request.get_json()
            source_code = data.get("source_code", "")
        except Exception as e:
            return jsonify({"error": f"Failed to parse JSON body: {e}"}), 400
    else:
        source_code = request.form.get("source_code", "")
        if not source_code and request.files:
            file = request.files.get("file")
            if file:
                try:
                    source_code = file.read().decode("utf-8")
                except Exception as e:
                    return jsonify({"error": f"Failed to read uploaded file: {e}"}), 400

    # If the user pasted a local file path, read the file directly
    if source_code:
        stripped_code = source_code.strip()
        if (stripped_code.startswith('"') and stripped_code.endswith('"')) or (
            stripped_code.startswith("'") and stripped_code.endswith("'")
        ):
            stripped_code = stripped_code[1:-1]

        if (
            len(stripped_code) < 500
            and os.path.exists(stripped_code)
            and os.path.isfile(stripped_code)
        ):
            try:
                with open(stripped_code, "r", encoding="utf-8") as f:
                    source_code = f.read()
            except Exception as e:
                return jsonify(
                    {
                        "error": f"Input recognized as local file path, but failed to read file: {e}"
                    }
                ), 400

    if not source_code:
        return jsonify({"error": "No source code or file path provided"}), 400

    doc_title = extract_title(source_code)
    pdf_filename = f"{doc_title}.pdf"

    try:
        downloader = DocumentDownloader()
        # Compile PDF synchronously in-memory
        pdf_buffer = downloader.compile_to_buffer(source_code)

        # Save copy locally if running on local server (for local reader listing)
        try:
            local_path = os.path.join(DOWNLOADS_DIR, pdf_filename)
            with open(local_path, "wb") as f:
                f.write(pdf_buffer.getvalue())
        except Exception as e:
            # We fail silently for local cache saves on read-only serverless filesystems
            print(f"Local cache save bypassed (serverless environment): {e}")

        # Send stream
        return send_file(
            pdf_buffer,
            mimetype="application/pdf",
            as_attachment=True,
            download_name=pdf_filename,
        )
    except Exception as e:
        return jsonify({"error": f"Compilation failed: {str(e)}"}), 500


@app.route("/downloads/<filename>")
def serve_pdf(filename):
    return send_from_directory(DOWNLOADS_DIR, filename)


@app.route("/books", methods=["GET"])
def list_books():
    """List all previously compiled PDFs in local directory."""
    try:
        if not os.path.exists(DOWNLOADS_DIR):
            return jsonify([])
        files = os.listdir(DOWNLOADS_DIR)
        pdfs = [f for f in files if f.lower().endswith(".pdf")]

        books = []
        for pdf in pdfs:
            path = os.path.join(DOWNLOADS_DIR, pdf)
            stat = os.stat(path)
            books.append(
                {
                    "filename": pdf,
                    "size_mb": round(stat.st_size / (1024 * 1024), 2),
                    "created_at": stat.st_mtime,
                }
            )

        books.sort(key=lambda x: x["created_at"], reverse=True)
        return jsonify(books)
    except Exception as e:
        return jsonify([])


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
