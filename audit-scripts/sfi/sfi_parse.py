"""Shared parsing for Massachusetts SFI PDFs.

One implementation, imported by the extractor and the enhancers, replacing the
per-script heuristics that produced `ownTopEmployer: "Income"` for 95% of
filings.

WHAT THE DOCUMENT LOOKS LIKE
----------------------------
Each question is a prompt paragraph, optionally followed by a NOTE paragraph
and/or an ownership legend, then a header row naming the table's columns, then
the filer's answers. Questions with no answer say "Filer reported none."

    5. Identify every Business for which you worked as an employee, ...
    Business Name Address Position IncomeSelf-employed        <- header row
    Lovely Law                                                 <- data
    Group LLP
    Ten Federal Street,
    Salem, MA, 01970, US
    Manager $10,001 to 20,000

Two things make naive line-based parsing fail, and both caused live bugs:

* The header row is a run-together concatenation of column names, and it varies
  by year and question (`... Position Income`, `... Position IncomeSelf-employed`,
  `... Percentage of stock Income`). Taking "the first plausible line" returns
  the header, which is why the site displayed the literal string "Income" as an
  employer.
* Table cells wrap across several lines, so a line is rarely a whole field.

APPROACH
--------
Data begins after the LAST header line. Prompt prose, NOTE paragraphs and
legends all precede it, so locating the header boundary removes them in one
step rather than guessing at line counts. Header lines are recognised
structurally: strip every known column phrase and see whether anything is left.
That survives the run-together variants without enumerating them all.

Remaining lines are then filtered of things that are certainly not entity
names — money bands, ownership codes, addresses, page furniture — and what
survives is the answer content, in document order.

This module deliberately does not attempt full cell-by-cell table
reconstruction. Column boundaries are not recoverable from the extracted text
stream, and guessing at them is what produced address fragments as employer
names. It extracts the entity column reliably and reports what it could not
place, rather than inventing structure.
"""

from __future__ import annotations

import re

# Every column name that appears in an SFI table header, longest first so that
# `Amount of Income` is consumed before a bare `Income` can match inside it.
COLUMN_PHRASES = [
    # Q36-Q39, the gift / reimbursement tables. These were missing at first,
    # so no header was found and the sections read as empty — turning the old
    # false positives into false negatives. A real $516 reimbursement from
    # WestEd sat unreported until these were added.
    "Name of Legislative Agent or Executive Agent",
    "Address of Legislative or Executive Agent",
    "Name of Source of Reimbursement",
    "Address of Source of Reimbursement",
    "Person or entity for whom Donor was acting, if any",
    "Person or entity for whom Donor",
    "Amount of Reimbursement",
    "Name of Donor",
    "Address of Donor",
    "Value of Gift",
    "Amount of Gift",
    "Description of Gift",
    "Fair Market Value",
    "Date of Gift",
    "Nature of Gift",
    "was acting, if any",
    "Public Agency Consultant /",
    "Public Agency Consultant",
    "Principal Place of Business or",
    "Principal Place of Business",
    "Description of Investment",
    "State of Incorporation",
    "Percentage of stock",
    "Transferor Address",
    "Transferor Name",
    "Creditor Address",
    "Outstanding Amount",
    "Interest Rate (%)",
    "Amount of Income",
    "Property Address",
    "Termination Year",
    "Assessed Value",
    "Original Amount",
    "Name of Issuer",
    "Date of Transfer",
    "Business Name",
    "Creditor Name",
    "Mortgage Term",
    "Self-employed",
    "Public Agency",
    "Independent Contractor",
    "Nature of Debt",
    "Date Acquired",
    "Type of Gift",
    "Donor Name",
    "Trust Name",
    "Agency  Name",
    "Agency Name",
    "Position",
    "Address",
    "Income",
    "Owner",
    "Agency",
    "Name",
    "Date",
    "Value",
    "Amount",
    "Description",
]
_PHRASES_SORTED = sorted(COLUMN_PHRASES, key=len, reverse=True)

# Header cells that must never be emitted as a value. The corpus invariant in
# 17_check_sfi_extraction.py asserts this — it is the single check that would
# have caught the "Income" bug on day one.
FORBIDDEN_VALUES = {
    p.strip().lower()
    for p in COLUMN_PHRASES
    + ["Employee", "Employer", "N/A", "Obligor", "Ownership", "Yes", "No", "None"]
}

