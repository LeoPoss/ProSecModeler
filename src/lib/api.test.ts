import { describe, expect, it, vi } from "vitest";
import { Result } from "better-result";
import { api, fetchJson } from "./api";
import { ApiError, NetworkError, ValidationError } from "./errors";

describe("better-result and custom TaggedErrors", () => {
	it("creates and discriminates Ok and Err correctly", () => {
		const success = Result.ok({ id: 123, name: "Process Model" });
		const failure = Result.err(
			new ApiError({
				status: 404,
				message: "Process not found",
				endpoint: "/api/business-processes/123",
			}),
		);

		expect(success.isOk()).toBe(true);
		expect(success.isErr()).toBe(false);
		expect(success.value).toEqual({ id: 123, name: "Process Model" });

		expect(failure.isOk()).toBe(false);
		expect(failure.isErr()).toBe(true);
		expect(failure.error._tag).toBe("ApiError");
		expect(ApiError.is(failure.error)).toBe(true);
		expect(failure.error.status).toBe(404);
	});

	it("supports Result.match pattern matching", () => {
		const result = Result.ok(42);
		const mapped = result.match({
			ok: (val) => `Success: ${val}`,
			err: (err) => `Failed: ${err}`,
		});
		expect(mapped).toBe("Success: 42");

		const errResult = Result.err(new ValidationError({ message: "Invalid ID" }));
		const errMapped = errResult.match({
			ok: (val) => `Success: ${val}`,
			err: (e) => `Error [${e._tag}]: ${e.message}`,
		});
		expect(errMapped).toBe("Error [ValidationError]: Invalid ID");
	});

	it("composes with Result.gen generator syntax", () => {
		function getA() {
			return Result.ok(10);
		}
		function getB(a: number) {
			return Result.ok(a * 2);
		}
		function getC(b: number) {
			return Result.ok(b + 5);
		}

		const chained = Result.gen(function* () {
			const a = yield* getA();
			const b = yield* getB(a);
			const c = yield* getC(b);
			return Result.ok(c);
		});

		expect(chained.isOk()).toBe(true);
		expect(chained.unwrap()).toBe(25);
	});

	it("early-returns on error in Result.gen", () => {
		function step1() {
			return Result.ok("ok-1");
		}
		function step2(): Result<string, ValidationError> {
			return Result.err(new ValidationError({ message: "Validation error" }));
		}
		function step3() {
			return Result.ok("ok-3");
		}

		const chained = Result.gen(function* () {
			const a = yield* step1();
			const b = yield* step2();
			const c = yield* step3();
			return Result.ok({ a, b, c });
		});

		expect(chained.isErr()).toBe(true);
		if (chained.isErr()) {
			expect(chained.error._tag).toBe("ValidationError");
			expect(ValidationError.is(chained.error)).toBe(true);
			expect(chained.error.message).toBe("Validation error");
		}
	});

	it("handles safe tryPromise in api.get / fetchJson", async () => {
		const mockData = { id: 1, processName: "Test Process" };
		const originalFetch = globalThis.fetch;

		globalThis.fetch = vi.fn().mockResolvedValue(
			new Response(JSON.stringify(mockData), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		try {
			const res = await api.get<{ id: number; processName: string }>(
				"/api/business-processes/1",
			);
			expect(res.isOk()).toBe(true);
			if (res.isOk()) {
				expect(res.value).toEqual(mockData);
			}
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	it("converts HTTP 404 into ApiError in fetchJson", async () => {
		const originalFetch = globalThis.fetch;

		globalThis.fetch = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ error: "Item not found" }), {
				status: 404,
				statusText: "Not Found",
				headers: { "Content-Type": "application/json" },
			}),
		);

		try {
			const res = await fetchJson<{ id: number }>("/api/business-processes/999");
			expect(res.isErr()).toBe(true);
			if (res.isErr()) {
				expect(res.error._tag).toBe("ApiError");
				expect(ApiError.is(res.error)).toBe(true);
				if (ApiError.is(res.error)) {
					expect(res.error.status).toBe(404);
				}
				expect(res.error.message).toBe("Item not found");
			}
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	it("converts network throw into NetworkError in fetchJson", async () => {
		const originalFetch = globalThis.fetch;

		globalThis.fetch = vi.fn().mockRejectedValue(new Error("Failed to fetch"));

		try {
			const res = await fetchJson("/api/network-fail");
			expect(res.isErr()).toBe(true);
			if (res.isErr()) {
				expect(res.error._tag).toBe("NetworkError");
				expect(NetworkError.is(res.error)).toBe(true);
				expect(res.error.message).toContain("Network request to /api/network-fail failed");
			}
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});
