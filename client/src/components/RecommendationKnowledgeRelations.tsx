import { Link2, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import SharedSelect, { type SharedSelectOption } from "./SharedSelect.tsx";
import { listAdminCalculators } from "../services/calculatorDatabaseService.ts";
import { listAdminDrugs } from "../services/drugDatabaseService.ts";
import {
  calculatorRelationTypes,
  createRecommendationCalculatorRelation,
  createRecommendationDrugRelation,
  deleteRecommendationCalculatorRelation,
  deleteRecommendationDrugRelation,
  drugRelationTypes,
  listRecommendationRelations,
} from "../services/knowledgeRelationService.ts";
import type { RecommendationCalculatorRelation, RecommendationDrugRelation } from "../services/knowledgeRelationRepository.ts";

interface Props { recommendationId: string; actorId: string; onError: (message: string) => void; onSuccess: (message: string) => void }

function errorText(error: unknown) { return error instanceof Error ? error.message : "Không thể cập nhật liên kết."; }

const drugRelationOptions: SharedSelectOption[] = drugRelationTypes.map((value) => ({ value, label: value }));
const calculatorRelationOptions: SharedSelectOption[] = calculatorRelationTypes.map((value) => ({ value, label: value }));

export default function RecommendationKnowledgeRelations({ recommendationId, actorId, onError, onSuccess }: Props) {
  const [drugs, setDrugs] = useState<Array<{ id: string; titleVi: string; genericName: string }>>([]);
  const [calculators, setCalculators] = useState<Array<{ id: string; slug: string; short_name: string; name: { vi?: string; en?: string } }>>([]);
  const [drugRelations, setDrugRelations] = useState<RecommendationDrugRelation[]>([]);
  const [calculatorRelations, setCalculatorRelations] = useState<RecommendationCalculatorRelation[]>([]);
  const [drugId, setDrugId] = useState("");
  const [calculatorId, setCalculatorId] = useState("");
  const [drugType, setDrugType] = useState(drugRelationTypes[0]);
  const [calculatorType, setCalculatorType] = useState(calculatorRelationTypes[0]);
  const [context, setContext] = useState("");
  const [order, setOrder] = useState("0");
  const [loading, setLoading] = useState(true);
  const callbacks = useRef({ onError, onSuccess });
  useEffect(() => { callbacks.current = { onError, onSuccess }; }, [onError, onSuccess]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [relations, nextDrugs, nextCalculators] = await Promise.all([listRecommendationRelations(recommendationId), listAdminDrugs(), listAdminCalculators()]);
      setDrugRelations(relations.drugs);
      setCalculatorRelations(relations.calculators);
      setDrugs(nextDrugs.map((item) => ({ id: item.id, titleVi: item.titleVi, genericName: item.genericName })));
      setCalculators(nextCalculators.map((item) => ({ id: item.id, slug: item.slug, short_name: item.short_name, name: item.name || {} })));
    } catch (error) { callbacks.current.onError(errorText(error)); }
    finally { setLoading(false); }
  }, [recommendationId]);
  useEffect(() => { void load(); }, [load]);

  const metadata = { context_text: context, display_order: Number(order || 0), source_location: "" };
  async function addDrug() {
    if (!drugId) return onError("Chọn thuốc trước khi thêm liên kết.");
    try { await createRecommendationDrugRelation(actorId, { recommendationId, drugId, relationType: drugType, ...metadata }); setDrugId(""); setContext(""); await load(); onSuccess("Đã thêm liên kết với Thuốc."); }
    catch (error) { onError(errorText(error)); }
  }
  async function addCalculator() {
    if (!calculatorId) return onError("Chọn Calculator trước khi thêm liên kết.");
    try { await createRecommendationCalculatorRelation(actorId, { recommendationId, calculatorId, relationType: calculatorType, ...metadata }); setCalculatorId(""); setContext(""); await load(); onSuccess("Đã thêm liên kết với Calculator."); }
    catch (error) { onError(errorText(error)); }
  }
  async function removeDrug(id: string) {
    if (!window.confirm("Xóa liên kết với thuốc?")) return;
    try { await deleteRecommendationDrugRelation(id); await load(); onSuccess("Đã xóa liên kết với Thuốc."); }
    catch (error) { onError(errorText(error)); }
  }
  async function removeCalculator(id: string) {
    if (!window.confirm("Xóa liên kết với calculator?")) return;
    try { await deleteRecommendationCalculatorRelation(id); await load(); onSuccess("Đã xóa liên kết với Calculator."); }
    catch (error) { onError(errorText(error)); }
  }

  const drugOptions = drugs
    .filter((item) => !drugRelations.some((relation) => relation.drug_id === item.id && relation.status === "active"))
    .map((item) => ({ value: item.id, label: item.titleVi || item.genericName, description: item.genericName || undefined }));
  const calculatorOptions = calculators
    .filter((item) => !calculatorRelations.some((relation) => relation.calculator_id === item.id && relation.status === "active"))
    .map((item) => ({ value: item.id, label: item.name.vi || item.name.en || item.short_name || item.slug, description: item.slug }));

  return <section className="mt-4 rounded-2xl border border-violet-100 bg-violet-50/35 p-4">
    <div className="flex items-center gap-2"><Link2 size={17} className="text-violet-700" /><h3 className="text-sm font-extrabold text-slate-800">Liên kết tri thức</h3></div>
    <p className="mt-1 text-xs font-semibold text-slate-500">Liên kết qua Recommendation, không tạo quan hệ trực tiếp Drug ↔ Guideline hoặc Calculator ↔ Guideline.</p>
    {loading ? <p className="mt-3 text-xs font-semibold text-slate-500">Đang tải liên kết...</p> : <>
      <RelationPickerRow label="Thuốc" value={drugId} options={drugOptions} relationValue={drugType} relationOptions={drugRelationOptions} context={context} onValueChange={setDrugId} onRelationChange={(value) => setDrugType(value as (typeof drugRelationTypes)[number])} onContextChange={setContext} onAdd={() => void addDrug()} addLabel="Thêm thuốc" />
      <RelationList title="Thuốc đã liên kết" items={drugRelations} names={new Map(drugs.map((item) => [item.id, `${item.titleVi} · ${item.genericName}`]))} keyOf={(item) => item.drug_id} onRemove={removeDrug} />
      <RelationPickerRow label="Máy tính" value={calculatorId} options={calculatorOptions} relationValue={calculatorType} relationOptions={calculatorRelationOptions} context={context} onValueChange={setCalculatorId} onRelationChange={(value) => setCalculatorType(value as (typeof calculatorRelationTypes)[number])} onContextChange={setContext} onAdd={() => void addCalculator()} addLabel="Thêm máy tính" order={order} onOrderChange={setOrder} />
      <RelationList title="Máy tính đã liên kết" items={calculatorRelations} names={new Map(calculators.map((item) => [item.id, item.name.vi || item.name.en || item.short_name || item.slug]))} keyOf={(item) => item.calculator_id} onRemove={removeCalculator} />
    </>}
  </section>;
}

