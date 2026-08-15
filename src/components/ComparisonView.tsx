import {
	InfoIcon,
	MagnifyingGlassIcon,
	PlusIcon,
	WarningIcon,
	XIcon,
} from "@phosphor-icons/react";
import { useAtomValue } from "jotai";
import { useEffect, useMemo, useState } from "react";
import { STAT_ORDER, TypeIcon } from "#/lib/constants";
import {
	answeredComplianceRequirementsAtom,
	auditAssessmentsAtom,
	businessProcessIdAtom,
	createAuditAssessment,
	fetchValuesForAssessment,
	getComplianceRequirementsForElement,
	getElementsWithQuestions,
	reloadStore,
	store,
} from "#/lib/store";
import type {
	AnsweredComplianceRequirement,
	ComparisonItem,
	GapStatus,
	GroupedComparison,
} from "#/lib/types";

interface ParsedBpmnTemplate {
	inputType: "BooleanToggle" | "Dropdown" | "TextInput";
	options: string[] | null;
}

function parseBpmnTemplate(template: string): ParsedBpmnTemplate {
	if (!template) return { inputType: "BooleanToggle", options: null };
	if (template.startsWith("Dropdown")) {
		const m = template.match(/\[(.*?)\]/);
		const opts = m ? m[1].split(",").map((s) => s.trim()) : [];
		return { inputType: "Dropdown", options: opts.length > 0 ? opts : null };
	}
	if (template.startsWith("TextInput"))
		return { inputType: "TextInput", options: null };
	return { inputType: "BooleanToggle", options: null };
}

function sortItems(items: ComparisonItem[]): ComparisonItem[] {
	return [...items].sort((a, b) => {
		const sa = STAT_ORDER[a.status] ?? 99,
			sb = STAT_ORDER[b.status] ?? 99;
		if (sa !== sb) return sa - sb;
		if (a.category !== b.category) return a.category.localeCompare(b.category);
		return a.externalId.localeCompare(b.externalId);
	});
}

