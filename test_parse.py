import urllib.request
import json

url = "http://127.0.0.1:5000/compile"
# Send a JSON request containing the local file path
data = json.dumps({
    "source_code": "/Volumes/Sifat_SSD/Development/Project/pdfDownloader/page source.txt"
}).encode("utf-8")

req = urllib.request.Request(
    url, 
    data=data, 
    headers={"Content-Type": "application/json"}
)

try:
    print("Sending synchronous compile request to server...")
    with urllib.request.urlopen(req) as res:
        print("Status code:", res.status)
        print("Response Content-Type:", res.headers.get("Content-Type"))
        print("Response Content-Disposition:", res.headers.get("Content-Disposition"))
        pdf_data = res.read()
        print(f"Success! Received PDF payload of size: {len(pdf_data)} bytes.")
except Exception as e:
    print("Error during compile request:", e)
