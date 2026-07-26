# Calculator Evidence And Source Provenance

Calculator authority is bound to the versioned implementation registry, not to an editable Calculator record.

## Model

`Calculator topic -> method -> optional variant -> implementation version -> evidence profile`

Each profile has immutable code-owned evidence records, verification flags and reference fixtures. Evidence records support an original derivation, authoritative specification, guideline, validation or fixture role. A public page shows only citation, version, authoritative organisation and verification date; it does not expose internal notes or repository paths.

## Publication gate

An implementation must have an authoritative verified source, all transcription/unit/boundary/source-consistency checks, and at least one approved clinical reference fixture. Synthetic fixtures never satisfy this gate. A conflicted evidence profile blocks publication.

The admin checkbox only confirms the editable Calculator record. It cannot mark a method's formula, coefficients, units, population, source identity or fixture verification as verified.

## Versioning

Scientific changes use a new `methodKey`; code-only corrections use semantic `implementationVersion`. Historical calculation snapshots retain `primaryEvidenceId` and `sourceVersion` alongside method, variant, inputs and output.

## Current scope

Evidence metadata is code-owned and no database migration is introduced by this change. New production methods must be added to `client/src/modules/calculators/evidenceRegistry.ts` with reviewed primary evidence and a non-synthetic fixture before their implementation status can be published.
