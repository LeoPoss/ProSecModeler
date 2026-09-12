import { Result } from "better-result";
import { atom, getDefaultStore } from "jotai";
import { api } from "./api";
import { BASE_URL } from "./constants";
import type {
	AnsweredComplianceRequirement,
	ComplianceRequirement,
	SelectedElement,
} from "./types";

interface ElementRegistry {
	get(id: string):
		| {
				id: string;
				type: string;
				businessObject?: { name?: string; $parent?: any };
		  }
		| undefined;
	getAll(): {
		id: string;
		type: string;
		businessObject?: { name?: string; $parent?: any };
	}[];
}

export const complianceRequirementsAtom = atom<ComplianceRequirement[]>([]);
export const answeredComplianceRequirementsAtom = atom<
	AnsweredComplianceRequirement[]
>([]);
export const selectedElementAtom = atom<SelectedElement | null>(null);
export const bpmnXmlAtom = atom<string>("");
export const elementRegistryAtom = atom<ElementRegistry | null>(null);
export const auditAssessmentIdAtom = atom<number | null>(null);
export const auditTypeAtom = atom<string>("To-Be");
export const businessProcessIdAtom = atom<number | null>(null);
export const businessProcessesAtom = atom<
	{ id: number; name: string; processName: string }[]
>([]);
export const auditAssessmentsAtom = atom<
	{
		id: number;
		auditType: string;
		processId: number | null;
		processName: string | null;
	}[]
>([]);
export const loadingAtom = atom<boolean>(false);

const baseStore = getDefaultStore();

export interface OverallProgress {
	answered: number;
	total: number;
	percentage: number;
}

