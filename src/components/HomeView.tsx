"use client";

import { useAtomValue } from "jotai";
import {
	lazy,
	Suspense,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import AppHeader from "#/components/AppHeader";
import type { BpmnCanvasHandle, BpmnModeler } from "#/components/BpmnCanvas";
import BpmnCanvas from "#/components/BpmnCanvas";
import ProcessNavigator from "#/components/ProcessNavigator";
import RequirementSidebar from "#/components/RequirementSidebar";
import ResetConfirmDialog from "#/components/ResetConfirmDialog";
import { createSecurityDataObject } from "#/lib/bpmn-extensions";
import {
	answerComplianceRequirement,
	auditAssessmentIdAtom,
	auditAssessmentsAtom,
	bpmnXmlAtom,
	businessProcessesAtom,
	businessProcessIdAtom,
	getAnswersForElement,
	getComplianceRequirementsForElement,
	getElementsWithQuestions,
	getOverallProgress,
	loadingAtom,
	selectedElementAtom,
	setSelectedElement,
	store,
} from "#/lib/store";

const ComplianceMatrix = lazy(() => import("#/components/ComplianceMatrix"));
const ComparisonView = lazy(() => import("#/components/ComparisonView"));

export default function Home() {
	const currentXml = useAtomValue(bpmnXmlAtom);
	const businessProcesses = useAtomValue(businessProcessesAtom);
	const activeBusinessProcessId = useAtomValue(businessProcessIdAtom);
	const auditAssessments = useAtomValue(auditAssessmentsAtom);
	const activeAuditAssessmentId = useAtomValue(auditAssessmentIdAtom);
	const isStoreLoading = useAtomValue(loadingAtom);
	const selected = useAtomValue(selectedElementAtom);

	const [modeler, setModeler] = useState<BpmnModeler | null>(null);
	const [activeView, setActiveView] = useState<"editor" | "matrix">("editor");
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined);
	const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
	const canvasRef = useRef<BpmnCanvasHandle>(null);

	useEffect(() => {
		store.init();
	}, []);

	useEffect(() => {
		const checkMobile = () => {
			setIsMobile(window.innerWidth < 1024);
		};
		checkMobile();
		window.addEventListener("resize", checkMobile);
		return () => window.removeEventListener("resize", checkMobile);
	}, []);

	const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = async (e) => {
			const xml = e.target?.result as string;
			try {
				await store.importBusinessProcess(
					file.name.replace(/\.(bpmn|xml)$/, ""),
					xml,
				);
			} catch (err) {
				console.error("Failed to save uploaded business process:", err);
			}
		};
		reader.readAsText(file);
	};

	const handleExport = async () => {
		const xml = await canvasRef.current?.getXml();
		if (!xml) return;
		const blob = new Blob([xml], { type: "application/xml" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "security-enriched.bpmn";
		a.click();
		URL.revokeObjectURL(url);
	};

	const requirements = useMemo(() => {
		return selected ? getComplianceRequirementsForElement(selected.type) : [];
	}, [selected]);

	const handleAnswer = async (
		reqId: string,
		value: string | boolean | null | undefined,
	) => {
		if (!selected || !modeler) return;
		const req = store.getComplianceRequirements().find((r) => r.id === reqId);
		if (!req) return;
		answerComplianceRequirement(
			selected.id,
			reqId,
			value,
			selected.type,
			selected.name,
		);
		const elementRegistry = modeler.get("elementRegistry") as {
			get: (id: string) => any;
		};
		const bpmnElement = elementRegistry.get(selected.id);
		if (bpmnElement) {
			await createSecurityDataObject(modeler, bpmnElement, req, value ?? null);
		}
	};

	const handleReposition = async () => {
		await canvasRef.current?.repositionAnnotations();
	};

	const handleResetElement = () => {
		if (!selected) return;
		const answers = getAnswersForElement(selected.id);
		for (const a of answers) {
			answerComplianceRequirement(
				selected.id,
				a.requirementId,
				undefined,
				selected.type,
				selected.name,
			);
		}
	};

	const handleResetClick = () => {
		setIsResetDialogOpen(true);
	};

	const handleResetConfirm = async () => {
		const pmId = store.getBusinessProcessId();
		const assId = store.getAuditAssessmentId();
		if (!pmId || !assId) return;
		try {
			const res = await fetch(
				`/modeler/api/audit-assessments/${assId}/values?process_id=${pmId}`,
				{
					method: "DELETE",
				},
			);
			if (res.ok) {
				store.setAnsweredComplianceRequirements([]);
				if (canvasRef.current) {
					await canvasRef.current.rebuildAnnotations(true);
				}
			} else {
				console.error("Failed to delete assessment values from DB");
			}
		} catch (err) {
			console.error("Failed to reset business process answers:", err);
		}
	};

	const elements = getElementsWithQuestions();
	const progress = getOverallProgress();

	const currentNavIndex = useMemo(() => {
		if (!selected) return -1;
		return elements.findIndex((e) => e.id === selected.id);
	}, [selected, elements]);

	const handleSetSelected = (el: {
		id: string;
		name: string;
		type: string;
	}) => {
		setSelectedElement(el);
		if (isMobile === true) {
			setSidebarOpen(true);
		}
		setTimeout(() => {
			canvasRef.current?.syncSelection();
		}, 100);
	};

	const goToPrevElement = useCallback(() => {
		if (elements.length === 0) return;
		const newIndex =
			currentNavIndex <= 0 ? elements.length - 1 : currentNavIndex - 1;
		const el = elements[newIndex];
		setSelectedElement({ id: el.id, name: el.name, type: el.type });
		setTimeout(() => {
			canvasRef.current?.syncSelection();
		}, 200);
	}, [elements, currentNavIndex]);

	const goToNextElement = useCallback(() => {
		if (elements.length === 0) return;
		const newIndex =
			currentNavIndex >= elements.length - 1 || currentNavIndex === -1
				? 0
				: currentNavIndex + 1;
		const el = elements[newIndex];
		setSelectedElement({ id: el.id, name: el.name, type: el.type });
		setTimeout(() => {
			canvasRef.current?.syncSelection();
		}, 200);
	}, [elements, currentNavIndex]);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.target instanceof HTMLElement) {
				const tag = e.target.tagName;
				if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
			}
			if (e.key === "ArrowLeft") {
				e.preventDefault();
				goToPrevElement();
			} else if (e.key === "ArrowRight") {
				e.preventDefault();
				goToNextElement();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [goToPrevElement, goToNextElement]);

	const handleBusinessProcessChange = async (id: number) => {
		await store.setBusinessProcessId(id);
	};
	const handleAuditAssessmentChange = async (id: number) => {
		await store.setAuditAssessment(id);
	};
	const handleCreateAuditAssessment = async (type: "To-Be" | "As-Is") => {
		await store.createAuditAssessment(type);
	};

	const handleDeleteBusinessProcess = async (id: number) => {
		try {
			await store.deleteBusinessProcess(id);
			await store.fetchBusinessProcesses();
			await store.loadLatestBusinessProcess();
			await store.fetchAuditAssessments();
		} catch (err) {
			console.error("Failed to delete business process:", err);
		}
	};

	const [comparisonHeight, setComparisonHeight] = useState(340);
	const comparisonHeightRef = useRef(340);
	comparisonHeightRef.current = comparisonHeight;

	const handleMouseDownResize = useCallback((e: React.MouseEvent) => {
		e.preventDefault();
		const startY = e.clientY;
		const startHeight = comparisonHeightRef.current;

		const handleMouseMove = (moveEvent: MouseEvent) => {
			const deltaY = startY - moveEvent.clientY;
			const maxHeight = window.innerHeight * 0.8;
			const newHeight = Math.max(100, Math.min(maxHeight, startHeight + deltaY));
			setComparisonHeight(newHeight);
		};

		const handleMouseUp = () => {
			window.removeEventListener("mousemove", handleMouseMove);
			window.removeEventListener("mouseup", handleMouseUp);
		};

		window.addEventListener("mousemove", handleMouseMove);
		window.addEventListener("mouseup", handleMouseUp);
	}, []);

	return (
		<div className="min-h-screen bg-white text-neutral-900">
			<AppHeader
				activeView={activeView}
				onViewChange={setActiveView}
				onFileImport={handleFileImport}
				onExport={handleExport}
				onReposition={handleReposition}
				onReset={handleResetClick}
				elementsCount={elements.length}
				sidebarOpen={sidebarOpen}
				onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
				businessProcesses={businessProcesses}
				activeBusinessProcessId={activeBusinessProcessId}
				onBusinessProcessChange={handleBusinessProcessChange}
				auditAssessments={auditAssessments}
				activeAuditAssessmentId={activeAuditAssessmentId}
				onAuditAssessmentChange={handleAuditAssessmentChange}
				onCreateAuditAssessment={handleCreateAuditAssessment}
				onDeleteBusinessProcess={handleDeleteBusinessProcess}
				isLoading={isStoreLoading}
			/>
			<div className="flex h-[calc(100vh-57px)]">
				{activeView === "editor" && (
					<aside className="hidden lg:flex w-64 flex-col bg-white shrink-0 border-r border-neutral-200">
						<ProcessNavigator
							elements={elements.map((el) => {
								const answers = getAnswersForElement(el.id);
								const reqs = getComplianceRequirementsForElement(el.type);
								return {
									...el,
									answeredCount: answers.length,
									totalCount: reqs.length,
								};
							})}
							selected={selected}
							onSelect={handleSetSelected}
							overallProgress={progress}
						/>
					</aside>
				)}
				<main className="flex-1 relative bg-neutral-50 min-w-0 flex flex-col h-full">
					<div
						style={{
							display: activeView === "editor" ? "block" : "none",
							width: "100%",
						}}
						className="flex-1 min-h-0"
					>
						<BpmnCanvas
							ref={canvasRef}
							xml={currentXml}
							auditAssessmentId={activeAuditAssessmentId || undefined}
							onReady={(m: BpmnModeler) => setModeler(m)}
						/>
					</div>
					{activeView === "matrix" && (
						<div className="view-transition-enter w-full h-full flex-1">
							<Suspense
								fallback={
									<div className="flex items-center justify-center h-full">
										<div className="w-8 h-8 border-4 border-neutral-200 border-t-neutral-900 rounded-full animate-spin" />
									</div>
								}
							>
								<ComplianceMatrix />
							</Suspense>
						</div>
					)}
					{activeView === "editor" && (
						<div
							className="border-t border-neutral-200 bg-white flex flex-col z-20 shrink-0 relative"
							style={{ height: `${comparisonHeight}px` }}
						>
							{/* Top drag handle indicator */}
							<div
								onMouseDown={handleMouseDownResize}
								className="absolute top-0 left-0 right-0 h-3 -translate-y-1/2 cursor-ns-resize z-30 group flex items-center justify-center hover:bg-blue-500/10 transition-colors"
								title="Drag to resize panel height"
							>
								<div className="w-12 h-1.5 bg-neutral-300 group-hover:bg-neutral-600 rounded-full transition-colors" />
							</div>
							<div className="h-[38px] px-4 bg-neutral-50 border-b border-neutral-200 flex items-center shrink-0 select-none">
								<span className="text-sm font-semibold text-neutral-900">
									Comparison
								</span>
							</div>
							<div className="flex-1 min-h-0 relative">
								<Suspense
									fallback={
										<div className="flex items-center justify-center h-full">
											<div className="w-6 h-6 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin" />
										</div>
									}
								>
									<ComparisonView />
								</Suspense>
							</div>
						</div>
					)}
				</main>
				{activeView === "editor" && (
					<aside
						className="fixed lg:relative inset-y-0 right-0 w-87.5 sm:w-100 lg:w-112.5 bg-white p-4 overflow-y-auto flex flex-col z-50 lg:z-auto transition-transform duration-300 ease-in-out"
						style={{
							borderLeft: "1px solid #ebebeb",
							transform:
								isMobile === false
									? "translateX(0)"
									: isMobile === true && !sidebarOpen
										? "translateX(100%)"
										: "translateX(0)",
						}}
					>
						{selected ? (
							<RequirementSidebar
								selected={selected}
								requirements={requirements}
								onAnswer={handleAnswer}
								onResetElement={handleResetElement}
							/>
						) : (
							<div className="flex flex-col items-center justify-center py-16 px-6 text-center">
								<div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-neutral-50 ring-1 ring-black/10">
									<svg
										width="24"
										height="24"
										viewBox="0 0 24 24"
										fill="none"
										className="text-neutral-500"
										aria-label="Select element"
									>
										<title>Select element</title>
										<rect
											x="3"
											y="5"
											width="18"
											height="14"
											rx="2"
											stroke="currentColor"
											strokeWidth="1.5"
											strokeDasharray="4 3"
										/>
										<path
											d="M8 12h8M12 8v8"
											stroke="currentColor"
											strokeWidth="1.5"
											strokeLinecap="round"
										/>
									</svg>
								</div>
								<p className="text-sm font-medium text-neutral-900 mb-1">
									No Element Selected
								</p>
								<p className="text-xs text-neutral-500 leading-relaxed">
									Click on a BPMN element in the canvas to view and answer its
									security requirements
								</p>
							</div>
						)}
						<button
							type="button"
							onClick={() => setSidebarOpen(false)}
							className="lg:hidden absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-md text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50"
						>
							×
						</button>
					</aside>
				)}
			</div>
			<ResetConfirmDialog
				isOpen={isResetDialogOpen}
				onClose={() => setIsResetDialogOpen(false)}
				onConfirm={handleResetConfirm}
			/>
		</div>
	);
}
