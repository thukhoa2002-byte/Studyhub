# Calculator Content Pack V2

## Scope implemented locally

The existing Calculator Registry, Evidence Registry, database adapter, shared
input renderer and public result surface are reused. No SQL migration, deploy,
merge or formula storage in the database is included in this pack.

## Enabled methods

| Topic | Method | Version | Status |
| --- | --- | --- | --- |
| Atrial fibrillation thromboembolic risk | `cha2ds2_vasc` | `1.0.0` | Published in Registry |
| Bleeding risk | `has_bled` | `1.0.0` | Published in Registry |
| Community-acquired pneumonia severity | `curb_65` | `1.0.0` | Published in Registry |
| Sepsis bedside risk | `qsofa` | `1.0.0` | Published in Registry |

Each enabled method has immutable code-owned source metadata, an evidence
profile and a clinical reference fixture. The public result includes a
criterion-by-criterion breakdown, total score, interpretation, limitations and
source metadata.

## Registered but source-gated

| Topic | Method(s) | Reason |
| --- | --- | --- |
| Acute chest pain | `heart_score` | Original authoritative score source and approved reference fixture still need confirmation. |
| Corrected QT | `qtc_bazett`, `qtc_fridericia`, `qtc_framingham`, `qtc_hodges` | Each method requires independently verified formula source and reference fixture. |
| Upper gastrointestinal bleeding | `glasgow_blatchford` | Full sex-specific threshold table and reference fixtures are not approved in this repository. |
| Liver severity | `meld_original` | The project has not selected and verified one MELD variant. |

Source-gated methods are draft, have no enabled default method and fail the
existing evidence/publication gate. They cannot be calculated as a new
calculation or published from Admin.

## Clinical boundaries retained

- CURB-65: Ure threshold is strictly greater than 7 mmol/L; respiratory rate
  starts at 30/min; systolic pressure is below 90 mmHg or diastolic pressure is
  at or below 60 mmHg; age starts at 65 years.
- qSOFA: respiratory rate starts at 22/min and systolic pressure is at or below
  100 mmHg. It is labelled as a risk screen, not a diagnosis.
- CHA2DS2-VASc: age 65-74 and age 75 or over are mutually exclusive.
- HAS-BLED: renal/liver and drugs/alcohol remain distinct criteria.

No treatment, admission, discharge, anticoagulation or drug-alert rule is
hardcoded in this content pack. Guidance remains linked through canonical
Recommendations.

## Source notes

Evidence metadata references the primary score publications held in the
Registry. The automated browsing channel was unavailable during this local
implementation, so methods without a complete repository-approved source and
fixture were intentionally kept source-gated rather than inferred or enabled.
