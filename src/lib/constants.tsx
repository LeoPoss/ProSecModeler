import type { ReactNode } from "react";
import { cloneElement, isValidElement } from "react";

export type BpmnTypeKey = "task" | "message_event" | "pool" | "lane";

export interface BpmnType {
	key: BpmnTypeKey;
	label: string;
	color: string;
}

export const BPMN_TYPES: BpmnType[] = [
	{ key: "task", label: "Task", color: "#3b82f6" },
	{ key: "message_event", label: "Message Event", color: "#8b5cf6" },
	{ key: "pool", label: "Pool", color: "#f59e0b" },
	{ key: "lane", label: "Lane", color: "#10b981" },
];

export const CATEGORY_COLORS = {
	"IoT Ecosystem Requirements": { stroke: "#205022", fill: "#c8e6c9" },
	"Identification and Authentication": { stroke: "#205022", fill: "#c8e6c9" },
	"Use Control": { stroke: "#6b3c00", fill: "#ffe0b2" },
	"System Integrity": { stroke: "#5D445D", fill: "#16405B" },
	"Data Confidentiality": { stroke: "#2E343B", fill: "#7E7E7E" },
	"Restricted Data Flow": { stroke: "#634806", fill: "#AA8F00" },
	"Timely Response to Events": { stroke: "#AA2E00", fill: "#D46A43" },
	"Resource Availability": { stroke: "#5b176d", fill: "#e1bee7" },
} satisfies Record<string, { stroke: string; fill: string }>;

export interface CategoryColor {
	stroke: string;
	fill: string;
}

export const DEFAULT_CATEGORY_COLOR: CategoryColor = {
	stroke: "#2E343B",
	fill: "#7E7E7E",
};

export function getCategoryColor(category: string): CategoryColor {
	if (category in CATEGORY_COLORS) {
		return CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS];
	}
	return DEFAULT_CATEGORY_COLOR;
}

export const PROGRESS_COLORS = {
	completed: { fill: "#22c55e", border: "#15803d" },
	"in-progress": { fill: "#eab308", border: "#a16207" },
	"not-started": { fill: "#9ca3af", border: "#4b5563" },
} satisfies Record<string, { fill: string; border: string }>;

export const BPMN_TYPE_ICONS = {
	task: (
		<svg
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			aria-label="Task"
		>
			<title>Task</title>
			<rect
				x="2"
				y="4"
				width="20"
				height="16"
				rx="3"
				stroke="currentColor"
				strokeWidth="2"
			/>
		</svg>
	),
	message_event: (
		<svg
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			aria-label="Message Event"
		>
			<title>Message Event</title>
			<circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
			<path d="M7 10l5 3.5L17 10" stroke="currentColor" strokeWidth="2" />
		</svg>
	),
	pool: (
		<svg
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			aria-label="Pool"
		>
			<title>Pool</title>
			<rect
				x="2"
				y="6"
				width="20"
				height="12"
				stroke="cu2111rrentColor"
				strokeWidth="2"
			/>
			<line
				x1="6"
				y1="6"
				x2="6"
				y2="18"
				stroke="currentColor"
				strokeWidth="2"
			/>
		</svg>
	),
	lane: (
		<svg
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			aria-label="Lane"
		>
			<title>Lane</title>
			<rect
				x="2"
				y="4"
				width="20"
				height="16"
				stroke="currentColor"
				strokeWidth="2"
			/>
			<line
				x1="2"
				y1="12"
				x2="22"
				y2="12"
				stroke="currentColor"
				strokeWidth="2"
				strokeDasharray="4 4"
			/>
		</svg>
	),
} satisfies Record<string, ReactNode>;

function typeToIconKey(type: string): keyof typeof BPMN_TYPE_ICONS | null {
	if (type.includes("Task")) return "task";
	if (type.includes("Event")) return "message_event";
	if (type.includes("Participant")) return "pool";
	if (type.includes("Lane")) return "lane";
	return null;
}

export function TypeIcon({ type, size = 14 }: { type: string; size?: number }) {
	const key = typeToIconKey(type);
	if (!key) return null;
	const icon = BPMN_TYPE_ICONS[key];
	if (!icon || !isValidElement<{ width?: number; height?: number }>(icon)) return null;
	const scaled = cloneElement(icon, {
		width: size,
		height: size,
	});
	return <span className="shrink-0 text-[#999]">{scaled}</span>;
}

export const BASE_URL = "/modeler/api";

export const STAT_ORDER = { gap: 0, aligned: 1, na: 2 } as const;