NONE_RE = re.compile(r"Filer\s+reported\s+none", re.I)
QUESTION_RE = re.compile(r"^\s*(\d{1,2}(?:\.[a-z])?)\.?\s+(?=[A-Z])", re.M)
VALID_Q = {str(i) for i in range(1, 41)} | {"36.a", "37.a"}

_LEGEND_RE = re.compile(
    r"^\s*(Ownership\s+Legend|Filer\s*=\s*F|Spouse/Child\(ren\)\s*=\s*S/C|Trust\s*=\s*T)",
    re.I,
)
_PAGE_RE = re.compile(r"^\s*Page\s+\d+\s+of\s+\d+\s*(Original|Amended)?\s*$", re.I)
_MONEY_RE = re.compile(r"^\s*\$[\d,]+(\s*(to|-)\s*\$?[\d,]+)?\s*(or more)?\s*.?\s*$", re.I)
_OWNERCODE_RE = re.compile(r"^\s*(F|T|S/C)(\s*[,/]\s*(F|T|S/C))*\s*$")
# "Salem, MA, 01970, US" — an address tail, not an entity name.
_ADDRESS_RE = re.compile(r",\s*[A-Z]{2},\s*\d{5}(-\d{4})?,\s*US\s*$")
_NUMERIC_RE = re.compile(r"^[\s\d.,%$/-]*$")
_BARE_TITLE_RE = re.compile(
    r"^(Manager|Employee|Employer|Partner|Owner|Attorney|Lawyer|Consultant"
    r"|Independent\s+Contractor|Self-?employed|Member|President|Vice\s+President"
    r"|Director|Officer|Trustee|Physician|Teacher|Professor|Principal|Agent"
    r"|Sole\s+Proprietor|Realtor|Broker|Nurse|Engineer|Analyst)"
    r"[\s,]*(\$[\d,]+(\s*(to|-)\s*\$?[\d,]+)?(\s*or\s+more)?)?\s*\.?$",
    re.I,
)
# Mortgage term / rate cells extract as runs like "20285.630 yr", "3.7530 yr".
_MEASURE_RE = re.compile(r"^[\d.,\s]+(yr|yrs|years|%)\.?$", re.I)

# A creditor or employer often shares a line with its address, because the
# columns collapse in the extracted text: "GMAC Mortgage P.O. Box 79135,
# Phoenix,". Cut at the point the address starts so the entity survives alone.
_ADDR_START_RE = re.compile(
    r"\s+(?="
    r"P\.?\s?O\.?\s+Box\b"
    r"|Post\s+Office\s+(Box|Sq)"
    r"|\d+\s+[A-Z]"
    # Spelled-out street numbers: "Ten Federal Street". Require an actual
    # street suffix so a company like "One Beacon Insurance" is not truncated.
    r"|(One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve)\s+"
    r"[A-Z][A-Za-z]+\s+"
    r"(Street|St\.?|Avenue|Ave\.?|Road|Rd\.?|Place|Pl\.?|Plaza|Square|Sq\.?"
    r"|Drive|Dr\.?|Way|Lane|Ln\.?|Boulevard|Blvd\.?)\b"
    r")",
    re.I,
)


# The same shapes, anchored, for when an address occupies a line of its own
# ("Ten Federal Street,") and must not be absorbed into the name above it.
_ADDR_LINE_RE = re.compile(
    r"^\s*("
    r"P\.?\s?O\.?\s+Box\b"
    r"|Post\s+Office\s+(Box|Sq)"
    r"|\d+\s+[A-Z]"
    r"|(One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve)\s+"
    r"[A-Z][A-Za-z]+\s+"
    r"(Street|St\.?|Avenue|Ave\.?|Road|Rd\.?|Place|Pl\.?|Plaza|Square|Sq\.?"
    r"|Drive|Dr\.?|Way|Lane|Ln\.?|Boulevard|Blvd\.?)\b"
    r")",
    re.I,
)


# Sometimes the space between name and address is lost entirely, giving
# "SEED Corporation80 Dean Street". Cut at the letter/number seam when what
# follows is unmistakably a street address.
_GLUED_ADDR_RE = re.compile(
    r"(?<=[a-z])(?=\d+\s+[A-Z][A-Za-z]*\s*"
    r"(Street|St\b|Avenue|Ave\b|Road|Rd\b|Drive|Dr\b|Lane|Ln\b|Way\b"
    r"|Boulevard|Blvd\b|Place|Pl\b|Plaza|Square|Sq\b))"
)


