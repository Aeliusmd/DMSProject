"""Generate a readable SECURITY_AND_VALIDATION.pdf from markdown."""

from __future__ import annotations

import re
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
MD_PATH = ROOT / "docs" / "SECURITY_AND_VALIDATION.md"
PDF_PATH = ROOT / "docs" / "SECURITY_AND_VALIDATION.pdf"

PAGE_WIDTH = 210
PAGE_HEIGHT = 297
MARGIN_LEFT = 14
MARGIN_RIGHT = 14
MARGIN_TOP = 16
MARGIN_BOTTOM = 18
CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT

BOX_CHARS = set("┌┐└┘├┤─│▼►→←↑↓")


class DocPDF(FPDF):
    def __init__(self) -> None:
        super().__init__(orientation="P", unit="mm", format="A4")
        self.set_auto_page_break(auto=True, margin=MARGIN_BOTTOM)
        self.set_margins(MARGIN_LEFT, MARGIN_TOP, MARGIN_RIGHT)

    def header(self) -> None:
        if self.page_no() == 1:
            return
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(100, 116, 139)
        self.cell(0, 6, "DMS Security & Validation Reference", align="R", new_x="LMARGIN", new_y="NEXT")
        self.ln(1)

    def footer(self) -> None:
        self.set_y(-12)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(148, 163, 184)
        self.cell(0, 8, f"Page {self.page_no()}", align="C")


