import { getCategoryColor } from "./constants";
import { store } from "./store";
import type {
	AnsweredComplianceRequirement as AnsweredRequirement,
	ComplianceRequirement as Requirement,
} from "./types";

export interface ElementBounds {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface ElementSize {
	width: number;
	height: number;
}

export interface Position {
	x: number;
	y: number;
}

function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/^_|_$/g, "");
}

function formatSecurityAnnotation(
	requirement: Requirement,
	value: string | boolean | null,
): string {
	if (value === null || value === undefined) return "";
	return `${requirement.further_specification}: ${value}`;
}

/**
 * Get the bounds of an element from its diagram data.
 */
function getElementBounds(element: any): ElementBounds {
	return {
		x: element.x ?? 0,
		y: element.y ?? 0,
		width: element.width ?? 100,
		height: element.height ?? 80,
	};
}

/**
 * Find the parent container (pool/lane) of an element.
 */
function findParentContainer(element: any): any | null {
	if (!element) return null;
	const parent = element.parent;
	if (!parent) return null;
	if (parent.type === "bpmn:Participant" || parent.type === "bpmn:Lane") {
		return parent;
	}
	return null;
}

/**
 * Find the parent to create visual elements inside.
 *
 * For task/event elements, the semantic parent (businessObject.$parent)
 * is always the Process — use that. For pool/lane elements, bpmn-js
 * resolves Participant → processRef internally, pass it directly.
 *
 * Falls back to rootElement for bare Process diagrams.
 */
function findCreateParent(
	elementRegistry: any,
	element: any,
	rootElement: any,
): any {
	const isPoolOrLane =
		element.type === "bpmn:Participant" || element.type === "bpmn:Lane";

	if (isPoolOrLane) return element;

	// If the element has a visual parent container (like a Participant/Pool or SubProcess), use it
	if (element.parent) {
		return element.parent;
	}

	// For flow elements fallback: use semantic parent (Process or SubProcess)
	const processBo = element.businessObject?.$parent;
	if (processBo) {
		const targetNode = elementRegistry.get(processBo.id);
		if (targetNode) return targetNode;
	}

	// Bare Process diagram (no Collaboration) — rootElement IS the Process
	if (
		rootElement?.type === "bpmn:Process" ||
		rootElement?.type === "bpmn:SubProcess"
	) {
		return rootElement;
	}

	// Last resort
	return rootElement;
}

/**
 * Estimate the rendered size of a text annotation based on its text content.
 */
function estimateAnnotationSize(text: string): ElementSize {
	const lines = text.split("\n");
	const longestLine = Math.max(...lines.map((l) => l.length));
	return {
		width: Math.max(120, Math.min(250, longestLine * 8 + 20)),
		height: Math.max(30, lines.length * 18 + 14),
	};
}

/**
 * Collect bounding boxes of all non-annotation, non-data-object elements for collision detection.
 */
function collectOccupiedBounds(
	elementRegistry: any,
): ElementBounds[] {
	const allElements = elementRegistry.getAll();
	const bounds: ElementBounds[] = [];

	for (const el of allElements) {
		if (el.type === "bpmn:TextAnnotation") continue;
		if (el.type === "bpmn:Association") continue;
		if (el.type === "bpmn:DataObjectReference") continue;
		if (el.type === "bpmn:DataObject") continue;
		if (el.type === "label") continue;
		if (el.type === "bpmn:Participant") continue;
		if (el.type === "bpmn:Lane") continue;
		if (el.type === "bpmn:Collaboration") continue;
		if (el.type === "bpmn:Process") continue;
		if (el.type === "bpmn:SequenceFlow") continue;
		if (el.type === "bpmn:MessageFlow") continue;
		if (el.type === "bpmn:DataInputAssociation") continue;
		if (el.type === "bpmn:DataOutputAssociation") continue;
		if (el.waypoints) continue;
		if (el.x === undefined || el.y === undefined) continue;

		bounds.push({
			x: el.x,
			y: el.y,
			width: el.width ?? 0,
			height: el.height ?? 0,
		});
	}

	return bounds;
}