def strip_address_tail(s: str) -> str:
    """Drop an address that shares a line with the entity name."""
    m = _ADDR_START_RE.search(s)
    if m and m.start() >= 3:
        return s[: m.start()].rstrip(" ,")
    m = _GLUED_ADDR_RE.search(s)
    if m and m.start() >= 3:
        return s[: m.start()].rstrip(" ,")
    return s


def is_none(section: str) -> bool:
    """True when the filer answered this question with nothing."""
    return bool(NONE_RE.search(section or ""))


def is_header_line(line: str) -> bool:
    """True when a line consists only of known column names.

    Structural rather than enumerated: strip every known column phrase and see
    whether anything meaningful survives. This handles the run-together and
    per-year header variants without listing each one.
    """
    s = line
    for p in _PHRASES_SORTED:
        s = s.replace(p, " ")
    s = re.sub(r"[\s/()%.,:;–—-]+", "", s)
    return s == "" and bool(line.strip())


# The form asks every question, in this order, exactly once.
QUESTION_ORDER = [str(i) for i in range(1, 36)] + [
    "36",
    "36.a",
    "37",
    "37.a",
    "38",
    "39",
    "40",
]


def split_sections(full_text: str) -> dict[str, str]:
    """Question number -> that question's text.

    Two structural rules, both earned from live defects:

    * Truncate at CERTIFICATION. That block contains an "IMPORTANT: 1. 2. 3."
      list whose numbers match the question pattern and would otherwise
      overwrite sections Q1-Q3.

    * Match questions in their known order rather than accepting any number
      that matches. Table data contains lines like "24 Federal Street, Salem",
      which look exactly like a question marker. Scanning in sequence — find
      Q1, then Q2 after it, then Q3 after that — steps straight over them,
      because a stray "24" appearing before Q3 is simply not what we are
      looking for at that point. Anything that merely rejects out-of-order
      markers instead drops every question between the stray and the real one.
    """
    text = re.split(r"\bCERTIFICATION\b", full_text)[0]
    marks = [m for m in QUESTION_RE.finditer(text) if m.group(1) in VALID_Q]

    found: list[tuple[str, int]] = []
    pos = 0  # index into `marks`
    for q in QUESTION_ORDER:
        while pos < len(marks) and marks[pos].group(1) != q:
            pos += 1
        if pos >= len(marks):
            break
        found.append((q, pos))
        pos += 1

    out: dict[str, str] = {}
    for i, (q, mi) in enumerate(found):
        start = marks[mi].end()
        end = marks[found[i + 1][1]].start() if i + 1 < len(found) else len(text)
        out[q] = text[start:end]
    return out


def _is_noise(line: str) -> bool:
    s = line.strip()
    if not s:
        return True
    if _PAGE_RE.match(s) or _LEGEND_RE.match(s):
        return True
    if _MONEY_RE.match(s) or _OWNERCODE_RE.match(s) or _NUMERIC_RE.match(s):
        return True
    if _MEASURE_RE.match(s):
        return True
    if _ADDRESS_RE.search(s):
        return True
    # Address fragments left over when a cell wraps: "AZ, 85062 9135, US",
    # "Moines, IA, 50368 8923,". A 5-digit ZIP beside a state code or "US" is
    # the giveaway; entity names do not look like this.
    if re.search(r"\b\d{5}\b", s) and re.search(r"\b([A-Z]{2}|US)\b", s):
        return True
    # A line that *starts* an address is never an entity name. The extracted
    # column order does not always match the visual one — in the gift tables
    # the donor's address can precede the donor — so without this the address
    # is returned as the donor. "3M Company" and "21st Century Fox" are safe:
    # the pattern needs digits, whitespace, then a capital.
    if _ADDR_LINE_RE.match(s):
        return True
    # Address continuations left when the street line above was dropped:
    # "Suite 4R, Boston, MA,", "Floor, Hartford, CT,".
    if re.match(r"^(Suite|Ste\.?|Floor|Fl\.?|Apt\.?|Unit|Bldg|Building|#)\b", s, re.I):
        return True
    if re.search(r",\s*[A-Z]{2},?\s*$", s):
        return True
    # A bare job title, optionally carrying its income band: "Manager",
    # "Manager $100,001 or more". That is the Position column, not the
    # employer. Deliberately anchored to the whole value so a real company
    # like "Director's Cut LLC" or "Manager Solutions Inc" is untouched.
    if _BARE_TITLE_RE.match(s):
        return True
    if NONE_RE.search(s):
        return True
    if s.lower().startswith(("note:", "original", "amended")):
        return True
    return False