function valuesEqual(
	a: string | boolean | null,
	b: string | boolean | null,
): boolean {
	return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

export default function ComparisonView() {
	const activeBusinessProcessId = useAtomValue(businessProcessIdAtom);
	const auditAssessments = useAtomValue(auditAssessmentsAtom);
	const answeredRequirements = useAtomValue(answeredComplianceRequirementsAtom);
	const [toBeId, setToBeId] = useState<number | null>(null);
	const [asIsId, setAsIsId] = useState<number | null>(null);
	const [toBeAnswers, setToBeAnswers] = useState<
		AnsweredComplianceRequirement[]
	>([]);
	const [asIsAnswers, setAsIsAnswers] = useState<
		AnsweredComplianceRequirement[]
	>([]);
	const [loading, setLoading] = useState(false);
	const [search, setSearch] = useState("");
	const [filter, setFilter] = useState<"all" | "gaps">("all");

	useEffect(() => {
		const pa = auditAssessments.filter(
			(a) => a.processId === activeBusinessProcessId,
		);
		const tb = pa.filter((a) => a.auditType === "To-Be");
		const ai = pa.filter((a) => a.auditType === "As-Is");
		if (tb.length > 0 && (!toBeId || !tb.some((a) => a.id === toBeId)))
			setToBeId(tb[tb.length - 1].id);
		else if (tb.length === 0) setToBeId(null);
		if (ai.length > 0 && (!asIsId || !ai.some((a) => a.id === asIsId)))
			setAsIsId(ai[ai.length - 1].id);
		else if (ai.length === 0) setAsIsId(null);
	}, [auditAssessments, activeBusinessProcessId]);

	const fetchValues = async () => {
		if (!toBeId && !asIsId) {
			setToBeAnswers([]);
			setAsIsAnswers([]);
			return;
		}
		setLoading(true);
		try {
			const p: Promise<AnsweredComplianceRequirement[]>[] = [];
			p.push(toBeId ? fetchValuesForAssessment(toBeId) : Promise.resolve([]));
			p.push(asIsId ? fetchValuesForAssessment(asIsId) : Promise.resolve([]));
			const [t, a] = await Promise.all(p);
			setToBeAnswers(t);
			setAsIsAnswers(a);
		} catch (e) {
			console.error(e);
		} finally {
			setLoading(false);
		}
	};
	useEffect(() => {
		fetchValues();
	}, [toBeId, asIsId, answeredRequirements]);

	const create = async (type: "To-Be" | "As-Is") => {
		setLoading(true);
		try {
			const id = await createAuditAssessment(type);
			if (type === "To-Be") setToBeId(id);
			else setAsIsId(id);
			await reloadStore();
		} catch (e) {
			console.error(e);
		} finally {
			setLoading(false);
		}
	};

	const nv = (
		v: string | boolean | null | undefined,
	): string | boolean | null => {
		if (v === "true" || v === true) return true;
		if (v === "false" || v === false) return false;
		if (v === null || v === undefined || v === "") return null;
		return v;
	};

	const data = useMemo(() => {
		const el = getElementsWithQuestions();
		const r: GroupedComparison[] = [];
		const handledIds = new Set<string>();

		for (const e of el) {
			handledIds.add(e.id);
			const reqs = getComplianceRequirementsForElement(e.type);
			if (!reqs.length) continue;
			const items: ComparisonItem[] = [];
			let gc = 0,
				ac = 0;
			for (const req of reqs) {
				const { inputType, options } = parseBpmnTemplate(req.bpmn_template);
				const ta = toBeAnswers.find(
					(a) => a.elementId === e.id && a.requirementId === req.id,
				);
				const aa = asIsAnswers.find(
					(a) => a.elementId === e.id && a.requirementId === req.id,
				);
				const tv = nv(ta?.value),
					av = nv(aa?.value);
				let status: GapStatus;
				if (tv === null && av === null) status = "na";
				else if (valuesEqual(tv, av)) {
					status = "aligned";
					ac++;
				} else {
					status = "gap";
					gc++;
				}
				items.push({
					requirementId: req.id,
					externalId: req.external_id,
					label: req.bpmn_annotation,
					category: req.category,
					subcategory: req.subcategory,
					inputType,
					dropdownOptions: options,
					toBeValue: ta?.value ?? null,
					asIsValue: aa?.value ?? null,
					status,
				});
			}
			r.push({
				elementId: e.id,
				elementName: e.name,
				elementType: e.type,
				items: sortItems(items),
				gapCount: gc,
				alignedCount: ac,
			});
		}

		// Orphan elements: answered in one assessment but not in current BPMN model
		const orphanIds = new Set<string>();
		for (const a of [...toBeAnswers, ...asIsAnswers]) {
			if (!handledIds.has(a.elementId)) orphanIds.add(a.elementId);
		}

		for (const oid of orphanIds) {
			const toBeForOrphan = toBeAnswers.filter((a) => a.elementId === oid);
			const asIsForOrphan = asIsAnswers.filter((a) => a.elementId === oid);
			const orphanMeta = toBeForOrphan[0] || asIsForOrphan[0];
			const orphanType = orphanMeta?.elementType || "bpmn:Task";
			const orphanName = orphanMeta?.elementName || oid;

			const allReqIds = new Set([
				...toBeForOrphan.map((a) => a.requirementId),
				...asIsForOrphan.map((a) => a.requirementId),
			]);

			const requirements = store.getComplianceRequirements();
			const items: ComparisonItem[] = [];
			let gc = 0;
			for (const rid of allReqIds) {
				const req = requirements.find((r) => r.id === rid);
				if (!req) continue;
				const ta = toBeForOrphan.find((a) => a.requirementId === rid);
				const aa = asIsForOrphan.find((a) => a.requirementId === rid);
				const tv = nv(ta?.value),
					av = nv(aa?.value);
				const hasToBe = tv !== null && tv !== undefined && tv !== false;
				const hasAsIs = av !== null && av !== undefined && av !== false;
				let status: GapStatus = "na";
				if (!hasToBe && !hasAsIs) status = "na";
				else if (!hasToBe || !hasAsIs) {
					status = "gap";
					gc++;
				} else if (valuesEqual(tv, av)) status = "aligned";
				else {
					status = "gap";
					gc++;
				}

				const { inputType, options } = parseBpmnTemplate(req.bpmn_template);
				items.push({
					requirementId: req.id,
					externalId: req.external_id,
					label: req.bpmn_annotation,
					category: req.category,
					subcategory: req.subcategory,
					inputType,
					dropdownOptions: options,
					toBeValue: ta?.value ?? null,
					asIsValue: aa?.value ?? null,
					status,
				});
			}
			if (items.length > 0) {
				r.push({
					elementId: oid,
					elementName: orphanName,
					elementType: orphanType,
					items: sortItems(items),
					gapCount: gc,
					alignedCount: items.filter((i) => i.status === "aligned").length,
				});
			}
		}

		return r;
	}, [toBeAnswers, asIsAnswers]);

	const filtered = useMemo(() => {
		return data
			.map((g) => {
				const fi = g.items.filter((i) => {
					if (search) {
						const q = search.toLowerCase();
						if (
							!i.requirementId.toLowerCase().includes(q) &&
							!i.label.toLowerCase().includes(q) &&
							!i.category.toLowerCase().includes(q)
						)
							return false;
					}
					if (filter === "gaps") return i.status === "gap";
					return true;
				});
				return { ...g, items: fi };
			})
			.filter((g) => g.items.length > 0);
	}, [data, search, filter]);

	const stats = useMemo(() => {
		let tt = 0,
			al = 0,
			gp = 0;
		for (const g of data)
			for (const i of g.items) {
				tt++;
				if (i.status === "aligned") al++;
				else if (i.status === "gap") gp++;
			}
		return { tt, al, gp, cov: tt > 0 ? Math.round((al / tt) * 100) : 0 };
	}, [data]);

	const pa = auditAssessments.filter(
		(a) => a.processId === activeBusinessProcessId,
	);
	const tbo = pa.filter((a) => a.auditType === "To-Be");
	const aio = pa.filter((a) => a.auditType === "As-Is");

	if (!activeBusinessProcessId)
		return (
			<div className="flex flex-col items-center justify-center h-full p-8 text-center bg-neutral-50 font-sans">
				<div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white border border-neutral-200 mb-4">
					<InfoIcon className="w-6 h-6 text-neutral-500" />
				</div>
				<h3 className="text-sm font-semibold text-neutral-900 mb-1">
					No Business Process Selected
				</h3>
				<p className="text-xs text-neutral-500 max-w-sm">
					Select or import a business process model.
				</p>
			</div>
		);
	if (!tbo.length || !aio.length)
		return (
			<div className="flex flex-col items-center justify-center h-full p-8 bg-neutral-50 font-sans">
				<div className="max-w-md w-full bg-white p-6 rounded-lg border border-neutral-200 shadow-xs flex flex-col items-center text-center">
					<div className="w-10 h-10 rounded-full flex items-center justify-center bg-amber-50 text-amber-600 border border-amber-100 mb-4">
						<WarningIcon className="w-5 h-5" />
					</div>
					<h2 className="text-sm font-bold text-neutral-900 tracking-wide mb-1">
						Assessments Required
					</h2>
					<p className="text-xs text-neutral-500 mb-6 leading-relaxed">
						Both a <strong>To-Be</strong> and an <strong>As-Is</strong> session
						are needed for comparison.
					</p>
					<div className="flex flex-col gap-3 w-full">
						{!tbo.length && (
							<button
								type="button"
								onClick={() => create("To-Be")}
								disabled={loading}
								className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold bg-neutral-900 text-white hover:bg-black rounded-md"
							>
								<PlusIcon className="w-3.5 h-3.5" />
								Create To-Be Session
							</button>
						)}
						{!aio.length && (
							<button
								type="button"
								onClick={() => create("As-Is")}
								disabled={loading}
								className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold bg-neutral-900 text-white hover:bg-black rounded-md"
							>
								<PlusIcon className="w-3.5 h-3.5" />
								Create As-Is Session
							</button>
						)}
					</div>
				</div>
			</div>
		);

	return (
		<div className="h-full overflow-y-auto bg-white text-neutral-900 font-sans">
			<div className="max-w-3xl mx-auto px-6 py-6">
				{/* Top bar controls */}
				<div className="flex items-center justify-between gap-2 text-xs mb-4 pb-3 border-b border-neutral-200">
					<div className="flex items-center gap-3 text-xs font-semibold">
						<span className="text-neutral-900">
							{stats.tt} Requirement Targets
						</span>
						<span className="w-px h-3.5 bg-neutral-200" />
						<span className="text-red-700 font-bold">
							{stats.gp} Compliance Gaps
						</span>
					</div>
					<div className="flex items-center gap-2">
						<span className="text-neutral-500 font-medium">Target:</span>
						<select
							value={toBeId || ""}
							onChange={(e) => setToBeId(parseInt(e.target.value, 10))}
							className="bg-neutral-50 border border-neutral-200 rounded px-2 py-1 text-xs font-semibold outline-none cursor-pointer focus:ring-1 focus:ring-neutral-900"
						>
							{tbo.map((o, i) => {
								const label = tbo.length > 1 ? `To-Be ${i + 1}` : "To-Be";
								return (
									<option key={o.id} value={o.id}>
										{label}
									</option>
								);
							})}
						</select>
						<span className="text-neutral-300">·</span>
						<span className="text-neutral-500 font-medium">Actual:</span>
						<select
							value={asIsId || ""}
							onChange={(e) => setAsIsId(parseInt(e.target.value, 10))}
							className="bg-neutral-50 border border-neutral-200 rounded px-2 py-1 text-xs font-semibold outline-none cursor-pointer focus:ring-1 focus:ring-neutral-900"
						>
							{aio.map((o, i) => {
								const label = aio.length > 1 ? `As-Is ${i + 1}` : "As-Is";
								return (
									<option key={o.id} value={o.id}>
										{label}
									</option>
								);
							})}
						</select>
					</div>
				</div>

				{/* Filter & Search Bar */}
				<div className="flex items-center justify-between gap-4 mb-5">
					<div className="flex items-center gap-1.5">
						{["All", "Gaps"].map((k) => {
							const isActive = filter === k.toLowerCase();
							return (
								<button
									type="button"
									key={k}
									onClick={() => {
										if (k === "Gaps") setFilter("gaps");
										else setFilter("all");
									}}
									className={`text-xs font-medium px-2.5 py-1 rounded transition-colors ${
										isActive
											? k === "Gaps"
												? "bg-red-50 text-red-700 font-bold border border-red-200"
												: "bg-neutral-900 text-white font-bold"
											: "text-neutral-500 bg-neutral-100 hover:bg-neutral-200"
									}`}
								>
									{k} ({k === "All" ? stats.tt : stats.gp})
								</button>
							);
						})}
					</div>

					<div className="relative flex items-center">
						<MagnifyingGlassIcon className="w-3.5 h-3.5 absolute left-2.5 text-neutral-400 pointer-events-none" />
						<input
							type="text"
							placeholder="Search requirements (Press Esc to clear)..."
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Escape") setSearch("");
							}}
							className="w-56 pl-8 pr-7 py-1 text-xs rounded border border-neutral-200 outline-none bg-neutral-50 focus:bg-white focus:ring-1 focus:ring-neutral-900 transition-all"
						/>
						{search && (
							<button
								type="button"
								onClick={() => setSearch("")}
								className="absolute right-2 text-neutral-400 hover:text-neutral-700 p-0.5 rounded-full"
								aria-label="Clear search"
							>
								<XIcon className="w-3 h-3" />
							</button>
						)}
					</div>
				</div>

				{/* Main Data Table View */}
				{loading ? (
					<div className="flex flex-col items-center justify-center py-16">
						<div className="w-5 h-5 border-2 border-neutral-200 border-t-neutral-900 rounded-full animate-spin mb-2" />
						<p className="text-xs text-neutral-400">Comparing sessions...</p>
					</div>
				) : filtered.length > 0 ? (
					<div className="space-y-6">
						{filtered.map((g) => {
							const ax = g.items.filter((i) => i.status !== "na");
							return (
								<div
									key={g.elementId}
									className="bg-white rounded-lg border border-neutral-200 overflow-hidden shadow-xs"
								>
									<div className="flex items-center gap-2 px-4 py-2.5 bg-neutral-50 border-b border-neutral-200">
										<TypeIcon type={g.elementType} />
										<span className="text-xs font-bold text-neutral-900">
											{g.elementName}
										</span>
										<div className="flex items-center gap-2 ml-auto text-xs font-semibold">
											{g.gapCount > 0 && (
												<span className="bg-red-50 text-red-700 px-2 py-0.5 rounded border border-red-200 text-xs">
													{g.gapCount} gap{g.gapCount > 1 ? "s" : ""}
												</span>
											)}
											{g.alignedCount > 0 && (
												<span className="text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded text-xs">
													{g.alignedCount} aligned
												</span>
											)}
										</div>
									</div>
									{ax.length > 0 ? (
										<table className="w-full table-fixed text-left divide-y divide-neutral-100">
											<tbody>
												{ax.map((i) => (
													<Row key={i.requirementId} item={i} />
												))}
											</tbody>
										</table>
									) : null}
								</div>
							);
						})}
					</div>
				) : (
					<div className="flex flex-col items-center justify-center py-16 text-center bg-neutral-50 rounded-lg border border-dashed border-neutral-200">
						<MagnifyingGlassIcon className="w-5 h-5 text-neutral-300 mb-2" />
						<p className="text-xs text-neutral-500 font-medium">
							No matching requirements found.
						</p>
						{search && (
							<button
								type="button"
								onClick={() => setSearch("")}
								className="mt-2 text-xs text-blue-600 hover:underline"
							>
								Clear search filter
							</button>
						)}
					</div>
				)}
			</div>
		</div>
	);
}