/**
 * Check if two rectangles overlap (with padding).
 */
function rectsOverlap(
	a: ElementBounds,
	b: ElementBounds,
	padding = 10,
): boolean {
	return !(
		a.x + a.width + padding <= b.x ||
		b.x + b.width + padding <= a.x ||
		a.y + a.height + padding <= b.y ||
		b.y + b.height + padding <= a.y
	);
}

/**
 * Find a position for an element that doesn't overlap with occupied bounds.
 */
function findNonOverlappingPosition(
	targetBounds: ElementBounds,
	elementSize: ElementSize,
	occupiedBounds: ElementBounds[],
	existingPlacedBounds: ElementBounds[],
): Position {
	const gap = 20;
	const allBounds = [...occupiedBounds, ...existingPlacedBounds];

	const candidates: Position[] = [
		{ x: targetBounds.x + targetBounds.width + gap, y: targetBounds.y },
		{
			x: targetBounds.x + targetBounds.width + gap,
			y: targetBounds.y - elementSize.height - gap,
		},
		{ x: targetBounds.x, y: targetBounds.y + targetBounds.height + gap },
		{ x: targetBounds.x, y: targetBounds.y - elementSize.height - gap },
		{ x: targetBounds.x - elementSize.width - gap, y: targetBounds.y },
	];

	for (const pos of candidates) {
		const rect: ElementBounds = {
			x: pos.x,
			y: pos.y,
			width: elementSize.width,
			height: elementSize.height,
		};
		if (!allBounds.some((b) => rectsOverlap(rect, b))) {
			return pos;
		}
	}

	const bestX = candidates[0].x;
	let bestY = candidates[0].y;
	for (let attempt = 0; attempt < 8; attempt++) {
		bestY -= elementSize.height + 10;
		const rect: ElementBounds = {
			x: bestX,
			y: bestY,
			width: elementSize.width,
			height: elementSize.height,
		};
		if (!allBounds.some((b) => rectsOverlap(rect, b))) break;
	}

	return { x: bestX, y: bestY };
}

/**
 * Expand the parent pool/lane if an element extends beyond container boundaries.
 */
function expandContainerIfNeeded(
	modeling: any,
	element: any,
	elementBounds: ElementBounds,
): void {
	const container = findParentContainer(element);
	if (!container) return;

	const containerBounds = getElementBounds(container);
	const padding = 20;

	const elementRight = elementBounds.x + elementBounds.width + padding;
	const elementBottom = elementBounds.y + elementBounds.height + padding;
	const elementTop = elementBounds.y - padding;

	let newWidth = containerBounds.width;
	let newHeight = containerBounds.height;
	let newY = containerBounds.y;
	let changed = false;

	if (elementRight > containerBounds.x + containerBounds.width) {
		newWidth = elementRight - containerBounds.x;
		changed = true;
	}
	if (elementBottom > containerBounds.y + containerBounds.height) {
		newHeight = elementBottom - containerBounds.y;
		changed = true;
	}
	if (elementTop < containerBounds.y) {
		const topExpand = containerBounds.y - elementTop;
		newY = elementTop;
		newHeight = newHeight + topExpand;
		changed = true;
	}

	if (changed) {
		try {
			modeling["resizeShape"](container, {
				x: containerBounds.x,
				y: newY,
				width: newWidth,
				height: newHeight,
			});
		} catch (e) {
			console.warn("Could not resize container:", e);
		}
	}
}

/**
 * Collect bounds of all placed data objects and annotations for collision avoidance.
 */
function collectPlacedAnnotationBounds(
	elementRegistry: any,
): ElementBounds[] {
	return elementRegistry
		.getAll()
		.filter(
			(el: any) =>
				(el.type === "bpmn:TextAnnotation" ||
					el.type === "bpmn:DataObjectReference") &&
				el.x !== undefined,
		)
		.map((el: any) => getElementBounds(el));
}

