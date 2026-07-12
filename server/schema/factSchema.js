export const factSchema = {
  name: "fact_list",
  strict: true,
  schema: {
    type: "object",
    properties: {
      facts: {
        type: "array",
        items: {
          type: "object",
          properties: {
            fact: {
              type: "string",
              description: "Một đơn vị kiến thức độc lập."
            },
            category: {
              type: "string",
              enum: [
                "Definition",
                "Diagnosis",
                "Treatment",
                "Guideline",
                "Mechanism",
                "Classification",
                "Complication",
                "Drug",
                "Laboratory",
                "Prognosis",
                "Other"
              ]
            },
            importance: {
              type: "integer",
              minimum: 1,
              maximum: 10
            }
          },
          required: [
            "fact",
            "category",
            "importance"
          ],
          additionalProperties: false
        }
      }
    },
    required: [
      "facts"
    ],
    additionalProperties: false
  }
};