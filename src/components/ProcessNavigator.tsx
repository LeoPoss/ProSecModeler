import { TypeIcon } from "#/lib/constants";
import type { ProcessElement } from "#/lib/types";

function ProcessNavigator({
	elements,
	selected,
	onSelect,
	overallProgress,
}: {
	elements: ProcessElement[];
	selected: { id: string; name: string; type: string } | null;
	onSelect: (el: { id: string; name: string; type: string }) => void;
	overallProgress: { answered: number; total: number; percentage: number };
}) {
	return (
		<div className="flex flex-col h-full">
			<div className="px-3 py-3" style={{ borderBottom: "1px solid #ebebeb" }}>
				<div className="flex items-center justify-between mb-2">
					<h3 className="text-xs font-semibold text-neutral-500">Progress</h3>
					{overallProgress.total > 0 && (
						<span
							className={`text-xs font-medium ${overallProgress.percentage === 100 ? "text-green-500" : "text-neutral-500"}`}
						>
							{overallProgress.answered}/{overallProgress.total}
						</span>
					)}
				</div>
				{overallProgress.total > 0 && (
					<div className="flex items-center gap-2">
						<div
							className="flex-1 h-1.5 rounded-full overflow-hidden"
							style={{ background: "#fafafa" }}
						>
							<div
								className="h-full rounded-full transition-all"
								style={{
									width: `${overallProgress.percentage}%`,
									backgroundColor:
										overallProgress.percentage === 100 ? "#22c55e" : "#171717",
								}}
							/>
						</div>
						<span className="text-xs text-neutral-500 tabular-nums">
							{overallProgress.percentage}%
						</span>
					</div>
				)}
			</div>
			<div className="flex-1 overflow-y-auto py-1">
				{elements.length === 0 ? (
					<p className="px-3 py-4 text-xs text-neutral-500 text-center">
						No elements with requirements
					</p>
				) : (
					<div className="px-2">
						{elements.map((el, idx) => {
							const isSelected = selected?.id === el.id;
							const isComplete =
								el.answeredCount === el.totalCount && el.totalCount > 0;
							const progress =
								el.totalCount > 0
									? (el.answeredCount / el.totalCount) * 100
									: 0;

							return (
								<button
									key={el.id}
									type="button"
									onClick={() => onSelect(el)}
									className={`w-full flex items-center gap-2 px-2 py-2 rounded-md text-left transition-colors ${
										isSelected
											? "bg-neutral-900/10 text-neutral-900"
											: "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"
									}`}
								>
									<span className="text-xs font-mono text-neutral-500/60 w-4">
										{idx + 1}
									</span>
									<div className="text-neutral-900/70">
										<TypeIcon type={el.type} />
									</div>
									<div className="flex-1 min-w-0">
										<p className="text-sm font-medium truncate text-neutral-900">
											{el.name}
										</p>
										{progress > 0 && (
											<div
												className="mt-1 h-1 rounded-full overflow-hidden"
												style={{ background: "#fafafa" }}
											>
												<div
													className="h-full rounded-full transition-all"
													style={{
														width: `${progress}%`,
														backgroundColor: isComplete ? "#22c55e" : "#171717",
													}}
												/>
											</div>
										)}
									</div>
									{isComplete && (
										<span className="text-green-500">
											<svg
												width="14"
												height="14"
												viewBox="0 0 24 24"
												fill="none"
												aria-label="Complete"
											>
												<title>Complete</title>
												<path
													d="M5 13l4 4L19 7"
													stroke="currentColor"
													strokeWidth="2"
													strokeLinecap="round"
													strokeLinejoin="round"
												/>
											</svg>
										</span>
									)}
								</button>
							);
						})}
					</div>
				)}
			</div>
			<div
				className="px-3 py-2 text-xs text-neutral-500 text-center"
				style={{ borderTop: "1px solid #ebebeb" }}
			>
				<kbd
					className="px-1 py-0.5 mx-0.5 rounded font-mono"
					style={{
						background: "#fafafa",
						boxShadow: "rgba(0, 0, 0, 0.08) 0px 0px 0px 1px",
					}}
				>
					←
				</kbd>
				<kbd
					className="px-1 py-0.5 mx-0.5 rounded font-mono"
					style={{
						background: "#fafafa",
						boxShadow: "rgba(0, 0, 0, 0.08) 0px 0px 0px 1px",
					}}
				>
					→
				</kbd>
				<span className="ml-1">to navigate</span>
			</div>
		</div>
	);
}

export default ProcessNavigator;