function RelationPickerRow({ label, value, options, relationValue, relationOptions, context, onValueChange, onRelationChange, onContextChange, onAdd, addLabel, order, onOrderChange }: { label: string; value: string; options: SharedSelectOption[]; relationValue: string; relationOptions: SharedSelectOption[]; context: string; onValueChange: (value: string) => void; onRelationChange: (value: string) => void; onContextChange: (value: string) => void; onAdd: () => void; addLabel: string; order?: string; onOrderChange?: (value: string) => void }) {
  return <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(0,1fr)_180px_150px_auto]">
    <SharedSelect value={value} options={options} onValueChange={onValueChange} ariaLabel={`Chọn ${label}`} placeholder={`Chọn ${label.toLocaleLowerCase("vi")}`} searchable emptyMessage={`Không còn ${label.toLocaleLowerCase("vi")} phù hợp.`} />
    <SharedSelect value={relationValue} options={relationOptions} onValueChange={onRelationChange} ariaLabel="Loại quan hệ" />
    {onOrderChange ? <label className="flex items-center gap-2 text-xs font-semibold text-slate-500"><input value={order} onChange={(event) => onOrderChange(event.target.value)} type="number" min="0" className="h-11 w-20 rounded-xl border border-slate-200 bg-white px-3 text-sm" title="Thứ tự hiển thị" />Thứ tự</label> : <input value={context} onChange={(event) => onContextChange(event.target.value)} placeholder="Bối cảnh / ghi chú" className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm" />}
    <button type="button" onClick={onAdd} className="rounded-xl bg-violet-600 px-3 text-sm font-bold text-white">{addLabel}</button>
  </div>;
}

function RelationList<T extends { id: string; relation_type: string; context_text: string; status: string }>({ title, items, names, keyOf, onRemove }: { title: string; items: T[]; names: Map<string, string>; keyOf: (item: T) => string; onRemove: (id: string) => Promise<void> }) {
  return <div className="mt-3"><p className="text-xs font-extrabold text-slate-700">{title}</p>{items.length ? <div className="mt-2 grid gap-2">{items.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2"><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-700">{names.get(keyOf(item)) || keyOf(item)}</p><p className="text-xs font-semibold text-slate-500">{item.relation_type}{item.context_text ? ` · ${item.context_text}` : ""}</p></div><button type="button" onClick={() => void onRemove(item.id)} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50" title="Xóa liên kết"><Trash2 size={15} /></button></div>)}</div> : <p className="mt-2 text-xs font-semibold text-slate-400">Chưa có liên kết.</p>}</div>;
}
