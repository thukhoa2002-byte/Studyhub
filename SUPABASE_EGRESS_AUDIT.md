# Supabase Egress Audit And Reduction

Date: 2026-07-26

## Scope

This audit covers active browser paths for public Guideline, Thuốc, Máy tính y khoa, shared knowledge relations, dashboard analytics, deck refresh, and document URL access. It does not change database schema, RLS, migrations, or deployment configuration.

## High-risk findings and changes

| Area | Prior behavior | Change | Expected effect |
| --- | --- | --- | --- |
| Public Guideline Core | One document query followed by one section and one recommendation query per Guideline | Batch section and recommendation reads by Guideline IDs | Reduces reads from `1 + 2N` to three requests for a catalog load |
| Thuốc catalog | Re-read published data while the user types a search phrase | Fetch compact preview DTO once, filter local list | Removes one request per search change and avoids full drug content in catalog payload |
| Calculator catalog | Re-read preview RPC on every search/filter change | Fetch preview once, filter local list | Removes one request per filter change |
| Drug and Calculator lists | List views selected full records, including configuration/content fields not used by cards | Explicit list and detail projections, list cap of 200 | Smaller list payloads; details stay on demand |
| Guideline and relation repositories | Several active reads used wildcard projections | Explicit columns and bounded list reads | Stable response shape and lower unnecessary payload |
| Sidebar analytics | Presence, summary and detail data remained active more broadly than required | Presence only when visible/open; summary every 60 seconds; details on panel open | Reduces realtime and analytics traffic |
| Deck refresh | Notifications and deck list refreshed every 15 seconds in background tabs | 60-second refresh, skip hidden tab, retain focus/visibility refresh | About 75% fewer periodic requests while active and none while hidden |
| Signed Storage URLs | New signed URL generated each time a document/book was opened | In-memory TTL cache: 55 minutes for books, 4 minutes for legacy guideline files | Avoids repeated Storage signing for the same asset |
| Guideline import status | Polling fetched full import job every 1.8 seconds | Status-only DTO every 5 seconds and full record only at terminal state | Material reduction for long imports |

## Active query policy

- Public catalog endpoints return compact previews only.
- Detail pages resolve full record data only after an explicit open/deep link.
- Public Guideline loading excludes provenance, source documents, diagnostics and review fields.
- Calculator list payload excludes formula inputs, fixtures and evidence JSON.
- Drug list payload excludes the `content` JSON body.
- Relation reads use explicit relation columns.

## Remaining audit items

The following legacy/admin-heavy modules still use wildcard projections and should be handled in a later, separately verified pass because their full editor workflows depend on complete records:

- legacy `client/src/services/guidelines.ts` and `guideline_entries`
- Reference Book editor/OCR records
- MCQ library editor
- Reference tools editor

These are not used by the public Guideline, Drug or Calculator catalogs optimized in this pass. No data is exposed or changed by this audit.

## Operational checks

Use Supabase Dashboard usage to compare egress over a 24-hour period before and after release. In browser Network, confirm catalog requests call preview RPCs, while detail records load only after opening a card. Development-only request logging should remain disabled in production.

## Acceptance criteria

- Public catalog search and filters make no additional Supabase requests after initial preview load.
- Hidden tabs do not issue deck, notification, or analytics poll requests.
- Opening the same protected document repeatedly during the TTL does not request a new signed URL.
- Public Guideline catalog no longer issues a request pair per individual Guideline.