export const store = {
	isLoading() {
		return baseStore.get(loadingAtom);
	},

	async init(): Promise<void> {
		baseStore.set(loadingAtom, true);

		const result = await Result.gen(async function* () {
			yield* Result.await(
				Result.allAsync([
					store.fetchComplianceRequirementsResult(),
					store.fetchBusinessProcessesResult(),
					store.fetchAuditAssessmentsResult(),
				]),
			);

			const bp = await store.loadLatestBusinessProcess();
			if (bp) {
				const auditAssessmentsList = baseStore
					.get(auditAssessmentsAtom)
					.filter((a) => a.processId === bp.id);

				if (auditAssessmentsList.length > 0) {
					baseStore.set(auditAssessmentIdAtom, auditAssessmentsList[0].id);
					baseStore.set(auditTypeAtom, auditAssessmentsList[0].auditType);
				} else {
					const createdId = await store.createAuditAssessmentSilent("To-Be");
					await store.fetchAuditAssessmentsResult();
					baseStore.set(auditAssessmentIdAtom, createdId);
					baseStore.set(auditTypeAtom, "To-Be");
				}
				await store.fetchAssessmentValues();
			} else {
				baseStore.set(businessProcessIdAtom, null);
				baseStore.set(bpmnXmlAtom, "");
				baseStore.set(auditAssessmentIdAtom, null);
			}

			return Result.ok();
		});

		result.match({
			ok: () => {},
			err: (error) => console.error("Store initialization failed:", error),
		});

		baseStore.set(loadingAtom, false);
	},

	async reload(): Promise<void> {
		baseStore.set(loadingAtom, true);
		baseStore.set(selectedElementAtom, null);

		const result = await Result.gen(async function* () {
			yield* Result.await(
				Result.allAsync([
					store.fetchComplianceRequirementsResult(),
					store.fetchBusinessProcessesResult(),
					store.fetchAuditAssessmentsResult(),
				]),
			);

			const bpId = baseStore.get(businessProcessIdAtom);
			if (bpId) {
				const bpRes = await api.get<{ bpmnDefinition?: string }>(
					`${BASE_URL}/business-processes/${bpId}`,
				);
				if (bpRes.isOk() && bpRes.value.bpmnDefinition) {
					baseStore.set(bpmnXmlAtom, bpRes.value.bpmnDefinition);
				}
			}

			if (baseStore.get(auditAssessmentIdAtom)) {
				await store.fetchAssessmentValues();
			}

			return Result.ok();
		});

		result.match({
			ok: () => {},
			err: (error) => console.error("Reload failed:", error),
		});

		baseStore.set(loadingAtom, false);
	},

	getAuditAssessmentId() {
		return baseStore.get(auditAssessmentIdAtom);
	},
	getAuditType() {
		return baseStore.get(auditTypeAtom);
	},
	getAuditAssessments() {
		return baseStore.get(auditAssessmentsAtom);
	},

	getBusinessProcessId() {
		return baseStore.get(businessProcessIdAtom);
	},
	getBusinessProcesses() {
		return baseStore.get(businessProcessesAtom);
	},

	async setBusinessProcessId(id: number | null): Promise<void> {
		baseStore.set(loadingAtom, true);
		baseStore.set(businessProcessIdAtom, id);
		baseStore.set(selectedElementAtom, null);
		baseStore.set(answeredComplianceRequirementsAtom, []);

		if (id) {
			const bpRes = await api.get<{ id: number; bpmnDefinition?: string }>(
				`${BASE_URL}/business-processes/${id}`,
			);
			if (bpRes.isOk() && bpRes.value.bpmnDefinition) {
				baseStore.set(bpmnXmlAtom, bpRes.value.bpmnDefinition);
			}

			await this.fetchAuditAssessmentsResult();
			const auditAssessmentsList = baseStore
				.get(auditAssessmentsAtom)
				.filter((a) => a.processId === id);

			if (auditAssessmentsList.length > 0) {
				baseStore.set(auditAssessmentIdAtom, auditAssessmentsList[0].id);
				baseStore.set(auditTypeAtom, auditAssessmentsList[0].auditType);
			} else {
				const createdId = await this.createAuditAssessmentSilent("To-Be");
				await this.fetchAuditAssessmentsResult();
				baseStore.set(auditAssessmentIdAtom, createdId);
				baseStore.set(auditTypeAtom, "To-Be");
			}
			await this.fetchAssessmentValues();
		} else {
			baseStore.set(bpmnXmlAtom, "");
			baseStore.set(auditAssessmentIdAtom, null);
		}
		baseStore.set(loadingAtom, false);
	},

	async importBusinessProcess(name: string, xml: string): Promise<number> {
		baseStore.set(loadingAtom, true);
		try {
			const id = await this.saveBusinessProcess(name, xml);
			await this.fetchBusinessProcessesResult();
			await this.setBusinessProcessId(id);
			return id;
		} catch (err) {
			console.error("Failed to import business process:", err);
			throw err;
		} finally {
			baseStore.set(loadingAtom, false);
		}
	},

	async ensureAuditAssessment(): Promise<number> {
		const auditId = baseStore.get(auditAssessmentIdAtom);
		if (auditId) return auditId;

		const bpId = baseStore.get(businessProcessIdAtom);
		let existing = baseStore
			.get(auditAssessmentsAtom)
			.find((a) => a.processId === bpId);

		if (!existing) {
			const listRes = await this.fetchAuditAssessmentsResult();
			if (listRes.isOk()) {
				existing = listRes.value.find((a) => a.processId === bpId);
			}
		}

		if (existing) {
			baseStore.set(auditAssessmentIdAtom, existing.id);
			baseStore.set(auditTypeAtom, existing.auditType);
			return existing.id;
		}

		const createdId = await this.createAuditAssessmentSilent("To-Be");
		await this.fetchAuditAssessmentsResult();
		baseStore.set(auditAssessmentIdAtom, createdId);
		baseStore.set(auditTypeAtom, "To-Be");
		return createdId;
	},

	async fetchAuditAssessmentsResult() {
		const res = await api.get<
			Array<{
				id: number;
				auditType: string;
				processId: number | null;
				processName: string | null;
			}>
		>(`${BASE_URL}/audit-assessments`);

		return res.map((data) => {
			const mapped = data.map((a) => ({
				id: a.id,
				auditType: a.auditType,
				processId: a.processId,
				processName: a.processName,
			}));
			baseStore.set(auditAssessmentsAtom, mapped);
			return mapped;
		});
	},

	async fetchBusinessProcessesResult() {
		const res = await api.get<
			Array<{
				id: number;
				name?: string;
				processName?: string;
			}>
		>(`${BASE_URL}/business-processes`);

		return res.map((data) => {
			const mapped = data.map((bp) => ({
				id: bp.id,
				name: bp.processName || bp.name || `Process ${bp.id}`,
				processName: bp.processName || bp.name || `Process ${bp.id}`,
			}));
			baseStore.set(businessProcessesAtom, mapped);
			return mapped;
		});
	},

	async setAuditAssessment(id: number): Promise<void> {
		baseStore.set(loadingAtom, true);
		baseStore.set(auditAssessmentIdAtom, id);
		baseStore.set(selectedElementAtom, null);
		baseStore.set(answeredComplianceRequirementsAtom, []);

		let audit = baseStore.get(auditAssessmentsAtom).find((a) => a.id === id);
		if (!audit) {
			const listRes = await this.fetchAuditAssessmentsResult();
			audit = listRes.unwrapOr([]).find((a) => a.id === id);
		}

		if (audit) {
			baseStore.set(auditTypeAtom, audit.auditType);
			const bpId = baseStore.get(businessProcessIdAtom);
			if (audit.processId && audit.processId !== bpId) {
				const bpRes = await api.get<{
					id: number;
					bpmnDefinition?: string;
				}>(`${BASE_URL}/business-processes/${audit.processId}`);

				if (bpRes.isOk() && bpRes.value.bpmnDefinition) {
					baseStore.set(businessProcessIdAtom, bpRes.value.id);
					baseStore.set(bpmnXmlAtom, bpRes.value.bpmnDefinition);
				}
			}
		}

		await this.fetchAssessmentValues();
		baseStore.set(loadingAtom, false);
	},

	async createAuditAssessmentSilent(type: string = "To-Be"): Promise<number> {
		const bpId = baseStore.get(businessProcessIdAtom);
		const res = await api.post<{ id: number }>(
			`${BASE_URL}/audit-assessments`,
			{
				auditType: type,
				processId: bpId || null,
			},
		);

		return res.match({
			ok: (created) => created.id,
			err: (error) => {
				console.error("Failed to create audit assessment:", error);
				throw new Error(error.message);
			},
		});
	},

	async createAuditAssessment(
		type: "To-Be" | "As-Is" = "To-Be",
	): Promise<number> {
		baseStore.set(loadingAtom, true);
		try {
			const id = await this.createAuditAssessmentSilent(type);
			await this.fetchAuditAssessmentsResult();
			baseStore.set(auditAssessmentIdAtom, id);
			baseStore.set(auditTypeAtom, type);
			baseStore.set(answeredComplianceRequirementsAtom, []);
			await this.fetchAssessmentValues();
		} catch (err) {
			console.error("Failed to create audit assessment:", err);
		} finally {
			baseStore.set(loadingAtom, false);
		}
		return baseStore.get(auditAssessmentIdAtom)!;
	},

	async saveBusinessProcess(name: string, xml?: string): Promise<number> {
		const bpmnXml = xml ?? baseStore.get(bpmnXmlAtom);
		const res = await api.post<{ id: number }>(
			`${BASE_URL}/business-processes`,
			{ processName: name, bpmnDefinition: bpmnXml },
		);

		return res.match({
			ok: (created) => created.id,
			err: (error) => {
				console.error("Failed to save business process:", error);
				throw new Error(error.message);
			},
		});
	},

	async updateBusinessProcess(id: number, xml?: string): Promise<void> {
		const bpmnXml = xml ?? baseStore.get(bpmnXmlAtom);
		if (xml) baseStore.set(bpmnXmlAtom, xml);

		const res = await api.put(`${BASE_URL}/business-processes/${id}`, {
			bpmnDefinition: bpmnXml,
		});

		if (res.isErr()) {
			console.error("Failed to update business process:", res.error);
		}
	},

	async deleteBusinessProcess(id: number): Promise<void> {
		const res = await api.delete(`${BASE_URL}/business-processes/${id}`);
		if (res.isErr()) {
			throw new Error(res.error.message);
		}
	},

	async loadLatestBusinessProcess(): Promise<{
		id: number;
		processName: string;
		bpmnDefinition: string | null;
	} | null> {
		const res = await api.get<{
			id: number;
			processName: string;
			bpmnDefinition: string | null;
		} | null>(`${BASE_URL}/business-processes`, { params: { latest: "true" } });

		if (res.isOk() && res.value) {
			baseStore.set(businessProcessIdAtom, res.value.id);
			baseStore.set(bpmnXmlAtom, res.value.bpmnDefinition || "");
			return res.value;
		}
		return null;
	},

	getComplianceRequirements() {
		return baseStore.get(complianceRequirementsAtom);
	},

	setComplianceRequirements(data: ComplianceRequirement[]) {
		baseStore.set(complianceRequirementsAtom, data);
	},

	async fetchComplianceRequirementsResult() {
		const res = await api.get<ComplianceRequirement[]>(
			`${BASE_URL}/evaluation-attributes`,
		);
		return res.map((data) => {
			this.setComplianceRequirements(data);
			return data;
		});
	},

	async fetchAssessmentValues(): Promise<void> {
		const auditId = await this.ensureAuditAssessment();
		const bpId = baseStore.get(businessProcessIdAtom);

		const res = await api.get<
			Array<{
				assessmentId: number;
				attributeId: number;
				processElementId: number;
				bpmnElementId: string;
				recordedValue: string | null;
			}>
		>(`${BASE_URL}/audit-assessments/${auditId}/values`, {
			params: bpId ? { process_id: bpId } : undefined,
		});

		res.match({
			ok: (rows) => {
				const answered: AnsweredComplianceRequirement[] = rows.map((row) => {
					const finalVal = row.recordedValue;
					let parsedValue: string | boolean | null = finalVal;
					if (finalVal === "true") parsedValue = true;
					else if (finalVal === "false") parsedValue = false;

					return {
						elementId: row.bpmnElementId,
						requirementId: String(row.attributeId),
						value: parsedValue,
					};
				});

				baseStore.set(answeredComplianceRequirementsAtom, answered);
			},
			err: (error) => {
				console.error("Failed to fetch assessment values:", error);
			},
		});
	},

	getAnsweredComplianceRequirements() {
		return baseStore.get(answeredComplianceRequirementsAtom);
	},

	setAnsweredComplianceRequirements(data: AnsweredComplianceRequirement[]) {
		baseStore.set(answeredComplianceRequirementsAtom, data);
	},

	async answerComplianceRequirement(
		elementId: string,
		requirementId: string,
		value: string | boolean | null | undefined,
		elementType?: string,
		elementName?: string,
	) {
		const auditId = await this.ensureAuditAssessment();
		const bpId = baseStore.get(businessProcessIdAtom);
		const wertVal =
			value === undefined || value === null ? null : String(value);

		const res = await api.put(
			`${BASE_URL}/audit-assessments/${auditId}/values`,
			{
				attributeId: parseInt(requirementId, 10),
				bpmnElementId: elementId,
				elementType: elementType || "",
				elementName: elementName || elementId,
				processId: bpId || undefined,
				recordedValue: wertVal,
			},
		);

		if (res.isErr()) {
			console.error("Failed to persist answer:", res.error);
			return;
		}

		baseStore.set(answeredComplianceRequirementsAtom, (prev) => {
			const idx = prev.findIndex(
				(a) => a.elementId === elementId && a.requirementId === requirementId,
			);
			if (idx >= 0) {
				if (value === undefined) return prev.filter((_, i) => i !== idx);
				return prev.map((a, i) =>
					i === idx ? { elementId, requirementId, value } : a,
				);
			}
			if (value !== undefined)
				return [...prev, { elementId, requirementId, value }];
			return prev;
		});
	},

	getAnswer(
		elementId: string,
		requirementId: string,
	): string | boolean | null | undefined {
		const answer = baseStore
			.get(answeredComplianceRequirementsAtom)
			.find(
				(a) => a.elementId === elementId && a.requirementId === requirementId,
			);
		return answer?.value;
	},

	getAnswersForElement(elementId: string): AnsweredComplianceRequirement[] {
		return baseStore
			.get(answeredComplianceRequirementsAtom)
			.filter((a) => a.elementId === elementId);
	},

	getSelectedElement() {
		return baseStore.get(selectedElementAtom);
	},

	setSelectedElement(element: SelectedElement | null) {
		baseStore.set(selectedElementAtom, element);
	},

	getBpmnXml() {
		return baseStore.get(bpmnXmlAtom);
	},

	setBpmnXml(xml: string) {
		baseStore.set(bpmnXmlAtom, xml);
	},

	setElementRegistry(registry: ElementRegistry) {
		baseStore.set(elementRegistryAtom, registry);
	},

	getElementRegistry(): ElementRegistry | null {
		return baseStore.get(elementRegistryAtom);
	},

	getElementsWithQuestions(): { id: string; name: string; type: string }[] {
		const registry = baseStore.get(elementRegistryAtom);
		if (!registry) return [];

		const elements = registry.getAll();
		const result: { id: string; name: string; type: string }[] = [];

		for (const element of elements) {
			if (!element.businessObject) continue;

			const type = element.type;
			const reqs = this.getComplianceRequirementsForElement(type);

			if (reqs.length > 0) {
				result.push({
					id: element.id,
					name: element.businessObject?.name || element.id,
					type,
				});
			}
		}

		return result;
	},

	getOverallProgress(): OverallProgress {
		const elements = this.getElementsWithQuestions();
		let total = 0;
		let answered = 0;

		for (const element of elements) {
			const reqs = this.getComplianceRequirementsForElement(element.type);
			total += reqs.length;

			const answers = this.getAnswersForElement(element.id);
			answered += answers.length;
		}

		return {
			answered,
			total,
			percentage: total > 0 ? Math.round((answered / total) * 100) : 0,
		};
	},

	getComplianceRequirementsForElement(
		elementType: string,
	): ComplianceRequirement[] {
		const requirementsList = baseStore.get(complianceRequirementsAtom);
		switch (elementType) {
			case "bpmn:Task":
			case "Task":
				return requirementsList.filter((r) => r.bpmn_mapping.task);
			case "bpmn:IntermediateCatchEvent":
			case "bpmn:IntermediateThrowEvent":
			case "MessageEvent":
				return requirementsList.filter((r) => r.bpmn_mapping.message_event);
			case "bpmn:Participant":
			case "Pool":
			case "bpmn:Lane":
			case "Lane":
				return requirementsList.filter((r) => r.bpmn_mapping.pool);
			default:
				return [];
		}
	},

	getProgressForElement(elementId: string, elementType: string) {
		const reqs = this.getComplianceRequirementsForElement(elementType);
		const answers = this.getAnswersForElement(elementId);

		return {
			answered: answers.length,
			total: reqs.length,
			status:
				reqs.length === 0
					? ("completed" as const)
					: answers.length === 0
						? ("not-started" as const)
						: answers.length === reqs.length
							? ("completed" as const)
							: ("in-progress" as const),
		};
	},

	async fetchValuesForAssessment(
		assessmentId: number,
	): Promise<AnsweredComplianceRequirement[]> {
		const bpId = baseStore.get(businessProcessIdAtom);
		const res = await api.get<
			Array<{
				assessmentId: number;
				attributeId: number;
				processElementId: number;
				bpmnElementId: string;
				elementType: string;
				elementName: string | null;
				recordedValue: string | null;
			}>
		>(`${BASE_URL}/audit-assessments/${assessmentId}/values`, {
			params: bpId ? { process_id: bpId } : undefined,
		});

		return res.match({
			ok: (rows) =>
				rows.map((row) => {
					const finalVal = row.recordedValue;
					let parsedValue: string | boolean | null = finalVal;
					if (finalVal === "true") parsedValue = true;
					else if (finalVal === "false") parsedValue = false;

					return {
						elementId: row.bpmnElementId,
						requirementId: String(row.attributeId),
						value: parsedValue,
						elementType: row.elementType,
						elementName: row.elementName ?? undefined,
					};
				}),
			err: (error) => {
				console.error(
					`Failed to fetch values for assessment ${assessmentId}:`,
					error,
				);
				return [];
			},
		});
	},

	subscribe(listener: () => void) {
		const unsubAnswered = baseStore.sub(
			answeredComplianceRequirementsAtom,
			listener,
		);
		const unsubXml = baseStore.sub(bpmnXmlAtom, listener);
		const unsubLoading = baseStore.sub(loadingAtom, listener);
		return () => {
			unsubAnswered();
			unsubXml();
			unsubLoading();
		};
	},
};
