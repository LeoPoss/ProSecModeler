import { eq } from "drizzle-orm";
import { demoBpmnFiles } from "../lib/demos";
import mappingData from "../lib/mapping.json";
import { db } from "./connection";
import {
	assessmentValues,
	auditAssessments,
	businessProcesses,
	complianceRequirementAttributes,
	complianceRequirements,
	evaluationAttributes,
	processElements,
	regulationStandards,
} from "./schema";

interface MappingRequirement {
	id: string;
	requirement: string;
	question: string;
	category: string;
	subcategory: string;
	external_id: string;
	bpmn_mapping: {
		task: boolean;
		message_event: boolean;
		pool: boolean;
		lane: boolean;
	};
	further_specification: string;
	bpmn_annotation: string;
	bpmn_template: string;
}

function bpmnMappingToApplicableFor(
	mapping: MappingRequirement["bpmn_mapping"],
): string {
	const types: string[] = [];
	if (mapping.task) types.push("Task");
	if (mapping.message_event) types.push("Message Event");
	if (mapping.pool) types.push("Pool");
	if (mapping.lane) types.push("Lane");
	return types.join(",");
}

interface ParsedInputType {
	input_type: string;
	options: string | null;
}

function parseInputType(template: string): ParsedInputType {
	if (template === "BooleanToggle")
		return { input_type: "BooleanToggle", options: null };
	if (template.startsWith("Dropdown")) {
		const match = template.match(/\[(.*)\]/);
		return { input_type: "Dropdown", options: match ? match[1] : null };
	}
	if (template.startsWith("TextInput"))
		return { input_type: "TextInput", options: null };
	return { input_type: "TextInput", options: null };
}

async function seed() {
	db.delete(assessmentValues).run();
	db.delete(processElements).run();
	db.delete(businessProcesses).run();
	db.delete(auditAssessments).run();
	db.delete(complianceRequirementAttributes).run();
	db.delete(complianceRequirements).run();
	db.delete(evaluationAttributes).run();
	db.delete(regulationStandards).run();

	// Create the ISVS regulation standard
	db.insert(regulationStandards)
		.values({ title: "ISVS", securityLevel: "v1.0" })
		.run();
	const standard = db
		.select()
		.from(regulationStandards)
		.where(eq(regulationStandards.title, "ISVS"))
		.get()!;

	const entries = mappingData.requirements as MappingRequirement[];
	let attrCount = 0;

	for (const entry of entries) {
		const req = db
			.insert(complianceRequirements)
			.values({
				standardId: standard.id,
				description: entry.requirement,
				question: entry.question,
			})
			.returning()
			.get();

		const { input_type, options } = parseInputType(entry.bpmn_template);

		const attr = db
			.insert(evaluationAttributes)
			.values({
				label: entry.bpmn_annotation,
				targetScope: bpmnMappingToApplicableFor(entry.bpmn_mapping),
				dataType: input_type,
				options,
				externalId: entry.external_id,
				category: entry.category,
				subcategory: entry.subcategory,
				furtherSpecification: entry.further_specification,
				annotationTemplate: entry.bpmn_annotation,
			})
			.returning()
			.get();

		db.insert(complianceRequirementAttributes)
			.values({
				requirementId: req.id,
				attributeId: attr.id,
			})
			.run();

		attrCount++;
	}

	const demoXml = demoBpmnFiles["sensor-data-collection"];
	const pm = db
		.insert(businessProcesses)
		.values({
			processName: "Sensor Data Collection Demo",
			bpmnDefinition: demoXml,
		})
		.returning()
		.get();

	db.insert(auditAssessments)
		.values({
			auditType: "To-Be",
			processId: pm.id,
		})
		.run();

	console.log(
		`Seeded: 1 standard, ${entries.length} requirements, ${attrCount} attributes, ${attrCount} links`,
	);
	console.log(
		`Pre-seeded Demo Business Process and default "To-Be" audit assessment`,
	);
}

seed().catch((err) => {
	console.error("Seed failed:", err);
	process.exit(1);
});
