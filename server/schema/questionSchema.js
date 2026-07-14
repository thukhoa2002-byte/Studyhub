export const questionSchema = {
  name: "question_list",
  strict: true,
  schema: {
    type: "object",
    properties: {
      title: {
        type: "string"
      },
      questions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            question: {
              type: "string"
            },
            answer: {
              type: "string"
            },
            category: {
              type: "string"
            },
            importance: {
              type: "integer"
            }
          },
          required: [
            "question",
            "answer",
            "category",
            "importance"
          ],
          additionalProperties: false
        }
      }
    },
    required: [
      "title",
      "questions"
    ],
    additionalProperties: false
  }
};
