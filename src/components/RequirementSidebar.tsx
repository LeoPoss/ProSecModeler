import {
	CaretDownIcon,
	MagnifyingGlassIcon,
	TrashIcon,
} from "@phosphor-icons/react";
import { useAtomValue } from "jotai";
import { useMemo, useState } from "react";
import RequirementItem from "#/components/RequirementItem";
import {
	answeredComplianceRequirementsAtom,
	getAnswer,
	getAnswersForElement,
} from "#/lib/store";
import type {
	ComplianceRequirement as Requirement,
	SelectedElement,
} from "#/lib/types";

interface RequirementSidebarProps {
	selected: SelectedElement;
	requirements: Requirement[];
	onAnswer: (
		reqId: string,
		value: string | boolean | null | undefined,
	) => void;
	onResetElement: () => void;
}

function isStatusFilter(value: string): value is "all" | "pending" | "done" {
	return value === "all" || value === "pending" || value === "done";
}

export default function RequirementSidebar({
	selected,
	requirements,
	onAnswer,
	onResetElement,
}: RequirementSidebarProps) {
	useAtomValue(answeredComplianceRequirementsAtom);
	const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
		new Set(),
	);
	const [searchQuery, setSearchQuery] = useState("");
	const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "done">(
		"all",
	);

	const toggleGroup = (group: string) => {
		const next = new Set(collapsedGroups);
		if (next.has(group)) next.delete(group);
		else next.add(group);
		setCollapsedGroups(next);
	};

	const groupedRequirements: Record<string, Requirement[]> = useMemo(() => {
		const grouped: Record<string, Requirement[]> = {};
		for (const req of requirements) {
			const key = req.category || "General";
			if (!grouped[key]) grouped[key] = [];
			grouped[key].push(req);
		}
		return grouped;
	}, [requirements]);

	const answeredCount = getAnswersForElement(selected.id).length;
	const totalCount = requirements.length;
	const progressPercent =
		totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;

	return (
		<div className="flex flex-col h-full">
			<div
				className="p-4 pb-3 shrink-0"
				style={{ borderBottom: "1px solid #ebebeb" }}
			>
				<div className="flex items-start justify-between gap-3 mb-3">
					<div className="min-w-0 flex-1">
						<h2
							className="text-base font-semibold truncate text-neutral-900"
							style={{ letterSpacing: "-0.32px" }}
						>
							{selected.name}
						</h2>
						<p className="text-xs text-neutral-500 mt-0.5">{selected.type}</p>
					</div>
					{answeredCount > 0 && (
						<button
							type="button"
							onClick={onResetElement}
							className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors shrink-0"
							style={{
								color: "#666666",
								background: "#fafafa",
								boxShadow: "rgba(0, 0, 0, 0.08) 0px 0px 0px 1px",
							}}
							title="Clear all answers"
						>
							<TrashIcon className="w-3.5 h-3.5" />
							Reset
						</button>
					)}
				</div>

				<div className="flex items-center gap-3 mb-2">
					<div
						className="flex-1 h-1.5 rounded-full overflow-hidden"
						style={{ background: "#fafafa" }}
					>
						<div
							className="h-full rounded-full transition-all"
							style={{
								width: `${progressPercent}%`,
								backgroundColor:
									progressPercent === 100 ? "#22c55e" : "#171717",
							}}
						/>
					</div>
					<span className="text-xs font-medium text-neutral-900 tabular-nums shrink-0">
						{progressPercent}%
					</span>
				</div>
				<p className="text-xs text-neutral-500">
					{answeredCount} of {totalCount} requirements answered
				</p>
			</div>

			<div
				className="px-4 py-3 shrink-0"
				style={{ borderBottom: "1px solid #ebebeb" }}
			>
				<div className="relative mb-3">
					<MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
					<input
						type="text"
						placeholder="Search requirements..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="w-full pl-9 pr-3 py-2.5 text-sm rounded-md transition-colors"
						style={{
							background: "#ffffff",
							boxShadow: "rgba(0, 0, 0, 0.08) 0px 0px 0px 1px",
							outline: "none",
						}}
					/>
				</div>
				<div className="flex items-center gap-2">
					<select
						value={statusFilter}
						onChange={(e) => {
							const val = e.target.value;
							if (isStatusFilter(val)) {
								setStatusFilter(val);
							}
						}}
						className="px-3 py-1.5 text-xs rounded-md cursor-pointer transition-colors text-neutral-900"
						style={{
							background: "#ffffff",
							boxShadow: "rgba(0, 0, 0, 0.08) 0px 0px 0px 1px",
						}}
					>
						<option value="all">All</option>
						<option value="pending">Pending</option>
						<option value="done">Done</option>
					</select>
					<span className="text-xs text-neutral-500 ml-auto">
						{Object.keys(groupedRequirements).length} categories
					</span>
				</div>
			</div>

			<div className="flex-1 overflow-y-auto p-4">
				{Object.keys(groupedRequirements).length > 0 ? (
					<div className="space-y-4 -mr-2 pr-2">
						{Object.entries(groupedRequirements).map(([category, reqs]) => {
							const isCollapsed = collapsedGroups.has(category);
							const categoryAnswered = reqs.filter(
								(r) => getAnswer(selected.id, r.id) !== undefined,
							).length;

							return (
								<div
									key={category}
									className="overflow-hidden"
									style={{
										borderRadius: "8px",
										boxShadow:
											"rgba(0, 0, 0, 0.08) 0px 0px 0px 1px, rgba(0, 0, 0, 0.04) 0px 2px 2px, #fafafa 0px 0px 0px 1px",
									}}
								>
									<button
										type="button"
										onClick={() => toggleGroup(category)}
										className="w-full flex items-center justify-between px-4 py-3 transition-colors text-sm font-medium text-neutral-900"
										style={{ background: "#fafafa" }}
									>
										<span className="flex items-center gap-2">
											<CaretDownIcon
												className={`w-4 h-4 text-neutral-500 transition-transform duration-200 ${isCollapsed ? "-rotate-90" : ""}`}
											/>
											{category}
										</span>
										<span
											className="text-xs px-2.5 py-1 font-medium"
											style={{
												borderRadius: "9999px",
												backgroundColor:
													categoryAnswered === reqs.length
														? "#ecfdf5"
														: categoryAnswered > 0
															? "#fffbeb"
															: "#fafafa",
												color:
													categoryAnswered === reqs.length
														? "#059669"
														: categoryAnswered > 0
															? "#d97706"
															: "#666666",
											}}
										>
											{categoryAnswered}/{reqs.length}
										</span>
									</button>

									{!isCollapsed && (
										<div className="p-3 bg-white">
											{reqs
												.filter((req) => {
													if (searchQuery) {
														const q = searchQuery.toLowerCase();
														const matches =
															req.id.toLowerCase().includes(q) ||
															req.requirement.toLowerCase().includes(q) ||
															req.category.toLowerCase().includes(q) ||
															(req.subcategory || "")
																.toLowerCase()
																.includes(q) ||
															req.bpmn_annotation.toLowerCase().includes(q);
														if (!matches) return false;
													}
													if (statusFilter !== "all") {
														const hasAnswer =
															getAnswer(selected.id, req.id) !== undefined;
														if (statusFilter === "done" && !hasAnswer)
															return false;
														if (statusFilter === "pending" && hasAnswer)
															return false;
													}
													return true;
												})
												.map((req) => (
													<RequirementItem
														key={req.id}
														req={req}
														subcategory={req.subcategory}
														answer={getAnswer(selected.id, req.id)}
														onAnswer={onAnswer}
													/>
												))}
										</div>
									)}
								</div>
							);
						})}
					</div>
				) : (
					<div className="flex flex-col items-center justify-center py-12 px-6 text-center">
						<div
							className="w-14 h-14 rounded-xl flex items-center justify-center mb-4"
							style={{
								background: "#fafafa",
								boxShadow: "rgba(0, 0, 0, 0.08) 0px 0px 0px 1px",
							}}
						>
							<svg
								width="24"
								height="24"
								viewBox="0 0 24 24"
								fill="none"
								className="text-neutral-500"
								aria-label="No requirements"
							>
								<title>No requirements</title>
								<path
									d="M9 12l2 2 4-4"
									stroke="currentColor"
									strokeWidth="1.5"
									strokeLinecap="round"
									strokeLinejoin="round"
								/>
								<circle
									cx="12"
									cy="12"
									r="9"
									stroke="currentColor"
									strokeWidth="1.5"
								/>
							</svg>
						</div>
						<p className="text-sm font-medium text-neutral-900 mb-1">
							No security requirements
						</p>
						<p className="text-xs text-neutral-500 leading-relaxed">
							This element type doesn't have any security requirements mapped to
							it.
						</p>
					</div>
				)}
			</div>
		</div>
	);
}