function Row({ item }: { item: ComparisonItem }) {
	const isGap = item.status === "gap";

	return (
		<tr className="hover:bg-neutral-50/80 transition-colors border-b border-neutral-100 last:border-b-0">
			<td className="py-2.5 pl-4 pr-2 w-[42%]">
				<span className="font-mono text-xs text-neutral-400 mr-2">
					{item.externalId}
				</span>
				<span className="font-semibold text-neutral-900 text-xs">
					{item.label}
				</span>
			</td>
			<td className="py-2.5 px-2 font-mono text-xs w-[25%]">
				<span
					className={
						isGap
							? "text-red-700 font-bold bg-red-50 px-1.5 py-0.5 rounded"
							: "text-neutral-700"
					}
				>
					{fv(item.asIsValue)}
				</span>
			</td>
			<td className="py-2.5 px-1 text-neutral-300 text-center w-6 text-xs">
				→
			</td>
			<td className="py-2.5 pr-4 pl-2 font-mono text-xs font-semibold w-[25%] text-neutral-900">
				{fv(item.toBeValue)}
			</td>
		</tr>
	);
}

function fv(v: string | boolean | null | undefined): string {
	if (v === true || v === "true") return "true";
	if (v === false || v === "false") return "false";
	if (v === null || v === undefined || v === "") return "—";
	return String(v);
}
