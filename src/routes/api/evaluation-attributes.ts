import { createFileRoute } from "@tanstack/react-router";
import { Result } from "better-result";
import { eq, like } from "drizzle-orm";
import { db } from "#/db/connection";
import {
	complianceRequirementAttributes,
	complianceRequirements,
	evaluationAttributes,
} from "#/db/schema";
import { DatabaseError } from "#/lib/errors";

function typeToApplicableFor(type: string): string {
	switch (type) {
		case "task":
		case "bpmn:Task":
			return "Task";
		case "message_event":
		case "bpmn:IntermediateCatchEvent":
		case "bpmn:IntermediateThrowEvent":
			return "Message Event";
		case "pool":
		case "bpmn:Participant":
			return "Pool";
		case "lane":
		case "bpmn:Lane":
			return "Lane";
		default:
			return type;
	}
}

/**
 * Map a DB evaluation attribute row + linked requirement description → frontend Requirement shape.
 */
function toRequirement(
	attr: typeof evaluationAttributes.$inferSelect,
	reqDescription?: string,
	reqQuestion?: string,
) {
	const applicable = attr.targetScope || "";
	return {
		id: String(attr.id),
		requirement: reqDescription || attr.label,
		question: reqQuestion,
		category: attr.category || "General",
		subcategory: attr.subcategory || "",
		external_id: attr.externalId || "",
		bpmn_mapping: {
			task: applicable.includes("Task"),
			message_event: applicable.includes("Message Event"),
			pool: applicable.includes("Pool"),
			lane: applicable.includes("Lane"),
		},
		further_specification: attr.furtherSpecification || "",
		bpmn_annotation: attr.annotationTemplate || attr.label,
		bpmn_template: buildTemplate(attr),
	};
}

function buildTemplate(attr: typeof evaluationAttributes.$inferSelect): string {
	if (attr.dataType === "Dropdown" && attr.options) {
		return `Dropdown[${attr.options}]`;
	}
	if (attr.dataType === "TextInput") return "TextInput";
	return "BooleanToggle";
}

export const Route = createFileRoute("/api/evaluation-attributes")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const url = new URL(request.url);
				const typeParam = url.searchParams.get("type");

				const queryResult = Result.try({
					try: () => {
						const query = db
							.select({
								attribute: evaluationAttributes,
								requirementDescription: complianceRequirements.description,
								requirementQuestion: complianceRequirements.question,
							})
							.from(evaluationAttributes)
							.leftJoin(
								complianceRequirementAttributes,
								eq(
									evaluationAttributes.id,
									complianceRequirementAttributes.attributeId,
								),
							)
							.leftJoin(
								complianceRequirements,
								eq(
									complianceRequirementAttributes.requirementId,
									complianceRequirements.id,
								),
							);

						const rows = typeParam
							? query
									.where(
										like(
											evaluationAttributes.targetScope,
											`%${typeToApplicableFor(typeParam)}%`,
										),
									)
									.all()
							: query.all();

						return rows.map(
							({ attribute, requirementDescription, requirementQuestion }) =>
								toRequirement(
									attribute,
									requirementDescription || undefined,
									requirementQuestion || undefined,
								),
						);
					},
					catch: (cause) =>
						new DatabaseError({
							message: "Failed to query evaluation attributes",
							cause,
						}),
				});

				return queryResult.match({
					ok: (data) => Response.json(data),
					err: (error) =>
						Response.json({ error: error.message }, { status: 500 }),
				});
			},
		},
	},
});
