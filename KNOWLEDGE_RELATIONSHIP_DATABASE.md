# Knowledge Relationship Database Design

## `drugs`

Canonical UUID-backed drug entity. It carries a stable slug, lifecycle status, source verification and a JSONB content payload matching the existing Drug model while structured sub-tables are deferred.

`list_public_drug_previews()` exposes only id, slug, display identity, class,
specialties, status and publication timestamp to anonymous visitors. It never
returns the JSONB detail payload.

## `recommendation_drug_references`

- `recommendation_id uuid references guideline_recommendations(id) on delete restrict`
- `drug_id uuid references drugs(id) on delete cascade`
- constrained `relation_type`
- `context_text`, `source_location`, `display_order`, `status`
- `created_by`, timestamps
- unique `(recommendation_id, drug_id, relation_type) nulls not distinct`

## `recommendation_calculator_references`

- `recommendation_id uuid references guideline_recommendations(id) on delete restrict`
- `calculator_id uuid references calculators(id) on delete cascade`
- constrained `relation_type`
- same metadata and uniqueness policy as Drug relations

Deleting a Recommendation is restricted while active relations exist. Deleting a Drug or Calculator cascades only its relation rows. Published entities should be archived through services rather than hard-deleted.
