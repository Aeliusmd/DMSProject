import asyncio
import json
import os
import re
import shutil
from pathlib import Path

import fitz  # PyMuPDF
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from Separator import split_pdf_by_barcode_separator
from google.cloud import documentai_v1 as documentai
from google.api_core.client_options import ClientOptions

# ─── Config ────────────────────────────────────────────────────────────────────
CREDENTIALS_PATH = r"platinum-honor-468520-e6-43ba2ce59daf.json"
PROJECT_ID       = "platinum-honor-468520-e6"
LOCATION         = "us"
PROCESSOR_ID     = "68993e5df69a40d"   # Extractor processor
MIME_TYPE        = "application/pdf"
DELETE_TEMP      = False   # Set to False to keep temp folder for debugging
MAX_PARALLEL_EXTRACTORS = int(os.getenv("MAX_PARALLEL_EXTRACTORS", "4"))

EXPECTED_FIELDS = [
    "Amount",
    "ApplicantName",
    "CaseName",
    "ChequeDate",
    "ChequeNumber",
    "CompanyAddress",
    "CompanyName",
    "Customer",
    "Date",
    "DateOfBirth",
    "DateOfInjury",
    "DateRequested",
    "DePoDueDate",
    "DoctorAddress",
    "OrderNumber",
    "RecNumber",
    "RecordType",
    "RequestedRecord",
    "SpecificDoctor",
    "SSN",
]

# ─── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="Subpoena Extractor API")

STATIC_DIR = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/")
async def serve_ui():
    return FileResponse(str(STATIC_DIR / "index.html"))


# ─── Document AI Client ────────────────────────────────────────────────────────

def get_client() -> documentai.DocumentProcessorServiceClient:
    if not os.path.exists(CREDENTIALS_PATH):
        raise FileNotFoundError(
            f"Google Document AI credentials not found at '{CREDENTIALS_PATH}'. "
            "Copy the service account JSON into the Subpoena_Extraction folder."
        )

    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = CREDENTIALS_PATH
    opts = ClientOptions(api_endpoint=f"{LOCATION}-documentai.googleapis.com")
    return documentai.DocumentProcessorServiceClient(client_options=opts)


# ─── Step 2: Extract entities from each chunk ─────────────────────────────────

def get_entity_pages(entity) -> list[int]:
    pages = []
    if hasattr(entity, "page_anchor") and entity.page_anchor:
        if hasattr(entity.page_anchor, "page_refs") and entity.page_anchor.page_refs:
            for ref in entity.page_anchor.page_refs:
                page_num = getattr(ref, "page", None)
                if page_num is not None:
                    pages.append(int(page_num))
    return sorted(set(pages))


def parse_entities_from_list(entities: list) -> dict:
    """
    Parse a flat list of entities (merged from multiple chunks).
    Keeps the highest confidence value per field.
    """
    extracted    = {field: None for field in EXPECTED_FIELDS}
    raw_entities = []

    for entity in entities:
        field_name   = entity.type_
        mention_text = entity.mention_text.strip() if entity.mention_text else None
        confidence   = round(entity.confidence, 4)
        normalized   = entity.normalized_value.text if entity.normalized_value else None
        pages        = get_entity_pages(entity)

        entry = {
            "value":      mention_text,
            "confidence": confidence,
            "normalized": normalized,
            "pages":      pages,
            "first_page": pages[0] if pages else None,
        }

        raw_entities.append({"field": field_name, **entry})

        if field_name in extracted:
            current = extracted[field_name]

            # Clean Amount field
            if field_name == "Amount" and mention_text:
                cleaned = re.sub(r'[^\d.]', '', mention_text)
                if cleaned:
                    try:
                        entry["value"] = f"${float(cleaned):.2f}"
                    except ValueError:
                        pass

            if current is None:
                extracted[field_name] = entry
            elif isinstance(current, list):
                current.append(entry)
            else:
                # Keep highest confidence value
                if entry["confidence"] > current["confidence"]:
                    extracted[field_name] = entry
                else:
                    extracted[field_name] = [current, entry]

    return {
        "schema_extraction": extracted,
        "raw_entities":      raw_entities,
    }


def parse_entities(document) -> dict:
    result = parse_entities_from_list(document.entities)
    result["document_text"] = document.text
    return result


