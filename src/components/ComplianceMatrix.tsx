"use client";

import { CaretRightIcon, MinusIcon, XIcon } from "@phosphor-icons/react";
import { useAtomValue } from "jotai";
import { Fragment, useMemo, useState } from "react";
import { BPMN_TYPE_ICONS, BPMN_TYPES } from "#/lib/constants";
import {
	answeredComplianceRequirementsAtom,
	complianceRequirementsAtom,
} from "#/lib/store";
import type { ComplianceRequirement, GroupedRequirements } from "#/lib/types";

export default function ComplianceMatrix() {
	const answeredRequirements = useAtomValue(answeredComplianceRequirementsAtom);
	const requirements = useAtomValue(complianceRequirementsAtom);

	const groupedRequirements = useMemo(() => {
		const result: GroupedRequirements = {};
		for (const req of requirements) {
			const category = req.category || "General";
			if (!result[category]) result[category] = [];
			result[category].push(req);
		}
		return result;
	}, [requirements]);

	const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() =>
		new Set(Object.keys(groupedRequirements)),
	);

	const toggleCategory = (category: string) => {
		const next = new Set(expandedCategories);
		if (next.has(category)) next.delete(category);
		else next.add(category);
		setExpandedCategories(next);
	};

	const isApplicable = (
		req: ComplianceRequirement,
		typeKey: string,
	): boolean => {
		if (typeKey === "task") return req.bpmn_mapping.task;
		if (typeKey === "message_event") return req.bpmn_mapping.message_event;
		if (typeKey === "pool") return req.bpmn_mapping.pool;
		if (typeKey === "lane") return req.bpmn_mapping.lane;
		return false;
	};

	return (
		<div
			className="w-full h-full overflow-auto p-6"
			style={{ background: "#ffffff" }}
		>
			<div className="max-w-6xl mx-auto">
				<div className="mb-6">
					<h2
						className="text-xl font-semibold text-neutral-900 mb-1"
						style={{ letterSpacing: "-0.96px" }}
					>
						Progress Matrix
					</h2>
				</div>

				<div className="flex flex-col gap-4">
					{Object.entries(groupedRequirements).map(([category, reqs]) => {
						const isExpanded = expandedCategories.has(category);
						const answeredCount = reqs.filter((r) => {
							return answeredRequirements.some((a) => a.requirementId === r.id);
						}).length;

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
									onClick={() => toggleCategory(category)}
									className="w-full flex items-center justify-between px-5 py-4 transition-colors text-sm font-medium text-neutral-900"
									style={{ background: "#fafafa" }}
								>
									<span className="flex items-center gap-3">
										<CaretRightIcon
											className={`w-4 h-4 text-neutral-500 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
										/>
										{category}
									</span>
									<span
										className="text-xs px-3 py-1 font-medium"
										style={{
											borderRadius: "9999px",
											backgroundColor:
												answeredCount === reqs.length
													? "#ecfdf5"
													: answeredCount > 0
														? "#fffbeb"
														: "#fafafa",
											color:
												answeredCount === reqs.length
													? "#059669"
													: answeredCount > 0
														? "#d97706"
														: "#666666",
										}}
									>
										{reqs.length} requirements
									</span>
								</button>

								{isExpanded && (
									<div className="bg-white">
										<div
											className="grid gap-px"
											style={{
												gridTemplateColumns: "1fr repeat(4, 100px)",
											}}
										>
											<div
												className="px-4 py-3 text-xs font-medium text-neutral-500"
												style={{ background: "#fafafa" }}
											>
												Requirement
											</div>
											{BPMN_TYPES.map((type) => (
												<div
													key={type.key}
													className="px-4 py-3 text-center"
													style={{ background: "#fafafa" }}
												>
													<div className="flex items-center justify-center gap-2 mb-1">
														<span style={{ color: type.color }}>
															{BPMN_TYPE_ICONS[type.key]}
														</span>
													</div>
													<span
														className="text-xs font-medium"
														style={{ color: type.color }}
													>
														{type.label}
													</span>
												</div>
											))}

											{reqs.map((req, idx) => (
												<Fragment key={req.id}>
													<div
														key={`${req.id}-req`}
														className="px-4 py-3"
														style={{
															background:
																idx % 2 === 0 ? "#ffffff" : "#fafafa/50",
														}}
													>
														<div className="flex items-center gap-2 mb-1">
															<span className="text-sm font-medium text-neutral-900">
																{req.bpmn_annotation}
															</span>
															{req.external_id && (
																<span className="text-xs font-mono text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded">
																	{req.external_id}
																</span>
															)}
														</div>
														<p className="text-xs text-neutral-500 line-clamp-2 mb-2">
															{req.requirement}
														</p>
														<div className="flex items-center gap-2">
															<span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">
																{req.subcategory || "General"}
															</span>
															<code
																className="text-[9px] text-neutral-500 px-1.5 py-0.5 rounded"
																style={{
																	background: "#fafafa",
																	fontFamily: "'Geist Mono', monospace",
																}}
															>
																{req.further_specification}
															</code>
															<code
																className="text-[9px] text-neutral-500 px-1.5 py-0.5 rounded"
																style={{
																	background: "#fafafa",
																	fontFamily: "'Geist Mono', monospace",
																}}
															>
																{req.bpmn_template}
															</code>
														</div>
													</div>
													{BPMN_TYPES.map((type) => (
														<div
															key={`${req.id}-${type.key}`}
															className="px-4 py-3 flex items-center justify-center"
															style={{
																background:
																	idx % 2 === 0 ? "#ffffff" : "#fafafa/50",
															}}
														>
															{isApplicable(req, type.key) ? (
																<div
																	className="w-6 h-6 rounded flex items-center justify-center"
																	style={{ background: "#171717" }}
																>
																	<XIcon
																		className="w-4 h-4 text-white"
																		weight="bold"
																	/>
																</div>
															) : (
																<div
																	className="w-6 h-6 rounded flex items-center justify-center"
																	style={{
																		background: "#fafafa",
																		boxShadow:
																			"rgba(0, 0, 0, 0.08) 0px 0px 0px 1px",
																	}}
																>
																	<MinusIcon
																		className="w-3 h-3 text-neutral-500"
																		weight="bold"
																	/>
																</div>
															)}
														</div>
													))}
												</Fragment>
											))}
										</div>
									</div>
								)}
							</div>
						);
					})}
				</div>

				<div className="mt-6 flex items-center gap-6 text-xs text-neutral-500">
					<div className="flex items-center gap-2">
						<div
							className="w-5 h-5 rounded flex items-center justify-center"
							style={{ background: "#171717" }}
						>
							<XIcon className="w-3 h-3 text-white" weight="bold" />
						</div>
						<span>Applicable</span>
					</div>
					<div className="flex items-center gap-2">
						<div
							className="w-5 h-5 rounded flex items-center justify-center"
							style={{
								background: "#fafafa",
								boxShadow: "rgba(0, 0, 0, 0.08) 0px 0px 0px 1px",
							}}
						>
							<MinusIcon className="w-2 h-2 text-neutral-500" weight="bold" />
						</div>
						<span>Not applicable</span>
					</div>
				</div>
			</div>
		</div>
	);
}