def _answer_items(section: str) -> list[tuple[int, str]]:
    """(source line index, cleaned text) for the filer's answer content.

    Everything before and including the last header line is prompt prose, NOTE
    text, legend, or column names; everything after is the answer.

    The line index is retained so callers can tell whether two surviving values
    were genuinely adjacent in the document or only became adjacent once the
    noise between them was dropped. That distinction separates a wrapped name
    ("Lovely Law" / "Group LLP") from two different records ("GMAC Mortgage" …
    "Citybank Home") whose addresses sat between them.
    """
    if not section or is_none(section):
        return []
    lines = section.splitlines()
    last_header = -1
    for i, line in enumerate(lines):
        if is_header_line(line):
            last_header = i
    if last_header < 0:
        return []  # no table header found — report rather than guess
    out = []
    for i, line in enumerate(lines[last_header + 1 :], start=last_header + 1):
        if _is_noise(line):
            continue
        # Keep a trailing period: it is the signal that an entity name is
        # complete. Stripping it made "Pfizer, Inc." look truncated, so the
        # wrap-join below glued the next cell on: "Pfizer, Inc Common Stock(PFE)".
        s = strip_address_tail(re.sub(r"\s+", " ", line).strip(" þþ"))
        if len(s) < 2:
            continue
        if s.lower() in FORBIDDEN_VALUES:
            continue
        out.append((i, s))
    return out


def answer_lines(section: str) -> list[str]:
    """The filer's answer content for one question, in document order."""
    return [s for _, s in _answer_items(section)]


def answer_text(section: str) -> str:
    """Everything after the last header row, whitespace-collapsed.

    Unlike answer_lines this keeps amounts and addresses. Gift and
    reimbursement records are meaningless without the amount — "WestEd" alone
    loses the $516 — so the disclosure body uses this, while the donor name
    comes from first_entity.
    """
    if not section or is_none(section):
        return ""
    lines = section.splitlines()
    last_header = -1
    for i, line in enumerate(lines):
        if is_header_line(line):
            last_header = i
    if last_header < 0:
        return ""
    body = " ".join(lines[last_header + 1 :])
    body = _PAGE_RE.sub(" ", body)
    return re.sub(r"\s+", " ", body).strip(" .þ")


def first_entity(section: str) -> str:
    """The primary named entity for a question — the employer, issuer, creditor.

    Table cells wrap, so an entity name may span consecutive lines. Join only
    when the two values were adjacent in the source: otherwise the next
    surviving value belongs to a different record whose address happened to be
    filtered out between them.
    """
    items = _answer_items(section)
    if not items:
        return ""
    prev_idx, name = items[0]
    # Names wrap over as many lines as they need: "Tinti Quinn Grover &" /
    # "Sullivan" / "LLP". Keep absorbing while each piece is genuinely the next
    # source line and still looks like part of a name.
    for idx, nxt in items[1:]:
        if idx != prev_idx + 1:
            break  # a different record — its address was filtered out between
        if re.search(r"[.)]$", name):
            break  # already terminated: "Pfizer, Inc."
        # A wrapped *name* never contains digits ("Group LLP", "Equity"); an
        # address continuation almost always does ("AZ, 85062 9135, US").
        if (
            not re.match(r"^[A-Za-z(&]", nxt)
            or len(nxt) >= 40
            or re.search(r"\d", nxt)
            or _ADDRESS_RE.search(nxt)
            or _ADDR_LINE_RE.match(nxt)  # "Ten Federal Street," on its own line
        ):
            break
        joined = f"{name} {nxt}".strip()
        if len(joined) > 90:
            break
        name, prev_idx = joined, idx
    return name if name.lower() not in FORBIDDEN_VALUES else ""


def entities(section: str, limit: int = 25) -> list[str]:
    """Every candidate entity string for a question, de-duplicated in order."""
    seen, out = set(), []
    for s in answer_lines(section):
        k = s.lower()
        if k in seen or k in FORBIDDEN_VALUES:
            continue
        seen.add(k)
        out.append(s)
        if len(out) >= limit:
            break
    return out
