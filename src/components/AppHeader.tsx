import {
	ArrowCounterClockwiseIcon,
	ArrowsOutIcon,
	CaretDownIcon,
	CheckIcon,
	DownloadIcon,
	GridFourIcon,
	ListIcon,
	PencilSimpleIcon,
	TrashIcon,
	UploadIcon,
} from "@phosphor-icons/react";
import * as Select from "@radix-ui/react-select";
import { useRef, useState } from "react";
import DeleteProcessConfirmDialog from "./DeleteProcessConfirmDialog";
import ImportConfirmDialog from "./ImportConfirmDialog";
import type { AppHeaderProps } from "#/lib/types";

export default function AppHeader({
	activeView,
	onViewChange,
	onFileImport,
	onExport,
	onReposition,
	onReset,
	elementsCount,
	onToggleSidebar,
	sidebarOpen,
	businessProcesses,
	activeBusinessProcessId,
	onBusinessProcessChange,
	onDeleteBusinessProcess,
	auditAssessments,
	activeAuditAssessmentId,
	onAuditAssessmentChange,
	onCreateAuditAssessment,
	isLoading,
}: AppHeaderProps) {
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [deleteTarget, setDeleteTarget] = useState<{
		id: number;
		name: string;
	} | null>(null);
	const [importDialogOpen, setImportDialogOpen] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const activeProcess = businessProcesses.find(
		(bp) => bp.id === activeBusinessProcessId,
	);
	return (
		<header
			className="sticky top-0 z-50 bg-white"
			style={{ boxShadow: "rgba(0, 0, 0, 0.08) 0px 0px 0px 1px" }}
		>
			<style>{`
				@keyframes loading-sweep {
					0% { transform: translateX(-100%); }
					50% { transform: translateX(0%); }
					100% { transform: translateX(100%); }
				}
				.animate-loading-sweep {
					animation: loading-sweep 1.5s infinite ease-in-out;
				}
				.select-trigger {
					display: inline-flex;
					align-items: center;
					justify-content: space-between;
					border-radius: 6px;
					padding: 6px 12px;
					font-size: 12px;
					font-weight: 600;
					line-height: 1;
					height: 28px;
					gap: 6px;
					background-color: white;
					color: #171717;
					box-shadow: rgba(0, 0, 0, 0.08) 0px 1px 2px;
					border: none;
					outline: none;
					cursor: pointer;
					transition: background-color 0.2s;
				}
				.select-trigger:hover {
					background-color: #fafafa;
				}
				.select-trigger:focus {
					box-shadow: 0 0 0 2px #171717;
				}
				.select-content {
					overflow: hidden;
					background-color: white;
					border-radius: 8px;
					box-shadow: 0px 10px 38px -10px rgba(22, 23, 24, 0.35), 0px 10px 20px -15px rgba(22, 23, 24, 0.2);
					border: 1px solid #ebebeb;
					padding: 4px;
					z-index: 100;
				}
				.select-viewport {
					padding: 5px;
				}
				.select-item {
					font-size: 12px;
					font-weight: 500;
					line-height: 1;
					color: #171717;
					border-radius: 6px;
					display: flex;
					align-items: center;
					height: 28px;
					padding: 0 32px 0 24px;
					position: relative;
					user-select: none;
					outline: none;
					cursor: pointer;
				}
				.select-item[data-disabled] {
					color: #808080;
					pointer-events: none;
				}
				.select-item[data-highlighted] {
					background-color: #fafafa;
					color: #000000;
				}
				.select-item-action {
					color: #0068d6;
					font-weight: 600;
				}
				.select-item-action[data-highlighted] {
					background-color: #ebf5ff;
					color: #0068d6;
				}
				.select-item-delete {
					color: #dc2626;
					font-weight: 600;
				}
				.select-item-delete[data-highlighted] {
					background-color: #fef2f2;
					color: #dc2626;
				}
				.select-item-indicator {
					position: absolute;
					left: 6px;
					width: 12px;
					height: 12px;
					display: inline-flex;
					align-items: center;
					justify-content: center;
				}
				.select-separator {
					height: 1px;
					background-color: #ebebeb;
					margin: 4px 0;
				}
			`}</style>
			{isLoading && (
				<div className="absolute top-0 left-0 w-full h-[2px] bg-neutral-900/10 z-50 overflow-hidden">
					<div
						className="h-full bg-[#0a72ef] animate-loading-sweep"
						style={{ width: "40%" }}
					/>
				</div>
			)}
			<div className="h-[2px] bg-neutral-900/10" />
			<div className="flex items-center justify-between px-4 lg:px-6 py-3">
				<div className="flex items-center gap-3">
					<h1
						className="text-base font-semibold leading-tight text-neutral-900"
						style={{ letterSpacing: "-0.32px" }}
					>
						Security-Aware BPMN Modeler
					</h1>
				</div>

				<div className="flex items-center gap-2 lg:gap-3">
					{/* Business Process Switcher */}
					<div
						className="flex items-center gap-1.5 bg-neutral-50 p-1 rounded-md"
						style={{ boxShadow: "rgba(0, 0, 0, 0.08) 0px 0px 0px 1px" }}
					>
						<span className="text-xs font-bold text-neutral-500 px-1.5 hidden md:inline">
							Process
						</span>
						<Select.Root
							value={String(activeBusinessProcessId ?? "")}
							onValueChange={(val) => {
								if (val === "delete") {
									if (activeProcess) {
										setDeleteTarget({
											id: activeProcess.id,
											name: activeProcess.name,
										});
										setDeleteDialogOpen(true);
									}
									return;
								}
								const id = parseInt(val, 10);
								if (id) onBusinessProcessChange(id);
							}}
							disabled={isLoading}
						>
							<Select.Trigger className="select-trigger">
								<Select.Value />
								<Select.Icon>
									<CaretDownIcon className="w-3.5 h-3.5 text-neutral-500" />
								</Select.Icon>
							</Select.Trigger>
							<Select.Portal>
								<Select.Content className="select-content">
									<Select.Viewport className="select-viewport">
										{businessProcesses.map((bp) => (
											<Select.Item
												key={bp.id}
												value={String(bp.id)}
												className="select-item"
											>
												<Select.ItemText>{bp.name}</Select.ItemText>
												<Select.ItemIndicator className="select-item-indicator">
													<CheckIcon className="w-3.5 h-3.5" weight="bold" />
												</Select.ItemIndicator>
											</Select.Item>
										))}
										{activeProcess && activeProcess.id !== 1 && (
											<>
												<Select.Separator className="select-separator" />
												<Select.Item
													value="delete"
													className="select-item select-item-delete"
												>
													<Select.ItemText>
														<TrashIcon
															className="w-3 h-3 inline mr-1.5"
															weight="bold"
														/>
														Delete "{activeProcess.name}"
													</Select.ItemText>
												</Select.Item>
											</>
										)}
									</Select.Viewport>
								</Select.Content>
							</Select.Portal>
						</Select.Root>

						{/* Small vertical divider */}
						<div className="w-[1px] h-4 bg-neutral-200" />

						{/* Import button inside the switcher */}
						<button
							type="button"
							onClick={() => setImportDialogOpen(true)}
							className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-neutral-500 hover:text-neutral-900 hover:bg-white hover:shadow-xs rounded-md cursor-pointer transition-all border border-transparent hover:border-neutral-200"
							style={{ height: "28px", lineHeight: 1 }}
						>
							<UploadIcon className="w-3.5 h-3.5" />
							<span className="hidden sm:inline">Import</span>
						</button>
						<input
							ref={fileInputRef}
							type="file"
							accept=".bpmn,.xml"
							onChange={onFileImport}
							className="hidden"
						/>
					</div>

					{/* Audit Assessment Session Switcher */}
					<div
						className="flex items-center gap-1.5 bg-neutral-50 p-1 rounded-md"
						style={{ boxShadow: "rgba(0, 0, 0, 0.08) 0px 0px 0px 1px" }}
					>
						<span className="text-xs font-bold text-neutral-500 px-1.5 hidden md:inline">
							Session
						</span>
						<Select.Root
							value={String(activeAuditAssessmentId ?? "")}
							onValueChange={(val) => {
								if (val === "create-to-be") {
									onCreateAuditAssessment("To-Be");
								} else if (val === "create-as-is") {
									onCreateAuditAssessment("As-Is");
								} else {
									const id = parseInt(val, 10);
									if (id) onAuditAssessmentChange(id);
								}
							}}
							disabled={isLoading || !activeBusinessProcessId}
						>
							<Select.Trigger className="select-trigger">
								<Select.Value />
								<Select.Icon>
									<CaretDownIcon className="w-3.5 h-3.5 text-neutral-500" />
								</Select.Icon>
							</Select.Trigger>
							<Select.Portal>
								<Select.Content className="select-content">
									<Select.Viewport className="select-viewport">
										{(() => {
											const filtered = auditAssessments.filter(
												(a) => a.processId === activeBusinessProcessId,
											);
											const counts: Record<string, number> = {};
											const labels: Record<number, string> = {};
											for (const a of filtered) {
												counts[a.auditType] = (counts[a.auditType] || 0) + 1;
											}
											const seen: Record<string, number> = {};
											for (const a of filtered) {
												seen[a.auditType] = (seen[a.auditType] || 0) + 1;
												labels[a.id] =
													counts[a.auditType] > 1
														? `${a.auditType} ${seen[a.auditType]}`
														: a.auditType;
											}
											return filtered.map((a) => (
												<Select.Item
													key={a.id}
													value={String(a.id)}
													className="select-item"
												>
													<Select.ItemText>{labels[a.id]}</Select.ItemText>
													<Select.ItemIndicator className="select-item-indicator">
														<CheckIcon className="w-3.5 h-3.5" weight="bold" />
													</Select.ItemIndicator>
												</Select.Item>
											));
										})()}
										<Select.Separator className="select-separator" />
										<Select.Item
											value="create-to-be"
											className="select-item select-item-action"
										>
											<Select.ItemText>+ New To-Be Session</Select.ItemText>
										</Select.Item>
										<Select.Item
											value="create-as-is"
											className="select-item select-item-action"
										>
											<Select.ItemText>+ New As-Is Session</Select.ItemText>
										</Select.Item>
									</Select.Viewport>
								</Select.Content>
							</Select.Portal>
						</Select.Root>
					</div>

					{activeView === "editor" && elementsCount > 0 && (
						<button
							type="button"
							onClick={onToggleSidebar}
							className="lg:hidden flex items-center justify-center w-9 h-9 rounded-md text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50"
							style={{ borderRadius: "6px" }}
							title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
						>
							<ListIcon className="w-5 h-5" />
						</button>
					)}

					<button
						type="button"
						onClick={onExport}
						disabled={elementsCount === 0}
						className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
						style={{ borderRadius: "6px" }}
						title="Export enriched BPMN"
					>
						<DownloadIcon className="w-4 h-4" />
						<span>Export</span>
					</button>

					<div
						className="flex items-center gap-0.5 p-0.5 bg-neutral-50"
						style={{
							borderRadius: "6px",
							boxShadow: "rgba(0, 0, 0, 0.08) 0px 0px 0px 1px",
						}}
					>
						<button
							type="button"
							onClick={() => onViewChange("editor")}
							className={`flex items-center gap-1.5 px-3 py-1 text-sm font-medium rounded-md transition-all ${
								activeView === "editor"
									? "bg-white text-neutral-900 shadow-sm"
									: "text-neutral-500 hover:text-neutral-900"
							}`}
						>
							<PencilSimpleIcon className="w-3.5 h-3.5" />
							<span className="hidden sm:inline">Editor</span>
						</button>
						<button
							type="button"
							onClick={() => onViewChange("matrix")}
							className={`flex items-center gap-1.5 px-3 py-1 text-sm font-medium rounded-md transition-all ${
								activeView === "matrix"
									? "bg-white text-neutral-900 shadow-sm"
									: "text-neutral-500 hover:text-neutral-900"
							}`}
						>
							<GridFourIcon className="w-3.5 h-3.5" />
							<span className="hidden sm:inline">Matrix</span>
						</button>
					</div>

					{elementsCount > 0 && (
						<button
							type="button"
							onClick={onReposition}
							className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50 rounded-md transition-colors"
							style={{ borderRadius: "6px" }}
							title="Auto-arrange annotations"
						>
							<ArrowsOutIcon className="w-4 h-4" />
							<span>Arrange</span>
						</button>
					)}

					{elementsCount > 0 && onReset && (
						<button
							type="button"
							onClick={onReset}
							className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
							style={{ borderRadius: "6px" }}
							title="Reset process model answers"
						>
							<ArrowCounterClockwiseIcon className="w-4 h-4" />
							<span>Reset Model</span>
						</button>
					)}
				</div>
			</div>
			<ImportConfirmDialog
				isOpen={importDialogOpen}
				onClose={() => setImportDialogOpen(false)}
				onConfirm={() => {
					fileInputRef.current?.click();
				}}
			/>
			<DeleteProcessConfirmDialog
				isOpen={deleteDialogOpen}
				processName={deleteTarget?.name ?? ""}
				onClose={() => setDeleteDialogOpen(false)}
				onConfirm={() => {
					if (deleteTarget) {
						onDeleteBusinessProcess(deleteTarget.id);
						setDeleteTarget(null);
					}
				}}
			/>
		</header>
	);
}
