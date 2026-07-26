import type { CalculatorExecution, CalculatorImplementation, CalculatorResultSnapshot, CalculatorTopicDefinition } from "./platformTypes.ts";
import { calculatorEvidenceFor, isEvidencePublishable } from "./evidenceRegistry.ts";

function compareSemanticVersions(left: string, right: string): number {
  const parse = (value: string) => value.split("-")[0].split(".").map((part) => Number(part) || 0);
  const leftParts = parse(left);
  const rightParts = parse(right);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (difference !== 0) return difference;
  }

  return left.localeCompare(right);
}

export class CalculatorMethodRegistry {
  private readonly implementations = new Map<string, CalculatorImplementation>();
  private readonly topics = new Map<string, CalculatorTopicDefinition>();

  registerTopic(topic: CalculatorTopicDefinition): void {
    if (this.topics.has(topic.topicKey)) throw new Error(`Calculator topic trùng: ${topic.topicKey}.`);
    this.topics.set(topic.topicKey, { ...topic, enabledMethodKeys: [...topic.enabledMethodKeys] });
  }

  register(implementation: CalculatorImplementation): void {
    const key = this.identity(implementation.topicKey, implementation.methodKey, implementation.variantKey, implementation.implementationVersion);
    if (this.implementations.has(key)) throw new Error(`Calculator implementation trùng: ${key}.`);
    // Source authority is resolved from immutable code-owned evidence metadata, never from Admin payloads.
    this.implementations.set(key, Object.freeze({ ...implementation, evidence: calculatorEvidenceFor(implementation) }));
  }

  getTopic(topicKey: string): CalculatorTopicDefinition | undefined { return this.topics.get(topicKey); }

  listTopics(): CalculatorTopicDefinition[] { return [...this.topics.values()]; }

  listMethods(topicKey: string, includeRetired = false): CalculatorImplementation[] {
    return [...this.implementations.values()].filter((item) => item.topicKey === topicKey && (includeRetired || item.status !== "retired"));
  }

  get(topicKey: string, methodKey: string, variantKey?: string, implementationVersion?: string): CalculatorImplementation | undefined {
    const candidates = this.listMethods(topicKey, true).filter((item) => item.methodKey === methodKey && (variantKey === undefined || item.variantKey === variantKey));
    return implementationVersion
      ? candidates.find((item) => item.implementationVersion === implementationVersion)
      : candidates.sort((a, b) => compareSemanticVersions(b.implementationVersion, a.implementationVersion))[0];
  }

  evidenceFor(implementation: CalculatorImplementation) {
    return implementation.evidence || calculatorEvidenceFor(implementation);
  }

  calculate(topicKey: string, methodKey: string, input: Record<string, unknown>, variantKey?: string, implementationVersion?: string): ReturnType<CalculatorImplementation["calculate"]> {
    return this.calculateWithSnapshot(topicKey, methodKey, input, variantKey, implementationVersion).result;
  }

  calculateWithSnapshot(topicKey: string, methodKey: string, input: Record<string, unknown>, variantKey?: string, implementationVersion?: string): CalculatorExecution {
    const implementation = this.get(topicKey, methodKey, variantKey, implementationVersion);
    if (!implementation) throw new Error("Không tìm thấy phương thức hoặc phiên bản Calculator.");
    if (!implementation.source.verified || isEvidencePublishable(this.evidenceFor(implementation)).length > 0) throw new Error("Phương thức chưa được xác minh nguồn nên chưa thể tính.");
    if (implementation.status === "retired") throw new Error("Phương thức đã ngừng sử dụng cho lượt tính mới.");
    if (implementation.status === "draft") throw new Error("Phương thức đang là bản nháp.");
    const validation = implementation.validate(input);
    if (!validation.valid || !validation.value) throw new Error(validation.errors.join(" ") || "Dữ liệu đầu vào không hợp lệ.");
    const normalizedInput = implementation.normalize(validation.value);
    const result = implementation.calculate(normalizedInput);
    const evidence = this.evidenceFor(implementation);
    return { result: { ...result, primaryEvidenceId: evidence.primaryEvidenceId, sourceVersion: evidence.sourceVersion }, snapshot: this.snapshot({ ...result, primaryEvidenceId: evidence.primaryEvidenceId, sourceVersion: evidence.sourceVersion }, input, normalizedInput) };
  }

  snapshot(result: ReturnType<CalculatorImplementation["calculate"]>, input: Record<string, unknown>, normalizedInput: Record<string, unknown> = input): CalculatorResultSnapshot {
    return {
      calculatorTopicKey: result.calculatorTopicKey,
      methodKey: result.methodKey,
      variantKey: result.variantKey,
      implementationVersion: result.implementationVersion,
      calculationModelType: result.calculationModelType,
      formulaName: result.formulaName,
      formulaYear: result.formulaYear,
      primaryEvidenceId: result.primaryEvidenceId,
      sourceVersion: result.sourceVersion,
      inputSnapshot: structuredClone(input),
      normalizedInputSnapshot: structuredClone(normalizedInput),
      rawResult: result.primary.rawValue,
      displayResult: result.primary.displayValue,
      outputMetric: result.primary.metric,
      outputUnit: result.primary.unit,
      indexingStatus: result.primary.indexingStatus,
      calculatedAt: new Date().toISOString(),
    };
  }

  private identity(topicKey: string, methodKey: string, variantKey: string | undefined, version: string): string {
    return [topicKey, methodKey, variantKey || "default", version].join(":");
  }
}

export const calculatorMethodRegistry = new CalculatorMethodRegistry();
