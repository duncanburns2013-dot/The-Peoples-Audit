"""Rebuild ma-sfi-tempus.json with verified identities + PCA framing."""
from __future__ import annotations

import csv
import datetime as dt
import json
from pathlib import Path

OUT = Path(r"C:\Users\dunca\The-Peoples-Audit\public\data\ma-sfi-tempus.json")
PASS2 = Path(r"C:\PeoplesAudit\out\crossref\pass2_doge_entity_in_sfi.csv")

VERIFIED_IDENTITIES = {
    ("Reardon", "James G"): {
        "fullName": "Hon. James Gavin Reardon Jr.",
        "title": "Associate Justice, MA Superior Court",
        "role": "Worcester County Presiding Justice",
        "branch": "Judiciary",
        "appointedBy": "Gov. Charlie Baker (2016)",
        "source": "https://www.mass.gov/news/governor-baker-nominates-three-to-the-massachusetts-superior-court",
    },
    ("Barrett", "James A"): {
        "fullName": "James A. Barrett",
        "title": "Deputy Commissioner of Depository Institutions Supervision",
        "role": "MA Division of Banks (DOB/OCABR)",
        "branch": "Executive (DOB)",
        "appointedBy": None,
        "source": "https://www.mass.gov/news/massachusetts-division-of-banks-appoints-deputy-commissioner-and-general-counsel-0",
        "note": "Most-likely identity match by work-email domain; middle-initial 'A' not directly visible in public records.",
    },
    ("Sacramone", "Ralph V"): {
        "fullName": "Ralph V. Sacramone",
        "title": "Executive Director",
        "role": "MA Alcoholic Beverages Control Commission (ABCC)",
        "branch": "State Treasurer's Office",
        "appointedBy": None,
        "source": "https://www.mass.gov/info-details/alcoholic-beverages-control-commission-staff-directory-abcc",
    },
    ("Marsi Jr", "John J"): {
        "fullName": "Rep. John J. Marsi Jr. (R)",
        "title": "State Representative",
        "role": "6th Worcester District (Charlton, Dudley, Southbridge, Spencer Pct. 1)",
        "branch": "MA House of Representatives",
        "appointedBy": "Special election March 5, 2024",
        "source": "https://malegislature.gov/Legislators/Profile/JJM1/District",
    },
    ("Travers", "Jeffrey T"): {
        "fullName": "Jeffrey T. Travers",
        "title": "Deputy CIO (Acting CIO 2022)",
        "role": "Executive Office of the MA Trial Court",
        "branch": "Judiciary (cross-domain account possible)",
        "appointedBy": None,
        "source": "https://rocketreach.co/jeff-travers-email_82831322",
        "note": "Soft-confirm: Jeff.Travers@mass.gov uses Executive domain but Trial Court role is the most-likely public record.",
    },
    ("Rinella", "Matthew P"): {
        "fullName": "Matthew P. Rinella",
        "title": "Director, Accounting & Financial Reporting",
        "role": "MassDOT Finance / Office of the CFO",
        "branch": "MassDOT",
        "appointedBy": None,
        "source": "MassDOT directory (LinkedIn / RocketReach)",
    },
    ("Gomez", "Carmen Z"): {
        "fullName": "Dr. Carmen Z. Gomez, PhD",
        "title": "Deputy Commissioner of Pretrial Services",
        "role": "MA Probation Service / MA Trial Court (27-year tenure)",
        "branch": "Judiciary",
        "appointedBy": None,
        "source": "https://www.mass.gov/news/carmen-gomez-is-appointed-deputy-commissioner-of-pretrial-services-for-the-massachusetts-probation-service",
    },
    ("Valentine", "Teri W"): {
        "fullName": "Teri Williams Valentine",
        "title": "Former Director, Special Education Planning & Policy (DESE 2002–~2017)",
        "role": "Now Senior Program Associate, WestEd",
        "branch": "DESE (former)",
        "appointedBy": None,
        "source": "https://www.wested.org/personnel/teri-williams-valentine/",
    },
}


