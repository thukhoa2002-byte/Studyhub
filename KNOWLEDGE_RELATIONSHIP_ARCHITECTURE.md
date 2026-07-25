# Knowledge Relationship Architecture

## Canonical graph

```text
guideline_documents
  -> guideline_sections
    -> guideline_recommendations
       <-> recommendation_drug_references <-> drugs
       <-> recommendation_calculator_references <-> calculators
```

`guideline_recommendations` is the sole active clinical relation target. Guideline and section context are derived through the Recommendation rather than duplicated in relation records.

## Relation metadata

Both relation tables store a constrained machine `relation_type`, localized/free text context, source location, display order, active status and audit metadata. A unique key prevents duplicate active meanings for the same pair and relation type.

## Runtime boundary

React components call `drugDatabaseService`, `calculatorDatabaseService` or
`knowledgeRelationService`. Only repositories call Supabase. The shared
`RecommendationKnowledgeRelations` picker is rendered after a Recommendation
exists, so its UUID is always canonical. Drug and Calculator pages perform
reverse lookup through the Recommendation and derive Guideline/Section there.

## Visibility

A normal authenticated user can read a relation only when its relation status is active, Recommendation is reviewed/published, parent Guideline and Section are public-eligible, and the linked Drug or Calculator is published. Guests receive preview DTOs only and never relation context or protected content.

## Legacy policy

Legacy rows remain queryable only through legacy read paths where required for compatibility. They are not edited through the normalized relation UI. An ambiguous legacy row blocks migration and is reported for manual mapping.
