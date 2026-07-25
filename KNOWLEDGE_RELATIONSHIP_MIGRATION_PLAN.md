# Knowledge Relationship Migration Plan

1. Back up `calculator_guideline_references`, `guideline_entries`, and any local Drug export before staging execution.
2. Run existing Guideline Core migrations already required by the environment. Do not rerun executed migrations.
3. Run `calculator_guideline_core_reference_migration.sql` only after its explicit legacy mapping preflight succeeds.
4. Run `knowledge_relationship_foundation_migration.sql`, which creates `drugs`, `recommendation_drug_references`, `recommendation_calculator_references`, their indexes, RLS policies and the public Drug-preview RPC.
5. The migration preflight aborts if it finds active legacy relationship data that cannot be mapped by explicit UUID mapping.
6. No legacy table is deleted. No clinical relationship is inferred.

Rollback is object-level and additive: drop only new RLS policies, triggers, relation tables, and `drugs` if they have not accepted real data. Never roll back by deleting legacy Guideline or Calculator records.
