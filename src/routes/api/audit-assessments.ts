import { createFileRoute } from "@tanstack/react-router";
import { Result } from "better-result";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db/connection";
import { auditAssessments, businessProcesses } from "#/db/schema";
import { DatabaseError, ValidationError } from "#/lib/errors";

const createAuditAssessmentSchema = z.object({
	auditType: z.string().min(1),
	processId: z.number().int().optional(),
});

const updateAuditAssessmentSchema = z.object({
	id: z.number().int(),
	processId: z.number().int(),
});

export const Route = createFileRoute("/api/audit-assessments")({
	server: {
		handlers: {
			GET: async () => {
				const queryResult = Result.try({
					try: () =>
						db
							.select({
								id: auditAssessments.id,
								auditType: auditAssessments.auditType,
								processId: auditAssessments.processId,
								processName: businessProcesses.processName,
							})
							.from(auditAssessments)
							.leftJoin(
								businessProcesses,
								eq(auditAssessments.processId, businessProcesses.id),
							)
							.all(),
					catch: (cause) =>
						new DatabaseError({
							message: "Failed to query audit assessments",
							cause,
						}),
				});

				return queryResult.match({
					ok: (data) => Response.json(data),
					err: (error) =>
						Response.json({ error: error.message }, { status: 500 }),
				});
			},

			POST: async ({ request }) => {
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

				const bodyResult = createAuditAssessmentSchema.safeParse(
					parseResult.value,
				);
				if (!bodyResult.success) {
					return Response.json(
						{ error: z.prettifyError(bodyResult.error) },
						{ status: 400 },
					);
				}
				const body = bodyResult.data;

				const insertResult = Result.try({
					try: () =>
						db
							.insert(auditAssessments)
							.values({
								auditType: body.auditType,
								processId: body.processId ?? null,
							})
							.returning()
							.get(),
					catch: (cause) =>
						new DatabaseError({
							message: "Failed to create audit assessment",
							cause,
						}),
				});

				return insertResult.match({
					ok: (created) => Response.json(created, { status: 201 }),
					err: (error) =>
						Response.json({ error: error.message }, { status: 500 }),
				});
			},

			PUT: async ({ request }) => {
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

				const bodyResult = updateAuditAssessmentSchema.safeParse(
					parseResult.value,
				);
				if (!bodyResult.success) {
					return Response.json(
						{ error: z.prettifyError(bodyResult.error) },
						{ status: 400 },
					);
				}
				const body = bodyResult.data;

				const updateResult = Result.try({
					try: () =>
						db
							.update(auditAssessments)
							.set({ processId: body.processId })
							.where(eq(auditAssessments.id, body.id))
							.run(),
					catch: (cause) =>
						new DatabaseError({
							message: "Failed to update audit assessment",
							cause,
						}),
				});

				return updateResult.match({
					ok: () => Response.json({ ok: true }),
					err: (error) =>
						Response.json({ error: error.message }, { status: 500 }),
				});
			},
		},
	},
});