/**
 * Create or update a colored DataObjectReference + TextAnnotation for a
 * requirement answer. Groups answers by subcategory: one data object per
 * (element, subcategory) pair, with a single annotation containing all
 * key-value answers for that category.
 */
export async function createSecurityDataObject(
	modeler: any,
	element: any,
	requirement: Requirement,
	value: string | boolean | null,
): Promise<void> {
	if (!modeler || !element) return;

	try {
		const modeling = modeler.get("modeling");
		const elementFactory = modeler.get("elementFactory");
		const elementRegistry = modeler.get("elementRegistry");
		const canvas = modeler.get("canvas");

		const category = requirement.category || "General";
		const categorySlug = slugify(category);
		const dataObjectRefId = `DataObjectRef_${element.id}_${categorySlug}`;
		const annotationId = `Annotation_${element.id}_${categorySlug}`;

		// Build annotation text from ALL answered requirements for this element + category
		const allAnswers = store.getAnswersForElement(element.id);
		const allRequirements = store.getComplianceRequirements();
		const categoryReqs = allRequirements.filter(
			(r: Requirement) => r.category === category,
		);

		const lines: string[] = [];
		for (const req of categoryReqs) {
			let answerValue: string | boolean | null;
			if (req.id === requirement.id) {
				answerValue = value;
			} else {
				const stored = allAnswers.find(
					(a: AnsweredRequirement) => a.requirementId === req.id,
				);
				answerValue = stored?.value ?? null;
			}
			const line = formatSecurityAnnotation(req, answerValue);
			if (line) {
				lines.push(line);
			}
		}

		const annotationText = lines.join("\n");

		if (!annotationText) return;

		const colors = getCategoryColor(category);
		const existingDataObject = elementRegistry.get(dataObjectRefId);

		if (existingDataObject) {
			const existingAnnotation = elementRegistry.get(annotationId);
			if (existingAnnotation) {
				modeling.updateProperties(existingAnnotation, { text: annotationText });
				const newSize = estimateAnnotationSize(annotationText);
				modeling["resizeShape"](existingAnnotation, {
					x: existingAnnotation.x,
					y: existingAnnotation.y,
					width: newSize.width,
					height: newSize.height,
				});
			}
		} else {
			const rootElement = canvas.getRootElement();
			const isPoolOrLane =
				element.type === "bpmn:Participant" || element.type === "bpmn:Lane";
			// When the element IS a pool/lane, place data objects inside it;
			// otherwise find a valid container (Process/SubProcess/Participant) via parent chain
			const createParent = isPoolOrLane
				? element
				: findCreateParent(elementRegistry, element, rootElement);

			const elementBounds = getElementBounds(element);
			const dataObjectSize: ElementSize = { width: 36, height: 50 };
			const occupiedBounds = collectOccupiedBounds(elementRegistry);
			const existingPlacedBounds = collectPlacedAnnotationBounds(elementRegistry);

			// Position data object depending on element type:
			// - Pools/Lanes: place at the beginning (left side) of the container, stacked vertically
			// - Tasks/Events: place near the element using collision avoidance
			let dataObjectPos: Position;

			if (isPoolOrLane) {
				const existingDOs = elementRegistry
					.getAll()
					.filter(
						(el: any) =>
							el.type === "bpmn:DataObjectReference" &&
							el.id?.startsWith(`DataObjectRef_${element.id}_`),
					);
				const laneStartX = elementBounds.x + 80; // Increased from 40 to 80 to clear the lane header
				let nextY = elementBounds.y + 20;

				for (const existing of existingDOs) {
					const doBounds = getElementBounds(existing);
					const annId = existing.id.replace("DataObjectRef_", "Annotation_");
					const ann = elementRegistry.get(annId);
					const doBottom = doBounds.y + doBounds.height;
					const annBottom = ann ? ann.y + (ann.height ?? 30) : doBottom;
					nextY = Math.max(doBottom, annBottom) + 20; // Increased gap between stacked items to 20
				}

				dataObjectPos = { x: laneStartX, y: nextY };
			} else {
				const annotationSize = estimateAnnotationSize(annotationText);
				const combinedSize: ElementSize = {
					width: dataObjectSize.width + 25 + annotationSize.width, // Increased annotation gap from 10 to 25
					height: Math.max(dataObjectSize.height, annotationSize.height),
				};
				dataObjectPos = findNonOverlappingPosition(
					elementBounds,
					combinedSize,
					occupiedBounds,
					existingPlacedBounds,
				);
			}

			const dataObjectRefElement = elementFactory["createShape"]({
				type: "bpmn:DataObjectReference",
				id: dataObjectRefId,
			});
			dataObjectRefElement.businessObject.name = category;

			modeling["createShape"](
				dataObjectRefElement,
				{
					x: dataObjectPos.x + dataObjectSize.width / 2,
					y: dataObjectPos.y + dataObjectSize.height / 2,
				},
				createParent,
			);

			modeling.setColor(dataObjectRefElement, colors);

			const isTaskOrEvent =
				element.type === "bpmn:Task" ||
				element.type === "bpmn:IntermediateCatchEvent" ||
				element.type === "bpmn:IntermediateThrowEvent";

			if (isTaskOrEvent) {
				try {
					modeling.connect(dataObjectRefElement, element, {
						type: "bpmn:DataInputAssociation",
					});
				} catch (err) {
					// Some element types may not support DataInputAssociation
					console.warn("Could not create DataInputAssociation:", err);
				}
			}

			const annotationSize = estimateAnnotationSize(annotationText);
			const annotationPos: Position = {
				x: dataObjectPos.x + dataObjectSize.width + 25,
				y: dataObjectPos.y,
			};

			const textAnnotation = elementFactory["createShape"]({
				type: "bpmn:TextAnnotation",
				id: annotationId,
			});
			textAnnotation.businessObject.text = annotationText;

			modeling["createShape"](
				textAnnotation,
				{
					x: annotationPos.x + annotationSize.width / 2,
					y: annotationPos.y + annotationSize.height / 2,
				},
				createParent,
			);

			modeling.connect(dataObjectRefElement, textAnnotation, {
				type: "bpmn:Association",
			});

			expandContainerIfNeeded(modeling, element, {
				x: dataObjectPos.x,
				y: dataObjectPos.y,
				width: dataObjectSize.width,
				height: dataObjectSize.height,
			});
			expandContainerIfNeeded(modeling, element, {
				x: annotationPos.x,
				y: annotationPos.y,
				width: annotationSize.width,
				height: annotationSize.height,
			});
		}

		await modeler.saveXML({ format: true });
	} catch (e) {
		console.error("Failed to create/update security data object:", e);
	}
}

