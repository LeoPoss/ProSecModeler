import { createFileRoute } from "@tanstack/react-router";
import { Result } from "better-result";
import { eq } from "drizzle-orm";
import { db } from "#/db/connection";
import { businessProcesses } from "#/db/schema";
import { DatabaseError, ValidationError } from "#/lib/errors";

interface BusinessProcessUpdates {
	processName?: string;
	bpmnDefinition?: string | null;
}

export const Route = createFileRoute("/api/business-processes/$id/")({
	server: {
		handlers: {
			GET: async ({ params }) => {
				const id = parseInt(params.id, 10);
				if (Number.isNaN(id)) {
					return Response.json(
						{ error: "Invalid ID parameter" },
						{ status: 400 },
					);
				}

				const queryResult = Result.try({
					try: () =>
						db
							.select()
							.from(businessProcesses)
							.where(eq(businessProcesses.id, id))
							.get(),
					catch: (cause) =>
						new DatabaseError({
							message: `Failed to query business process ${id}`,
							cause,
						}),
				});

				return queryResult.match({
					ok: (row) => {
						if (!row) {
							return Response.json({ error: "Not found" }, { status: 404 });
						}
						return Response.json(row);
					},
					err: (error) =>
						Response.json({ error: error.message }, { status: 500 }),
				});
			},

			PUT: async ({ params, request }) => {
				const id = parseInt(params.id, 10);
				if (Number.isNaN(id)) {
					return Response.json(
						{ error: "Invalid ID parameter" },
						{ status: 400 },
					);
				}

				const parseResult = await Result.tryPromise({
					try: () =>
						request.json() as Promise<{
							processName?: string;
							bpmnDefinition?: string;
						}>,
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

				const body = parseResult.value;

				const updateResult = Result.try({
					try: () => {
						const existing = db
							.select()
							.from(businessProcesses)
							.where(eq(businessProcesses.id, id))
							.get();

						if (!existing) return null;

						const updates: BusinessProcessUpdates = {};
						if (body.processName !== undefined)
							updates.processName = body.processName;
						if (body.bpmnDefinition !== undefined)
							updates.bpmnDefinition = body.bpmnDefinition;

						let updated = existing;
						if (Object.keys(updates).length > 0) {
							updated = db
								.update(businessProcesses)
								.set(updates)
								.where(eq(businessProcesses.id, id))
								.returning()
								.get()!;
						}
						return updated;
					},
					catch: (cause) =>
						new DatabaseError({
							message: `Failed to update business process ${id}`,
							cause,
						}),
				});

				return updateResult.match({
					ok: (updated) => {
						if (!updated) {
							return Response.json({ error: "Not found" }, { status: 404 });
						}
						return Response.json(updated);
					},
					err: (error) =>
						Response.json({ error: error.message }, { status: 500 }),
				});
			},

			DELETE: async ({ params }) => {
				const id = parseInt(params.id, 10);
				if (Number.isNaN(id)) {
					return Response.json(
						{ error: "Invalid ID parameter" },
						{ status: 400 },
					);
				}

				const deleteResult = Result.try({
					try: () => {
						const existing = db
							.select()
							.from(businessProcesses)
							.where(eq(businessProcesses.id, id))
							.get();

						if (!existing) return "NOT_FOUND" as const;

						if (
							id === 1 ||
							existing.processName === "Sensor Data Collection Demo"
						) {
							return "FORBIDDEN" as const;
						}

						db.delete(businessProcesses)
							.where(eq(businessProcesses.id, id))
							.run();

						return "DELETED" as const;
					},
					catch: (cause) =>
						new DatabaseError({
							message: `Failed to delete business process ${id}`,
							cause,
						}),
				});

				return deleteResult.match({
					ok: (status) => {
						if (status === "NOT_FOUND") {
							return Response.json({ error: "Not found" }, { status: 404 });
						}
						if (status === "FORBIDDEN") {
							return Response.json(
								{ error: "Cannot delete the default process model" },
								{ status: 403 },
							);
						}
						return new Response(null, { status: 204 });
					},
					err: (error) =>
						Response.json({ error: error.message }, { status: 500 }),
				});
			},
		},
	},
});
