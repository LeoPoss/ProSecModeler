import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "#/db/connection";
import { businessProcesses } from "#/db/schema";

export const Route = createFileRoute("/api/business-processes/$id/")({
	server: {
		handlers: {
			GET: async ({ params }) => {
				const id = parseInt(params.id, 10);
				const row = db
					.select()
					.from(businessProcesses)
					.where(eq(businessProcesses.id, id))
					.get();
				if (!row) {
					return new Response(JSON.stringify({ error: "Not found" }), {
						status: 404,
						headers: { "Content-Type": "application/json" },
					});
				}
				return new Response(JSON.stringify(row), {
					headers: { "Content-Type": "application/json" },
				});
			},

			PUT: async ({ params, request }) => {
				const id = parseInt(params.id, 10);
				const body = (await request.json()) as {
					processName?: string;
					bpmnDefinition?: string;
				};

				const existing = db
					.select()
					.from(businessProcesses)
					.where(eq(businessProcesses.id, id))
					.get();
				if (!existing) {
					return new Response(JSON.stringify({ error: "Not found" }), {
						status: 404,
						headers: { "Content-Type": "application/json" },
					});
				}

				const updates: Record<string, unknown> = {};
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
				return new Response(JSON.stringify(updated), {
					headers: { "Content-Type": "application/json" },
				});
			},

			DELETE: async ({ params }) => {
				const id = parseInt(params.id, 10);

				const existing = db
					.select()
					.from(businessProcesses)
					.where(eq(businessProcesses.id, id))
					.get();
				if (!existing) {
					return new Response(JSON.stringify({ error: "Not found" }), {
						status: 404,
						headers: { "Content-Type": "application/json" },
					});
				}

				if (
					id === 1 ||
					existing.processName === "Sensor Data Collection Demo"
				) {
					return new Response(
						JSON.stringify({
							error: "Cannot delete the default process model",
						}),
						{
							status: 403,
							headers: { "Content-Type": "application/json" },
						},
					);
				}

				db.delete(businessProcesses).where(eq(businessProcesses.id, id)).run();

				return new Response(null, { status: 204 });
			},
		},
	},
});
