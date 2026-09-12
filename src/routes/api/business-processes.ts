import { createFileRoute } from "@tanstack/react-router";
import { Result } from "better-result";
import { desc } from "drizzle-orm";
import { db } from "#/db/connection";
import { businessProcesses } from "#/db/schema";
import { DatabaseError, ValidationError } from "#/lib/errors";

export const Route = createFileRoute("/api/business-processes")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const url = new URL(request.url);
				const latest = url.searchParams.get("latest");

				const queryResult = Result.try({
					try: () => {
						if (latest === "true") {
							return (
								db
									.select()
									.from(businessProcesses)
									.orderBy(desc(businessProcesses.id))
									.limit(1)
									.get() || null
							);
						}
						return db
							.select()
							.from(businessProcesses)
							.orderBy(desc(businessProcesses.id))
							.all();
					},
					catch: (cause) =>
						new DatabaseError({
							message: "Failed to query business processes",
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
				if (!body.processName) {
					return Response.json(
						{ error: "processName is required" },
						{ status: 400 },
					);
				}

				const insertResult = Result.try({
					try: () =>
						db
							.insert(businessProcesses)
							.values({
								processName: body.processName!,
								bpmnDefinition: body.bpmnDefinition || null,
							})
							.returning()
							.get(),
					catch: (cause) =>
						new DatabaseError({
							message: "Failed to create business process",
							cause,
						}),
				});

				return insertResult.match({
					ok: (created) => Response.json(created, { status: 201 }),
					err: (error) =>
						Response.json({ error: error.message }, { status: 500 }),
				});
			},
		},
	},
});