def main() -> int:
    by_filer: dict[tuple, dict] = {}
    raw_rows: list[dict] = []
    with PASS2.open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if "TEMPUS" not in row["doge_entity"].upper():
                continue
            key = (row["sfi_last"], row["sfi_first"])
            raw_rows.append(row)
            if key not in by_filer:
                ident = VERIFIED_IDENTITIES.get(key, {
                    "fullName": f"{row['sfi_first']} {row['sfi_last']}",
                    "title": "(identity verification pending)",
                    "role": "",
                    "branch": "",
                    "source": "",
                })
                by_filer[key] = {
                    "filerLast": row["sfi_last"],
                    "filerFirst": row["sfi_first"],
                    "filerEmail": row["sfi_email"],
                    **ident,
                    "years": [],
                }
            by_filer[key]["years"].append({
                "year": row["sfi_year"],
                "pdf": row["sfi_path"].replace("\\", "/"),
                "sfiSection": row["sfi_question"],
            })

    # Sort years
    for r in by_filer.values():
        r["years"].sort(key=lambda y: y["year"])

    payload = {
        "fetchedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "version": "v1-locked",
        "headline": (
            "Nine Massachusetts public officials, across the Judiciary, the "
            "House, the executive branch, the Treasury, MassDOT, and DESE, "
            "disclosed in their own annual Statements of Financial Interest "
            "2019–2025 that a spouse or household dependent received income "
            "through the MassHealth Personal Care Attendant program, with "
            "Tempus Unlimited, Inc. as the Fiscal/Employer Agent."
        ),
        "framing": (
            "This is a structural household-income finding, not a fraud "
            "finding. Tempus is the sole statewide MassHealth PCA Fiscal "
            "Intermediary by program design; MassHealth members are the "
            "legal employers of record and Tempus issues W-2s on the "
            "members' behalf. The PCA program cost MA ~$1.75B in FY2024 "
            "and is the most rapidly-growing line in the MassHealth budget."
        ),
        "method": (
            "Word-boundary substring match of 'Tempus Unlimited' in the "
            "Q7 (Spouse Business Employment) section text of every SFI "
            "filing 2019–2025. All 28 hits independently re-verified by "
            "live PDF text extraction (see audit-scripts/sfi/09_verify_"
            "tempus.py + data/sfi/verify/tempus_verified.md)."
        ),
        "totalDisclosures": len(raw_rows),
        "uniqueFilers": len(by_filer),
        "dogeReference": "https://github.com/duncanburns2013-dot/HHS-MA-DOGE",
        "tempusContext": {
            "ein": "04-2239746",
            "principalOffice": "600 Technology Center Drive, Stoughton, MA 02072",
            "incorporationDate": "1952-06-20",
            "ceoName": "Larry Spencer",
            "ceoComp_FY2024": 441995,
            "fy2024Revenue": 2127242202,
            "fy2024Expenses": 2124669486,
            "fy2024NetSurplus": 2572716,
            "preRenameLegalName": "Cerebral Palsy of Massachusetts, Inc.",
            "renameApprovedDate": "2016-12",
            "renameAnnouncedDate": "2017-04-10",
            "npisAtAddress_dogeCount": 7,
            "npisAtAddress_nppesCount": 10,
            "cumulativeSpending_2018_2024": 6620437058.40,
            "annualPcaProgramSpend_FY2024": 1750000000,
            "role": "Sole statewide MassHealth PCA Fiscal Intermediary",
            "sources": [
                "https://www.mass.gov/info-details/masshealth-personal-care-attendant-pca-fiscal-intermediary-tempus",
                "https://projects.propublica.org/nonprofits/organizations/42239746",
                "https://npiregistry.cms.hhs.gov/api/?version=2.1&organization_name=TEMPUS*&state=MA",
                "https://www.facebook.com/MASSCP/posts/1640418735988146/",
            ],
        },
        "pcaProgramMechanics": {
            "employerOfRecord": "MassHealth member (the consumer)",
            "fiscalAgent": "Tempus Unlimited, Inc.",
            "w2Issuer": "Tempus, on member's behalf",
            "fboMeaning": "'For Benefit Of [member name]' = PCA paid to provide care to that specific MassHealth recipient.",
            "familyHiringRule": "Adult children, parents of adult children, sons-in-law, daughters-in-law of the consumer MAY be paid PCAs. Spouse, parent of a minor consumer, surrogate, and legally responsible relative are PROHIBITED.",
            "familyHiringSource": "130 CMR 422.402 + PCA-15 bulletin",
        },
        "rinellaFboNote": (
            "Matthew Rinella's 2019 + 2020 Q7 entries literally read "
            "'TEMPUS UNLIMITED, INC., FBO MELISSA RAFFERTY'. Per PCA "
            "regulations, the consumer's spouse cannot be a paid PCA, "
            "so Melissa Rafferty is necessarily a third-party MassHealth "
            "recipient (a non-spouse relative whose personal care is "
            "provided by Rinella's spouse and billed through Tempus)."
        ),
        "rows": list(by_filer.values()),
    }

    OUT.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {OUT}")
    print(f"  {len(raw_rows)} disclosures, {len(by_filer)} unique filers")
    print(f"  verified identities: {sum(1 for k in by_filer if k in VERIFIED_IDENTITIES)}/{len(by_filer)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