def run_extractor(pdf_path: Path) -> dict:
    """
    Run the extraction processor on a single subpoena PDF.
    Handles the 15-page limit by processing in chunks and merging entities.
    """
    PAGE_LIMIT = 15
    client     = get_client()
    name       = client.processor_path(PROJECT_ID, LOCATION, PROCESSOR_ID)

    pdf_bytes   = pdf_path.read_bytes()
    src         = fitz.open(stream=pdf_bytes, filetype="pdf")
    total_pages = len(src)
    src.close()

    all_entities     = []
    all_text_chunks  = []

    for batch_start in range(0, total_pages, PAGE_LIMIT):
        batch_end = min(batch_start + PAGE_LIMIT - 1, total_pages - 1)
        print(f"  [+] Extractor batch: pages {batch_start}–{batch_end}")

        src_doc   = fitz.open(stream=pdf_bytes, filetype="pdf")
        batch_doc = fitz.open()
        batch_doc.insert_pdf(src_doc, from_page=batch_start, to_page=batch_end)
        batch_bytes = batch_doc.tobytes()
        batch_doc.close()
        src_doc.close()

        raw_doc = documentai.RawDocument(content=batch_bytes, mime_type=MIME_TYPE)
        request = documentai.ProcessRequest(name=name, raw_document=raw_doc)
        result  = client.process_document(request=request)

        all_entities.extend(result.document.entities)
        all_text_chunks.append(result.document.text)

    # Parse merged entities from all chunks
    parsed = parse_entities_from_list(all_entities)
    parsed["document_text"]     = "\n".join(all_text_chunks)
    parsed["raw_document_ai"]   = {}  # raw not stored for extractor chunks
    return parsed


def save_output(data: dict, filename: str) -> None:
    output_dir = Path(__file__).parent / "output"
    output_dir.mkdir(exist_ok=True)
    json_path  = output_dir / f"{filename}.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"[+] Saved -> {json_path}")


def process_split_document(
    doc: dict,
    idx: int,
    base_name: str,
    is_multi: bool,
    source_filename: str,
) -> dict:
    chunk_path = Path(doc["path"])
    label = f"{base_name}_subpoena_{idx + 1}" if is_multi else base_name
    print(f"[+] Processing {label} ...")

    result = run_extractor(chunk_path)
    result["source_file"]     = source_filename
    result["subpoena_index"]  = idx + 1
    result["subpoena_label"]  = label
    result["page_range"]      = {
        "start": doc["page_start"],
        "end":   doc["page_end"],
    }
    result["project_id"]      = PROJECT_ID
    result["processor_id"]    = PROCESSOR_ID
    result["expected_fields"] = EXPECTED_FIELDS

    save_output(result, label)
    return result


# ─── Main Endpoint ─────────────────────────────────────────────────────────────

@app.post("/process")
async def process_document(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    pdf_bytes = await file.read()
    if len(pdf_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    base_name = Path(file.filename).stem

    # ── Step 1: Split using local separator.py script ─────────────────────────
    temp_dir = Path(__file__).parent / "temp" / base_name
    temp_dir.mkdir(parents=True, exist_ok=True)
    input_pdf_path = temp_dir / f"{base_name}_uploaded.pdf"
    input_pdf_path.write_bytes(pdf_bytes)

    split_output_dir = temp_dir / "subpoenas"
    split_output_dir.mkdir(parents=True, exist_ok=True)

    try:
        split_result = split_pdf_by_barcode_separator(
            str(input_pdf_path),
            str(split_output_dir),
        )
    except Exception as exc:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=f"Separator error: {str(exc)}")

    documents = split_result.get("documents", [])
    if not documents:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail="Separator did not produce any documents.")

    is_multi = len(documents) > 1

    splitter_summary = {
        "source_file": file.filename,
        "total_pages": split_result.get("total_pages"),
        "total_subpoenas": len(documents),
        "subpoenas": [
            {
                "subpoena_index": doc["index"],
                "label": f"{base_name}_subpoena_{doc['index']}",
                "page_start": doc["page_start"],
                "page_end": doc["page_end"],
                "page_count": doc["page_count"],
                "path": doc["path"],
            }
            for doc in documents
        ],
    }
    splitter_json_path = temp_dir / f"{base_name}_splitter_output.json"
    with open(splitter_json_path, "w", encoding="utf-8") as f:
        json.dump(splitter_summary, f, indent=2, ensure_ascii=False)
    print(f"[+] Saved splitter summary -> {splitter_json_path}")

    # ── Step 2: Process each split document in parallel ───────────────────────
    concurrency = max(1, min(MAX_PARALLEL_EXTRACTORS, len(documents)))
    semaphore = asyncio.Semaphore(concurrency)

    async def run_one(idx: int, doc: dict) -> dict:
        async with semaphore:
            try:
                return await asyncio.to_thread(
                    process_split_document,
                    doc,
                    idx,
                    base_name,
                    is_multi,
                    file.filename,
                )
            except Exception as exc:
                raise RuntimeError(f"Extractor error on subpoena {idx + 1}: {str(exc)}") from exc

    try:
        results = await asyncio.gather(
            *(run_one(idx, doc) for idx, doc in enumerate(documents))
        )
    except Exception as exc:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=str(exc))

    # ── Cleanup temp folder based on DELETE_TEMP switch ─────────────────────
    if DELETE_TEMP:
        shutil.rmtree(temp_dir, ignore_errors=True)
        print(f"[+] Temp folder deleted: {temp_dir}")
    else:
        print(f"[+] Temp folder kept at: {temp_dir}")

    return JSONResponse(content={
        "total":    len(results),
        "is_multi": is_multi,
        "results":  results,
    })


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=False)