/**
 * Wrapper — delegates to createSecurityDataObject.
 */
export async function createSecurityAnnotation(
	modeler: any,
	element: any,
	requirement: Requirement,
	value: string | boolean,
): Promise<void> {
	return createSecurityDataObject(modeler, element, requirement, value);
}

export function getSecurityAnnotations(modeler: any, elementId: string): any[] {
	if (!modeler) return [];

	try {
		const elementRegistry = modeler.get("elementRegistry");
		const allElements = elementRegistry.getAll();
		// Find all data objects and annotations belonging to this element
		const prefix = `DataObjectRef_${elementId}_`;
		const annotPrefix = `Annotation_${elementId}_`;
		return allElements.filter(
			(el: any) => el.id?.startsWith(prefix) || el.id?.startsWith(annotPrefix),
		);
	} catch (err) {
		console.error("getSecurityAnnotations failed:", err);
		return [];
	}
}

export function serializeSecurityData(
	answers: AnsweredRequirement[],
	requirements: Requirement[],
): string {
	const securityData = answers.map((answer) => {
		const req = requirements.find((r) => r.id === answer.requirementId);
		return {
			elementId: answer.elementId,
			requirementId: answer.requirementId,
			requirement: req?.requirement || "",
			value: answer.value,
			timestamp: new Date().toISOString(),
		};
	});

	return JSON.stringify(securityData, null, 2);
}

