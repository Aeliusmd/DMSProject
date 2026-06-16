import os
import shutil
import tempfile
from pathlib import Path

import fitz  # pymupdf
from pypdf import PdfReader, PdfWriter
from PIL import Image
from pyzbar.pyzbar import decode


# =========================
# CONFIG
# =========================
INPUT_PDF = "1.pdf"
OUTPUT_DIR = "split_output"

EXCLUDE_SEPARATOR_PAGE = True

ALLOWED_SEPARATOR_VALUES = set()
# Example: ALLOWED_SEPARATOR_VALUES = {"SEP", "DOCUMENT_BREAK"}

DPI = 150  # Higher = more accurate barcode detection, slower


# =========================
# HELPERS
# =========================
def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def read_barcodes_from_image(image_path: str):
    img = Image.open(image_path)
    found = decode(img)
    results = []
    for item in found:
        try:
            results.append(item.data.decode("utf-8", errors="ignore").strip())
        except Exception:
            results.append(str(item.data))
    return results


def is_separator_page(barcode_values):
    if not barcode_values:
        return False
    if not ALLOWED_SEPARATOR_VALUES:
        return True
    return any(v in ALLOWED_SEPARATOR_VALUES for v in barcode_values)


def rasterize_pdf_to_images(input_pdf: str, output_dir: str, dpi: int = 150):
    """
    Rasterize all pages of a PDF to PNG using PyMuPDF.
    Returns sorted list of image paths.
    """
    doc = fitz.open(input_pdf)
    image_paths = []
    mat = fitz.Matrix(dpi / 72, dpi / 72)  # scale factor from 72 dpi base

    for page_index in range(len(doc)):
        page = doc[page_index]
        pix = page.get_pixmap(matrix=mat)
        img_path = os.path.join(output_dir, f"page_{page_index:05d}.png")
        pix.save(img_path)
        image_paths.append(img_path)

    doc.close()
    return image_paths


def detect_separator_ranges(
    input_pdf: str,
    *,
    exclude_separator_page: bool = EXCLUDE_SEPARATOR_PAGE,
    dpi: int = DPI,
):
    """
    Detect separator pages and return split ranges and details.
    """
    temp_dir = tempfile.mkdtemp(prefix="barcode_split_")
    try:
        print(f"Rasterizing '{input_pdf}' at {dpi} DPI...")
        image_files = rasterize_pdf_to_images(input_pdf, temp_dir, dpi=dpi)

        reader = PdfReader(input_pdf)
        total_pages = len(reader.pages)

        if len(image_files) != total_pages:
            print(
                f"Warning: Image count ({len(image_files)}) != "
                f"PDF page count ({total_pages}). Using minimum."
            )

        usable_count = min(len(image_files), total_pages)

        separator_indexes = []
        separator_info = {}

        print("Scanning pages for barcodes...")
        for page_index in range(usable_count):
            barcode_values = read_barcodes_from_image(image_files[page_index])
            if is_separator_page(barcode_values):
                separator_indexes.append(page_index)
                separator_info[page_index] = barcode_values

        print("Detected separator pages:")
        if separator_indexes:
            for idx in separator_indexes:
                print(f"  Page {idx + 1}: {separator_info[idx]}")
        else:
            print("  None found — outputting entire PDF as one document.")

        # Build split ranges
        ranges = []
        start = 0

        for sep_idx in separator_indexes:
            end = sep_idx - 1 if exclude_separator_page else sep_idx
            if start <= end:
                ranges.append((start, end))
            start = sep_idx + 1 if exclude_separator_page else sep_idx

        if start <= usable_count - 1:
            ranges.append((start, usable_count - 1))

        if not ranges:
            print("No output ranges created. Falling back to entire PDF as one document.")
            ranges = [(0, usable_count - 1)] if usable_count > 0 else []

        return {
            "ranges": ranges,
            "separator_indexes": separator_indexes,
            "separator_info": separator_info,
            "usable_page_count": usable_count,
            "total_pages": total_pages,
        }
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def split_pdf_by_barcode_separator(
    input_pdf: str,
    output_dir: str,
    *,
    exclude_separator_page: bool = EXCLUDE_SEPARATOR_PAGE,
    dpi: int = DPI,
):
    ensure_dir(output_dir)
    detection = detect_separator_ranges(
        input_pdf,
        exclude_separator_page=exclude_separator_page,
        dpi=dpi,
    )
    ranges = detection["ranges"]
    reader = PdfReader(input_pdf)
    input_stem = Path(input_pdf).stem
    outputs = []

    for doc_num, (start_page, end_page) in enumerate(ranges, start=1):
        writer = PdfWriter()
        for i in range(start_page, end_page + 1):
            writer.add_page(reader.pages[i])

        output_path = os.path.join(
            output_dir,
            f"{input_stem}_part_{doc_num:03d}_pages_{start_page+1}-{end_page+1}.pdf"
        )
        with open(output_path, "wb") as f:
            writer.write(f)

        print(f"Saved: {output_path}")
        outputs.append(
            {
                "index": doc_num,
                "path": output_path,
                "page_start": start_page,
                "page_end": end_page,
                "page_count": end_page - start_page + 1,
            }
        )

    return {
        "source_file": input_pdf,
        "total_pages": detection["total_pages"],
        "usable_page_count": detection["usable_page_count"],
        "total_documents": len(outputs),
        "separator_indexes": detection["separator_indexes"],
        "documents": outputs,
    }


if __name__ == "__main__":
    split_pdf_by_barcode_separator(INPUT_PDF, OUTPUT_DIR)