def clean_text(text: str) -> str:
    text = text.replace("\u2014", "-").replace("\u2013", "-")
    text = text.replace("\u2192", "->").replace("\u2190", "<-")
    text = text.replace("\u2022", "-")
    text = re.sub(r"`([^`]+)`", r"\1", text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
    text = re.sub(r"\*([^*]+)\*", r"\1", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = text.replace("✅", "Yes").replace("❌", "No").replace("⚠️", "Partial")
    return text.encode("latin-1", errors="replace").decode("latin-1")


def is_diagram_line(line: str) -> bool:
    return any(char in line for char in BOX_CHARS)


def is_table_separator(line: str) -> bool:
    stripped = line.strip()
    if not stripped.startswith("|"):
        return False
    return bool(re.fullmatch(r"\|?[\s:\-|]+\|?", stripped))


def parse_table_row(line: str) -> list[str]:
    cells = [clean_text(cell.strip()) for cell in line.strip().strip("|").split("|")]
    return cells


def write_paragraph(pdf: DocPDF, text: str, style: str = "body") -> None:
    text = clean_text(text.strip())
    if not text:
        pdf.ln(2)
        return

    pdf.set_x(MARGIN_LEFT)

    if style == "h1":
        pdf.ln(3)
        pdf.set_font("Helvetica", "B", 18)
        pdf.set_text_color(15, 23, 42)
        pdf.multi_cell(CONTENT_WIDTH, 8, text)
        pdf.ln(2)
    elif style == "h2":
        pdf.ln(4)
        pdf.set_font("Helvetica", "B", 13)
        pdf.set_text_color(15, 118, 140)
        pdf.multi_cell(CONTENT_WIDTH, 7, text)
        pdf.ln(1)
    elif style == "h3":
        pdf.ln(3)
        pdf.set_font("Helvetica", "B", 11)
        pdf.set_text_color(30, 41, 59)
        pdf.multi_cell(CONTENT_WIDTH, 6, text)
    elif style == "h4":
        pdf.ln(2)
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(51, 65, 85)
        pdf.multi_cell(CONTENT_WIDTH, 5.5, text)
    elif style == "meta":
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(100, 116, 139)
        pdf.multi_cell(CONTENT_WIDTH, 5, text)
    elif style == "bullet":
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(30, 41, 59)
        pdf.multi_cell(CONTENT_WIDTH, 4.8, f"  - {text}")
    elif style == "code":
        pdf.set_font("Courier", "", 8)
        pdf.set_text_color(30, 41, 59)
        pdf.set_fill_color(248, 250, 252)
        pdf.multi_cell(CONTENT_WIDTH, 4.3, text, fill=True)
        pdf.ln(1)
    else:
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(30, 41, 59)
        pdf.multi_cell(CONTENT_WIDTH, 4.8, text)


def write_table(pdf: DocPDF, rows: list[list[str]]) -> None:
    if not rows:
        return

    col_count = max(len(row) for row in rows)
    normalized = [row + [""] * (col_count - len(row)) for row in rows]

    if col_count == 2:
        widths = [CONTENT_WIDTH * 0.34, CONTENT_WIDTH * 0.66]
    elif col_count == 3:
        widths = [CONTENT_WIDTH * 0.24, CONTENT_WIDTH * 0.38, CONTENT_WIDTH * 0.38]
    elif col_count == 4:
        widths = [CONTENT_WIDTH * 0.18, CONTENT_WIDTH * 0.24, CONTENT_WIDTH * 0.28, CONTENT_WIDTH * 0.30]
    elif col_count == 5:
        widths = [CONTENT_WIDTH * 0.16, CONTENT_WIDTH * 0.18, CONTENT_WIDTH * 0.20, CONTENT_WIDTH * 0.22, CONTENT_WIDTH * 0.24]
    else:
        widths = [CONTENT_WIDTH / col_count] * col_count

    pdf.ln(2)
    start_x = MARGIN_LEFT

    for row_index, row in enumerate(normalized):
        row_height = 6
        for cell_index, cell in enumerate(row):
            pdf.set_xy(start_x + sum(widths[:cell_index]), pdf.get_y())
            if row_index == 0:
                pdf.set_font("Helvetica", "B", 8)
                pdf.set_fill_color(226, 242, 246)
                pdf.set_text_color(15, 76, 92)
            else:
                pdf.set_font("Helvetica", "", 8)
                pdf.set_fill_color(255, 255, 255) if row_index % 2 else pdf.set_fill_color(248, 250, 252)
                pdf.set_text_color(30, 41, 59)

            lines = pdf.multi_cell(
                widths[cell_index],
                5,
                cell or "-",
                border=1,
                align="L",
                fill=True,
                dry_run=True,
                output="LINES",
            )
            row_height = max(row_height, len(lines) * 5)

        y = pdf.get_y()
        for cell_index, cell in enumerate(row):
            x = start_x + sum(widths[:cell_index])
            pdf.set_xy(x, y)
            if row_index == 0:
                pdf.set_font("Helvetica", "B", 8)
                pdf.set_fill_color(226, 242, 246)
                pdf.set_text_color(15, 76, 92)
            else:
                pdf.set_font("Helvetica", "", 8)
                pdf.set_fill_color(255, 255, 255) if row_index % 2 else pdf.set_fill_color(248, 250, 252)
                pdf.set_text_color(30, 41, 59)

            pdf.multi_cell(
                widths[cell_index],
                5,
                cell or "-",
                border=1,
                align="L",
                fill=True,
            )

        pdf.set_y(y + row_height)

    pdf.ln(3)


def render_cover(pdf: DocPDF, title: str, version: str, updated: str, scope: str) -> None:
    pdf.add_page()
    pdf.ln(38)
    pdf.set_font("Helvetica", "B", 24)
    pdf.set_text_color(15, 23, 42)
    pdf.multi_cell(CONTENT_WIDTH, 10, title, align="C")
    pdf.ln(6)

    pdf.set_font("Helvetica", "", 11)
    pdf.set_text_color(71, 85, 105)
    pdf.multi_cell(CONTENT_WIDTH, 6, "Internal technical reference for backend validation,\nfrontend integration, sanitization, SQL safety, and exception handling.", align="C")
    pdf.ln(12)

    pdf.set_draw_color(0, 151, 178)
    pdf.set_line_width(0.6)
    line_y = pdf.get_y()
    pdf.line(MARGIN_LEFT + 35, line_y, PAGE_WIDTH - MARGIN_RIGHT - 35, line_y)
    pdf.ln(10)

    meta_lines = [
        f"Document version: {version}" if version else "",
        f"Last updated: {updated}" if updated else "",
        f"Scope: {scope}" if scope else "",
    ]
    for line in meta_lines:
        if line:
            write_paragraph(pdf, line, "meta")

    pdf.ln(8)
    write_paragraph(pdf, "Generated from backend/docs/SECURITY_AND_VALIDATION.md", "meta")


def extract_metadata(content: str) -> tuple[str, str, str, str]:
    title = "DMS System Security & Validation Reference"
    version = ""
    updated = ""
    scope = ""

    for line in content.splitlines():
        if line.startswith("# "):
            title = line[2:].strip()
        elif line.startswith("**Document version:**"):
            version = line.split(":", 1)[1].strip().strip("*").strip()
        elif line.startswith("**Last updated:**"):
            updated = line.split(":", 1)[1].strip().strip("*").strip()
        elif line.startswith("**Scope:**"):
            scope = line.split(":", 1)[1].strip().strip("*").strip()

    return title, version, updated, scope


def render_markdown(pdf: DocPDF, content: str) -> None:
    title, version, updated, scope = extract_metadata(content)
    render_cover(pdf, title, version, updated, scope)

    pdf.add_page()
    in_code = False
    code_lines: list[str] = []
    table_rows: list[list[str]] = []
    skip_until_hr = False

    for raw in content.splitlines():
        line = raw.rstrip()

        if line.strip() == "---":
            if table_rows:
                write_table(pdf, table_rows)
                table_rows = []
            pdf.ln(2)
            continue

        if line.strip().startswith("```"):
            if in_code:
                write_paragraph(pdf, "\n".join(code_lines), "code")
                code_lines = []
                in_code = False
            else:
                in_code = True
            continue

        if in_code:
            code_lines.append(line)
            continue

        if is_diagram_line(line):
            if not skip_until_hr:
                write_paragraph(
                    pdf,
                    "Architecture flow: Frontend validates -> Backend validates -> Database (parameterized queries).",
                    "body",
                )
                skip_until_hr = True
            continue

        skip_until_hr = False

        if line.strip().startswith("|"):
            if is_table_separator(line):
                continue
            table_rows.append(parse_table_row(line))
            continue

        if table_rows:
            write_table(pdf, table_rows)
            table_rows = []

        if not line.strip():
            pdf.ln(2)
            continue

        if line.startswith("# "):
            write_paragraph(pdf, line[2:], "h1")
        elif line.startswith("## "):
            write_paragraph(pdf, line[3:], "h2")
        elif line.startswith("### "):
            write_paragraph(pdf, line[4:], "h3")
        elif line.startswith("#### "):
            write_paragraph(pdf, line[5:], "h4")
        elif line.startswith("- "):
            write_paragraph(pdf, line[2:], "bullet")
        elif re.match(r"^\d+\.\s", line):
            write_paragraph(pdf, line, "bullet")
        elif line.startswith("**Document version:**") or line.startswith("**Last updated:**") or line.startswith("**Scope:**"):
            continue
        else:
            write_paragraph(pdf, line, "body")

    if table_rows:
        write_table(pdf, table_rows)


def main() -> None:
    content = MD_PATH.read_text(encoding="utf-8")
    pdf = DocPDF()
    render_markdown(pdf, content)
    pdf.output(str(PDF_PATH))
    print(f"Wrote {PDF_PATH}")


if __name__ == "__main__":
    main()