/**
 * Reposition all data objects and their annotations so they don't overlap.
 * Groups by target element and stacks vertically.
 */
export async function repositionAnnotations(modeler: any): Promise<void> {
	if (!modeler) return;

	try {
		const modeling = modeler.get("modeling");
		const elementRegistry = modeler.get("elementRegistry");
		const allElements = elementRegistry.getAll();
		const occupiedBounds = collectOccupiedBounds(elementRegistry);

		// Track where we've placed things to avoid overlaps
		const placedBounds: ElementBounds[] = [];

		// Collect all our data objects (our IDs: DataObjectRef_<elementId>_<category>)
		const dataObjects = allElements.filter(
			(el: any) =>
				el.type === "bpmn:DataObjectReference" &&
				/^DataObjectRef_\w+_\w/.test(el.id || ""),
		);

		// Make room for data objects by shifting process elements in lanes
		const laneGroups = new Map<string, any[]>();
		for (const dobj of dataObjects) {
			const m = dobj.id.match(/^DataObjectRef_(.+?)_([a-z_]+)$/);
			if (!m) continue;
			const el = elementRegistry.get(m[1]);
			if (!el) continue;
			if (el.type === "bpmn:Participant" || el.type === "bpmn:Lane") {
				if (!laneGroups.has(m[1])) laneGroups.set(m[1], []);
				laneGroups.get(m[1])!.push(dobj);
			}
		}

		for (const [laneId, laneDOs] of laneGroups) {
			const lane = elementRegistry.get(laneId);
			if (!lane) continue;
			const lb = getElementBounds(lane);

			// Calculate max annotation width for this lane's data objects
			let maxAnnWidth = 120;
			for (const d of laneDOs) {
				const ann = elementRegistry.get(
					d.id.replace("DataObjectRef_", "Annotation_"),
				);
				if (ann) {
					const text = ann.businessObject?.text || "";
					const w = estimateAnnotationSize(text).width;
					if (w > maxAnnWidth) maxAnnWidth = w;
				}
			}
			const requiredSpace = 36 + 10 + maxAnnWidth + 30;

			// Find movable children (tasks, events, gateways — NOT annotations/data objects)
			const children = allElements.filter((el: any) => {
				if (!el.parent || el.parent.id !== laneId) return false;
				if (
					el.type === "bpmn:DataObjectReference" ||
					el.type === "bpmn:DataObject"
				)
					return false;
				if (el.type === "bpmn:TextAnnotation" || el.type === "bpmn:Association")
					return false;
				if (
					el.type === "bpmn:DataInputAssociation" ||
					el.type === "bpmn:LaneSet"
				)
					return false;
				if (el.waypoints || el.x === undefined) return false;
				return true;
			});

			if (children.length === 0) continue;
			const leftmost = Math.min(...children.map((c: any) => c.x));
			const shift = lb.x + 40 + requiredSpace - leftmost;

			if (shift > 10) {
				for (const child of children) {
					modeling["moveShape"](child, { x: shift, y: 0 });
				}
				modeling["resizeShape"](lane, {
					x: lb.x,
					y: lb.y,
					width: lb.width + shift,
					height: lb.height,
				});
			}
		}

		// Position each data object + annotation pair
		for (const dobj of dataObjects) {
			const m = dobj.id.match(/^DataObjectRef_(.+?)_([a-z_]+)$/);
			if (!m) continue;
			const targetEl = elementRegistry.get(m[1]);
			if (!targetEl) continue;

			const targetBounds = getElementBounds(targetEl);
			const doW = dobj.width ?? 36;
			const doH = dobj.height ?? 50;

			// Find the paired annotation
			const pairedAnn = elementRegistry.get(
				dobj.id.replace("DataObjectRef_", "Annotation_"),
			);
			const annText = pairedAnn?.businessObject?.text || "";
			const annSize = estimateAnnotationSize(annText);

			const isLane =
				targetEl.type === "bpmn:Participant" || targetEl.type === "bpmn:Lane";

			let doX: number, doY: number;

			if (isLane) {
				// Far left of lane, stacked below previous items
				const laneX = targetBounds.x + 80; // Match increased offset from creation
				let nextY = targetBounds.y + 20;
				for (const b of placedBounds) {
					// Check if this bound is in the lane's data object column
					if (
						Math.abs(b.x - laneX) < 10 ||
						Math.abs(b.x - (laneX + doW + 25)) < 30
					) {
						const bottom = b.y + b.height + 20;
						if (bottom > nextY) nextY = bottom;
					}
				}
				doX = laneX;
				doY = nextY;
			} else {
				const combinedSize: ElementSize = {
					width: doW + 25 + annSize.width, // Match increased gap from creation
					height: Math.max(doH, annSize.height),
				};
				const pos = findNonOverlappingPosition(
					targetBounds,
					combinedSize,
					occupiedBounds,
					placedBounds,
				);
				doX = pos.x;
				doY = pos.y;
			}

			const doDx = doX - dobj.x;
			const doDy = doY - dobj.y;
			if (Math.abs(doDx) > 1 || Math.abs(doDy) > 1) {
				modeling["moveShape"](dobj, { x: doDx, y: doDy });
			}

			if (dobj.label) {
				const labelX = doX + doW / 2 - (dobj.label.width || 0) / 2;
				const labelY = doY + doH + 5;
				const lDx = labelX - dobj.label.x;
				const lDy = labelY - dobj.label.y;
				if (Math.abs(lDx) > 1 || Math.abs(lDy) > 1) {
					modeling["moveShape"](dobj.label, { x: lDx, y: lDy });
				}
			}

			placedBounds.push({
				x: doX,
				y: doY,
				width: doW,
				height: doH + (dobj.label?.height || 0) + 5,
			});

			if (pairedAnn) {
				const annX = doX + doW + 25; // Increased gap from 10 to 25
				const annY = doY;
				const annDx = annX - pairedAnn.x;
				const annDy = annY - pairedAnn.y;

				if (Math.abs(annDx) > 1 || Math.abs(annDy) > 1) {
					modeling["moveShape"](pairedAnn, { x: annDx, y: annDy });
				}

				modeling["resizeShape"](pairedAnn, {
					x: annX,
					y: annY,
					width: annSize.width,
					height: annSize.height,
				});

				placedBounds.push({
					x: annX,
					y: annY,
					width: annSize.width,
					height: annSize.height,
				});
			}

			expandContainerIfNeeded(modeling, targetEl, {
				x: doX,
				y: doY,
				width: doW,
				height: doH,
			});
			if (pairedAnn) {
				expandContainerIfNeeded(modeling, targetEl, {
					x: doX + doW + 25,
					y: doY, // Increased gap from 10 to 25
					width: annSize.width,
					height: annSize.height,
				});
			}
		}

		// Handle legacy TextAnnotation_{elementId} elements
		const legacyAnnotations = allElements.filter(
			(el: any) =>
				el.type === "bpmn:TextAnnotation" &&
				el.id?.startsWith("TextAnnotation_"),
		);

		for (const ann of legacyAnnotations) {
			const m = ann.id.match(/^TextAnnotation_(.+)$/);
			if (!m) continue;
			const targetEl = elementRegistry.get(m[1]);
			if (!targetEl) continue;

			const text = ann.businessObject?.text || "";
			const size = estimateAnnotationSize(text);
			const pos = findNonOverlappingPosition(
				getElementBounds(targetEl),
				size,
				occupiedBounds,
				placedBounds,
			);

			const dx = pos.x - ann.x;
			const dy = pos.y - ann.y;
			if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
				modeling["moveShape"](ann, { x: dx, y: dy });
			}
			modeling["resizeShape"](ann, {
				x: pos.x,
				y: pos.y,
				width: size.width,
				height: size.height,
			});

			placedBounds.push({
				x: pos.x,
				y: pos.y,
				width: size.width,
				height: size.height,
			});
		}
	} catch (e) {
		console.error("Failed to reposition annotations:", e);
	}
}
