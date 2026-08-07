import {
	CheckCircleIcon,
	CircleIcon,
	XCircleIcon,
} from "@phosphor-icons/react";
import { InlineList } from "#/components/ui/inline-list";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";
import type { ComplianceRequirement as Requirement } from "#/lib/types";

const parseTemplate = (
	template: string,
):
	| { type: "boolean" }
	| { type: "dropdown"; options: string[] }
	| { type: "text" } => {
	if (template.startsWith("BooleanToggle")) return { type: "boolean" };
	if (template.startsWith("Dropdown[")) {
		const match = template.match(/Dropdown\[(.*)\]/);
		return {
			type: "dropdown",
			options: match?.[1]?.split(",").map((s) => s.trim()) || [],
		};
	}
	return { type: "text" };
};

interface RequirementItemProps {
	req: Requirement;
	subcategory?: string;
	answer: string | boolean | null | undefined;
	onAnswer: (reqId: string, value: string | boolean | null) => void;
}

export default function RequirementItem({
	req,
	subcategory,
	answer,
	onAnswer,
}: RequirementItemProps) {
	const template = parseTemplate(req.bpmn_template);
	const isAnswered = answer !== undefined;
	const isNotRelevant = answer === null;

	return (
		<div
			className={`group relative p-4 rounded-lg transition-all duration-200 mb-3 last:mb-0 ${
				isAnswered ? "" : "hover:bg-neutral-50/50"
			}`}
			style={{
				background: isAnswered ? "#fafafa" : "transparent",
				boxShadow: "rgba(0, 0, 0, 0.08) 0px 0px 0px 1px",
			}}
		>
			<div className="flex items-start gap-3 mb-3">
				<div className="mt-0.5">
					{isNotRelevant ? (
						<XCircleIcon
							className="w-5 h-5 text-neutral-500 shrink-0"
							weight="fill"
						/>
					) : isAnswered ? (
						<CheckCircleIcon
							className="w-5 h-5 text-neutral-900 shrink-0"
							weight="fill"
						/>
					) : (
						<CircleIcon className="w-5 h-5 text-neutral-500 shrink-0" />
					)}
				</div>
				<div className="flex-1 min-w-0">
					{subcategory && (
						<span className="text-xs font-medium text-neutral-500 mb-1 block">
							{subcategory}
						</span>
					)}
					<div className="flex items-center gap-2 mb-1">
						<span className="text-sm font-medium text-neutral-900">
							{req.bpmn_annotation}
						</span>
						{req.external_id && (
							<span className="text-xs font-mono text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded shrink-0">
								{req.external_id}
							</span>
						)}
					</div>
					<p
						className="text-xs leading-relaxed text-neutral-500"
						style={{ lineHeight: 1.5 }}
					>
						{req.question || req.requirement}
					</p>
				</div>
			</div>

			<div className="ml-8">
				{template.type === "boolean" && (
					<div className="grid grid-cols-4 gap-2">
						<button
							type="button"
							onClick={() => onAnswer(req.id, true)}
							className={`px-4 py-2 rounded-md text-xs font-medium transition-all ${
								answer === true
									? "text-white"
									: "text-neutral-500 hover:text-neutral-900"
							}`}
							style={{
								background: answer === true ? "#171717" : "#ffffff",
								boxShadow:
									answer === true
										? "none"
										: "rgba(0, 0, 0, 0.08) 0px 0px 0px 1px",
							}}
						>
							Yes
						</button>
						<button
							type="button"
							onClick={() => onAnswer(req.id, false)}
							className={`px-4 py-2 rounded-md text-xs font-medium transition-all ${
								answer === false
									? "text-white"
									: "text-neutral-500 hover:text-neutral-900"
							}`}
							style={{
								background: answer === false ? "#171717" : "#ffffff",
								boxShadow:
									answer === false
										? "none"
										: "rgba(0, 0, 0, 0.08) 0px 0px 0px 1px",
							}}
						>
							No
						</button>
						<button
							type="button"
							onClick={() => onAnswer(req.id, isNotRelevant ? undefined : null)}
							className={`col-span-2 px-4 py-2 rounded-md text-xs font-medium transition-all ${
								isNotRelevant
									? "text-white"
									: "text-neutral-500 hover:text-neutral-900"
							}`}
							style={{
								background: isNotRelevant ? "#808080" : "#ffffff",
								boxShadow: isNotRelevant
									? "none"
									: "rgba(0, 0, 0, 0.08) 0px 0px 0px 1px",
							}}
						>
							Not Relevant
						</button>
					</div>
				)}

				{template.type === "dropdown" && (
					<div className="flex gap-2 items-start">
						<Select
							value={(answer as string) || ""}
							onValueChange={(value: string) => onAnswer(req.id, value)}
						>
							<SelectTrigger
								className="flex-1 text-xs h-8 px-3"
								onClick={() => {
									if (isNotRelevant) {
										onAnswer(req.id, undefined);
									}
								}}
								style={{
									background: "#ffffff",
									boxShadow: "rgba(0, 0, 0, 0.08) 0px 0px 0px 1px",
									borderRadius: "6px",
									opacity: isNotRelevant ? 0.6 : 1,
								}}
							>
								<SelectValue
									placeholder={
										isNotRelevant
											? "Not relevant - click to select..."
											: "Select..."
									}
								/>
							</SelectTrigger>
							<SelectContent>
								{template.options.map((opt) => (
									<SelectItem key={opt} value={opt} className="text-xs">
										{opt}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<button
							type="button"
							onClick={() => onAnswer(req.id, isNotRelevant ? undefined : null)}
							className={`h-8 px-4 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
								isNotRelevant
									? "text-white"
									: "text-neutral-500 hover:text-neutral-900"
							}`}
							style={{
								background: isNotRelevant ? "#808080" : "#ffffff",
								boxShadow: isNotRelevant
									? "none"
									: "rgba(0, 0, 0, 0.08) 0px 0px 0px 1px",
							}}
						>
							Not Relevant
						</button>
					</div>
				)}

				{template.type === "text" && (
					<div className="flex gap-2 items-start">
						<InlineList
							value={(isNotRelevant ? "" : (answer as string)) || ""}
							onChange={(value: string) => onAnswer(req.id, value || null)}
							disabled={isNotRelevant}
							className="flex-1"
							onActivate={() => onAnswer(req.id, undefined)}
						/>
						<button
							type="button"
							onClick={() => onAnswer(req.id, isNotRelevant ? undefined : null)}
							className={`h-8 px-4 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
								isNotRelevant
									? "text-white"
									: "text-neutral-500 hover:text-neutral-900"
							}`}
							style={{
								background: isNotRelevant ? "#808080" : "#ffffff",
								boxShadow: isNotRelevant
									? "none"
									: "rgba(0, 0, 0, 0.08) 0px 0px 0px 1px",
							}}
						>
							Not Relevant
						</button>
					</div>
				)}
			</div>
		</div>
	);
}
