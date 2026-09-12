import { createFileRoute } from "@tanstack/react-router";
import { Result } from "better-result";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db/connection";
import {
	assessmentValues,
	auditAssessments,
	businessProcesses,
	processElements,
} from "#/db/schema";
import { DatabaseError, ValidationError } from "#/lib/errors";

const putValuesSchema = z.object({
	attributeId: z.number().int(),
	bpmnElementId: z.string().min(1),
	elementType: z.string(),
	elementName: z.string(),
	processId: z.number().int().optional(),
	recordedValue: z.string().nullable(),
});

export const Route = createFileRoute("/api/audit-assessments/$id/values")({
	server: {
		handlers: {
			GET: async ({ params, request }) => {
				const assessmentId = parseInt(params.id, 10);
				if (Number.isNaN(assessmentId)) {
					return Response.json(
						{ error: "Invalid assessment ID parameter" },
						{ status: 400 },
					);
				}

				const url = new URL(request.url);
				const processIdParam = url.searchParams.get("process_id");

				const queryResult = Result.try({
					try: () => {
						const assessment = db
							.select()
							.from(auditAssessments)
							.where(eq(auditAssessments.id, assessmentId))
							.get();

						if (!assessment) return "NOT_FOUND" as const;

						const baseQuery = db
							.select({
								assessmentId: assessmentValues.assessmentId,
								attributeId: assessmentValues.attributeId,
								processElementId: assessmentValues.processElementId,
								bpmnElementId: processElements.bpmnElementId,
								elementType: processElements.elementType,
								elementName: processElements.displayName,
								recordedValue: assessmentValues.recordedValue,
							})
							.from(assessmentValues)
							.innerJoin(
								processElements,
								eq(assessmentValues.processElementId, processElements.id),
							);

						return processIdParam
							? baseQuery
									.where(
										and(
											eq(assessmentValues.assessmentId, assessmentId),
											eq(
												processElements.processId,
												parseInt(processIdParam, 10),
											),
										),
									)
									.all()
							: baseQuery
									.where(eq(assessmentValues.assessmentId, assessmentId))
									.all();
					},
					catch: (cause) =>
						new DatabaseError({
							message: `Failed to query values for assessment ${assessmentId}`,
							cause,
						}),
				});

				return queryResult.match({
					ok: (rows) => {
						if (rows === "NOT_FOUND") {
							return Response.json(
								{ error: "Audit assessment not found" },
								{ status: 404 },
							);
						}
						return Response.json(rows);
					},
					err: (error) =>
						Response.json({ error: error.message }, { status: 500 }),
				});
			},

			PUT: async ({ params, request }) => {
				const assessmentId = parseInt(params.id, 10);
				if (Number.isNaN(assessmentId)) {
					return Response.json(
						{ error: "Invalid assessment ID parameter" },
						{ status: 400 },
					);
				}

				const parseResult = await Result.tryPromise({
					try: () => request.json(),
					catch: (cause) =>
						new ValidationError({
							message: "Invalid JSON in request body",
							issues: cause,
						}),
				});

				if (parseResult.isErr()) {
					return Response.json(
						{ error: parseResult.error.message },
						{ status: 400 },
					);
				}

				const bodyResult = putValuesSchema.safeParse(parseResult.value);
				if (!bodyResult.success) {
					return Response.json(
						{ error: z.prettifyError(bodyResult.error) },
						{ status: 400 },
					);
				}
				const body = bodyResult.data;

				const upsertResult = Result.try({
					try: () => {
						let pmId = body.processId;
						if (!pmId) {
							const latest = db
								.select()
								.from(businessProcesses)
								.orderBy(desc(businessProcesses.id))
								.limit(1)
								.get();
							pmId = latest
								? latest.id
								: db
										.insert(businessProcesses)
										.values({ processName: "default" })
										.returning()
										.get().id;
						}

						// Upsert process element (scoped to processId)
						let pe = db
							.select()
							.from(processElements)
							.where(
								and(
									eq(processElements.bpmnElementId, body.bpmnElementId),
									eq(processElements.processId, pmId),
								),
							)
							.get();

						if (!pe) {
							pe = db
								.insert(processElements)
								.values({
									processId: pmId,
									elementType: body.elementType,
									bpmnElementId: body.bpmnElementId,
									displayName: body.elementName,
								})
								.returning()
								.get();
						}

						// Upsert assessment value
						const existing = db
							.select()
							.from(assessmentValues)
							.where(
								and(
									eq(assessmentValues.assessmentId, assessmentId),
									eq(assessmentValues.attributeId, body.attributeId),
									eq(assessmentValues.processElementId, pe.id),
								),
							)
							.get();

						if (existing) {
							if (body.recordedValue === null) {
								db.delete(assessmentValues)
									.where(
										and(
											eq(assessmentValues.assessmentId, assessmentId),
											eq(assessmentValues.attributeId, body.attributeId),
											eq(assessmentValues.processElementId, pe.id),
										),
									)
									.run();
							} else {
								db.update(assessmentValues)
									.set({ recordedValue: body.recordedValue })
									.where(
										and(
											eq(assessmentValues.assessmentId, assessmentId),
											eq(assessmentValues.attributeId, body.attributeId),
											eq(assessmentValues.processElementId, pe.id),
										),
									)
									.run();
							}
						} else if (body.recordedValue !== null) {
							db.insert(assessmentValues)
								.values({
									assessmentId: assessmentId,
									attributeId: body.attributeId,
									processElementId: pe.id,
									recordedValue: body.recordedValue,
								})
								.run();
						}
					},
					catch: (cause) =>
						new DatabaseError({
							message: `Failed to persist value for assessment ${assessmentId}`,
							cause,
						}),
				});

				return upsertResult.match({
					ok: () => Response.json({ ok: true }),
					err: (error) =>
						Response.json({ error: error.message }, { status: 500 }),
				});
			},

			DELETE: async ({ params, request }) => {
				const assessmentId = parseInt(params.id, 10);
				if (Number.isNaN(assessmentId)) {
					return Response.json(
						{ error: "Invalid assessment ID parameter" },
						{ status: 400 },
					);
				}

				const url = new URL(request.url);
				const processIdParam = url.searchParams.get("process_id");

				const deleteResult = Result.try({
					try: () => {
						if (processIdParam) {
							const pmId = parseInt(processIdParam, 10);
							const elements = db
								.select({ id: processElements.id })
								.from(processElements)
								.where(eq(processElements.processId, pmId))
								.all();

							if (elements.length > 0) {
								const peIds = elements.map((e) => e.id);
								db.delete(assessmentValues)
									.where(
										and(
											eq(assessmentValues.assessmentId, assessmentId),
											inArray(assessmentValues.processElementId, peIds),
										),
									)
									.run();
							}
						} else {
							db.delete(assessmentValues)
								.where(eq(assessmentValues.assessmentId, assessmentId))
								.run();
						}
					},
					catch: (cause) =>
						new DatabaseError({
							message: `Failed to delete values for assessment ${assessmentId}`,
							cause,
						}),
				});

				return deleteResult.match({
					ok: () => Response.json({ ok: true }),
					err: (error) =>
						Response.json({ error: error.message }, { status: 500 }),
				});
			},
		},
	},
});
