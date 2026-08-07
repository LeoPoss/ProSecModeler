"use client";

import { UploadIcon, XIcon } from "@phosphor-icons/react";
import * as Dialog from "@radix-ui/react-dialog";

interface ImportConfirmDialogProps {
	isOpen: boolean;
	onClose: () => void;
	onConfirm: () => void;
}

export default function ImportConfirmDialog({
	isOpen,
	onClose,
	onConfirm,
}: ImportConfirmDialogProps) {
	return (
		<Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
			<Dialog.Portal>
				<Dialog.Overlay
					className="fixed inset-0 bg-neutral-950/40 backdrop-blur-xs z-50 transition-opacity duration-200"
					style={{ animation: "overlayFadeIn 0.2s ease-out" }}
				/>
				<Dialog.Content
					className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl p-6 w-[90%] max-w-md shadow-2xl z-50 border border-neutral-100 focus:outline-none"
					style={{
						animation: "modalFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
					}}
				>
					<div className="flex items-start gap-4">
						<div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 shrink-0 border border-blue-100">
							<UploadIcon className="w-5 h-5" weight="bold" />
						</div>
						<div className="flex-1">
							<Dialog.Title className="text-base font-semibold text-neutral-900 leading-tight">
								Import Process Model
							</Dialog.Title>
							<Dialog.Description className="text-xs text-neutral-500 mt-2 leading-relaxed">
								Process models are saved publicly on the server and visible to
								all users. Continue to select a BPMN file to import.
							</Dialog.Description>
						</div>
						<Dialog.Close asChild>
							<button
								type="button"
								onClick={onClose}
								className="text-neutral-400 hover:text-neutral-600 p-1.5 rounded-lg hover:bg-neutral-50 transition-colors"
								aria-label="Close"
							>
								<XIcon className="w-4 h-4" />
							</button>
						</Dialog.Close>
					</div>

					<div className="mt-6 flex justify-end gap-3">
						<Dialog.Close asChild>
							<button
								type="button"
								onClick={onClose}
								className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-800 hover:bg-neutral-50 rounded-lg transition-colors cursor-pointer border border-neutral-200"
							>
								Cancel
							</button>
						</Dialog.Close>
						<button
							type="button"
							onClick={() => {
								onConfirm();
								onClose();
							}}
							className="px-4 py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg shadow-sm transition-colors cursor-pointer"
						>
							Choose File
						</button>
					</div>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
