"use client";

import {
	forwardRef,
	useCallback,
	useEffect,
	useImperativeHandle,
	useRef,
	useState,
} from "react";
import {
	createSecurityDataObject,
	repositionAnnotations,
} from "#/lib/bpmn-extensions";
import {
	getProgressForElement,
	selectedElement,
	setElementRegistry,
	setSelectedElement,
	store,
} from "#/lib/store";
import type {
	BpmnCanvasHandle,
	BpmnModeler,
	ComplianceRequirement as Requirement,
} from "#/lib/types";

export type { BpmnCanvasHandle, BpmnModeler };

interface BpmnCanvasProps {
	xml?: string;
	auditAssessmentId?: number | null;
	onReady?: (modeler: BpmnModeler) => void;
}

const BpmnCanvas = forwardRef<BpmnCanvasHandle, BpmnCanvasProps>(
	function BpmnCanvas({ xml, auditAssessmentId, onReady }, ref) {
		const containerRef = useRef<HTMLDivElement>(null);
		const modelerRef = useRef<BpmnModeler | null>(null);
		const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
		const [loading, setLoading] = useState(true);
		const [error, setError] = useState<string | null>(null);
		const isRepositioningRef = useRef(false);

		const rebuildRef = useRef<(force?: boolean) => Promise<void>>(
			async () => { },
		);
		const cleanXmlRef = useRef<() => Promise<string>>(async () => "");

		const rebuildAssessmentAnnotations = useCallback(async (force = false) => {
			if (!modelerRef.current || (isRepositioningRef.current && !force)) return;

			try {
				if (
					!("getDefinitions" in modelerRef.current) ||
					!modelerRef.current.getDefinitions?.()
				) {
					return;
				}
			} catch {
				return;
			}

			const wasRepositioning = isRepositioningRef.current;
			isRepositioningRef.current = true;
			try {
				const modeling = modelerRef.current.get("modeling") as any;
				const elementRegistry = modelerRef.current.get("elementRegistry") as {
					getAll: () => Array<{ id?: string; type?: string }>;
					get: (id: string) => any;
				};

				// 1. Gather and remove existing security annotations only (not original BPMN elements).
				const elementsToRemove = elementRegistry
					.getAll()
					.filter(
						(el) =>
							(el.type === "bpmn:DataObjectReference" &&
								/^DataObjectRef_\w+_\w/.test(el.id || "")) ||
							(el.type === "bpmn:TextAnnotation" &&
								el.id?.startsWith("Annotation_")),
					);

				for (const targetElement of elementsToRemove) {
					try {
						modeling["removeShape"](targetElement);
					} catch (e) {
						console.warn("Failed to remove element:", targetElement.id, e);
					}
				}

				// 2. Fetch the newly loaded answered requirements from the store
				const savedAnswers = store.getAnsweredComplianceRequirements();
				const requirements = store.getComplianceRequirements();

				if (savedAnswers.length > 0 && requirements.length > 0) {
					// Group answers by element to batch them
					const answersByElement = new Map<
						string,
						Array<{ requirementId: string; value: string | boolean | null }>
					>();
					for (const answer of savedAnswers) {
						if (!answersByElement.has(answer.elementId)) {
							answersByElement.set(answer.elementId, []);
						}
						answersByElement.get(answer.elementId)!.push(answer);
					}

					for (const [elementId, answers] of answersByElement) {
						const bpmnElement = elementRegistry.get(elementId);
						if (!bpmnElement) continue;

						for (const answer of answers) {
							const req = requirements.find(
								(r: Requirement) => r.id === answer.requirementId,
							);
							if (!req) continue;
							await createSecurityDataObject(
								modelerRef.current,
								bpmnElement,
								req,
								answer.value,
							);
						}
					}
				}
			} catch (err) {
				console.error("Failed to rebuild assessment annotations:", err);
			} finally {
				isRepositioningRef.current = wasRepositioning;
			}
		}, []);

		useEffect(() => {
			rebuildRef.current = rebuildAssessmentAnnotations;
		}, [rebuildAssessmentAnnotations]);

		// biome-ignore lint/correctness/useExhaustiveDependencies: Initialize modeler only once
		useEffect(() => {
			let mounted = true;

			const initBpmn = async () => {
				try {
					const BpmnModeler = (await import("bpmn-js/lib/Modeler")).default;

					await import("bpmn-js/dist/assets/diagram-js.css");
					await import("bpmn-js/dist/assets/bpmn-js.css");
					await import("bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css");

					if (!mounted || !containerRef.current) return;

					modelerRef.current = new BpmnModeler({
						container: containerRef.current,
					});

					modelerRef.current.on(
						"selection.changed",
						(e: { newSelection: unknown[] }) => {
							const element = e.newSelection[0] as
								| {
									id: string;
									type: string;
									businessObject?: { name?: string };
								}
								| undefined;
							if (element) {
								setSelectedElement({
									id: element.id,
									name: element.businessObject?.name || element.id,
									type: element.type,
								});
							} else {
								setSelectedElement(null);
							}
						},
					);

					const elementRegistry = modelerRef.current.get("elementRegistry") as any;
					setElementRegistry(elementRegistry);

					setLoading(false);
					onReady?.(modelerRef.current);
				} catch (err) {
					if (!mounted) return;
					console.error("Failed to load bpmn-js:", err);
					setError(
						err instanceof Error ? err.message : "Failed to load BPMN viewer",
					);
					setLoading(false);
				}
			};

			initBpmn();

			return () => {
				mounted = false;
				if (modelerRef.current) {
					modelerRef.current.destroy();
				}
				if (saveTimeoutRef.current) {
					clearTimeout(saveTimeoutRef.current);
				}
			};
		}, []);

		// Compliance overlays — show colored dots on elements
		useEffect(() => {
			if (loading || !modelerRef.current) return;

			const updateOverlays = () => {
				try {
					const overlays = modelerRef.current?.get("overlays") as any;
					const elementRegistry = modelerRef.current?.get(
						"elementRegistry",
					) as any;
					if (!overlays || !elementRegistry) return;

					// Clear existing compliance overlays
					overlays.remove({ type: "compliance-status" });

					const allElements = elementRegistry.getAll();
					for (const element of allElements) {
						if (!element.businessObject) continue;
						const type = element.type;
						// Only show overlays on elements that can have requirements
						if (
							![
								"bpmn:Task",
								"bpmn:Participant",
								"bpmn:Lane",
								"bpmn:IntermediateCatchEvent",
								"bpmn:IntermediateThrowEvent",
							].includes(type)
						)
							continue;

						const progress = getProgressForElement(element.id, type);
						if (progress.total === 0) continue;

						const color =
							progress.status === "completed"
								? "#22c55e"
								: progress.status === "in-progress"
									? "#eab308"
									: "#9ca3af";

						const borderColor =
							progress.status === "completed"
								? "#15803d"
								: progress.status === "in-progress"
									? "#a16207"
									: "#4b5563";

						const html = document.createElement("div");
						html.innerHTML = `<div class="compliance-badge" style="background:${color};border:2px solid ${borderColor}">${progress.answered}/${progress.total}</div>`;

						overlays.add(element.id, "compliance-status", {
							position: { top: -8, right: -8 },
							html,
						});
					}
				} catch {
					// Silently fail — overlays are non-critical
				}
			};

			const handleStoreUpdate = () => {
				updateOverlays();
				rebuildAssessmentAnnotations(true);
			};

			handleStoreUpdate();
			const unsub = store.subscribe(handleStoreUpdate);
			modelerRef.current.on("import.done", updateOverlays);

			return () => {
				unsub();
				modelerRef.current?.off("import.done", updateOverlays);
			};
		}, [loading, rebuildAssessmentAnnotations]);

		const getCleanXml = useCallback(async () => {
			if (!modelerRef.current) return "";
			const wasRepositioning = isRepositioningRef.current;
			isRepositioningRef.current = true;
			try {
				const modeling = modelerRef.current.get("modeling") as any;
				const elementRegistry = modelerRef.current.get("elementRegistry") as {
					getAll: () => Array<{ id?: string; type?: string }>;
					get: (id: string) => any;
				};

				// 1. Gather compliance annotation elements and connections (our annotations only)
				const elementsToRemove = elementRegistry
					.getAll()
					.filter(
						(el) =>
							(el.type === "bpmn:DataObjectReference" &&
								/^DataObjectRef_\w+_\w/.test(el.id || "")) ||
							(el.type === "bpmn:TextAnnotation" &&
								el.id?.startsWith("Annotation_")),
					);

				for (const targetElement of elementsToRemove) {
					try {
						modeling["removeShape"](targetElement);
					} catch (e) {
						console.warn("Failed to remove element:", targetElement.id, e);
					}
				}

				// 2. Save the clean XML
				const { xml: cleanXml } = await modelerRef.current.saveXML({
					format: true,
				});

				// 3. Rebuild the annotations back
				await rebuildRef.current(true);

				return cleanXml || "";
			} catch (err) {
				console.error("Failed to generate clean XML:", err);
				return "";
			} finally {
				isRepositioningRef.current = wasRepositioning;
			}
		}, []);

		useEffect(() => {
			cleanXmlRef.current = getCleanXml;
		}, [getCleanXml]);

		useEffect(() => {
			const modeler = modelerRef.current;
			if (xml && modeler && !loading) {
				const importAndRestore = async () => {
					try {
						await modeler.importXML(xml);
						try {
							const canvas = modeler.get("canvas") as any;
							canvas.resized();
							canvas.zoom("fit-viewport", "auto");
						} catch (e) {
							console.warn("Failed to center viewport:", e);
						}
						await rebuildAssessmentAnnotations(true);
					} catch (err) {
						console.error("Failed to import BPMN:", err);
					}
				};
				importAndRestore();
			}
		}, [xml, loading, rebuildAssessmentAnnotations]);

		useEffect(() => {
			if (!loading && modelerRef.current && auditAssessmentId !== undefined) {
				rebuildAssessmentAnnotations(true); // force=true to bypass isRepositioningRef guard
			}
		}, [auditAssessmentId, loading, rebuildAssessmentAnnotations]);

		useEffect(() => {
			if (!modelerRef.current) return;

			const selection = modelerRef.current.get("selection") as any;
			const elementRegistry = modelerRef.current.get("elementRegistry") as any;
			const canvas = modelerRef.current.get("canvas") as any;
			let lastId: string | null = null;

			const syncSelection = () => {
				const sel = selectedElement();

				if (!sel) {
					if (lastId) {
						const prev = elementRegistry.get(lastId);
						if (prev) selection.deselect(prev);
						lastId = null;
					}
					return;
				}

				if (sel.id === lastId) return;

				if (lastId) {
					const prev = elementRegistry.get(lastId);
					if (prev) selection.deselect(prev);
				}

				const element = elementRegistry.get(sel.id);
				if (!element) return;

				lastId = sel.id;
				canvas.scrollToElement(element);
				selection.select(element);
			};

			const unsub = store.subscribe(syncSelection);

			return () => {
				unsub();
			};
		}, []);

		// Just reposition text annotations - no BPMN auto-layout
		const applyLayout = async () => {
			if (!modelerRef.current) return;
			try {
				await repositionAnnotations(modelerRef.current);
			} catch (err) {
				console.error("Failed to reposition annotations:", err);
			}
		};

		useImperativeHandle(ref, () => ({
			getModeler: () => modelerRef.current,
			getXml: getCleanXml,
			syncSelection: () => {
				const sel = selectedElement();
				if (!sel || !modelerRef.current) return;
				const selection = modelerRef.current.get("selection") as any;
				const canvas = modelerRef.current.get("canvas") as any;
				const elementRegistry = modelerRef.current.get(
					"elementRegistry",
				) as any;
				const element = elementRegistry.get(sel.id);
				if (!element) return;
				canvas.scrollToElement(element);
				selection.select(element);
			},
			repositionAnnotations: applyLayout,
			rebuildAnnotations: rebuildAssessmentAnnotations,
		}));

		return (
			<div className="relative w-full h-full">
				<div ref={containerRef} className="w-full h-full bpmn-canvas" />
				{loading && (
					<div
						className="absolute inset-0 flex items-center justify-center z-10"
						style={{ background: "#ffffff" }}
					>
						<div className="text-center">
							<div className="w-10 h-10 border-4 border-neutral-200 border-t-neutral-900 rounded-full animate-spin mx-auto mb-4" />
							<p style={{ color: "#666666" }}>Loading BPMN Modeler</p>
						</div>
					</div>
				)}
				{error && (
					<div className="absolute inset-0 flex items-center justify-center z-10 bg-red-50">
						<div className="text-center p-6">
							<p className="font-semibold mb-2 text-red-600">
								Failed to load BPMN viewer
							</p>
							<p className="text-sm text-red-700">
								{error}
							</p>
						</div>
					</div>
				)}
			</div>
		);
	},
);

export default BpmnCanvas;
