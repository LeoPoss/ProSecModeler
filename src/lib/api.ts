import { type Result, Result as R } from "better-result";
import { ApiError, NetworkError } from "./errors";

export interface RequestOptions extends RequestInit {
	params?: Record<string, string | number | boolean | null | undefined>;
}

function buildUrl(endpoint: string, params?: RequestOptions["params"]): string {
	if (!params) return endpoint;
	const entries = Object.entries(params).filter(
		([, val]) => val !== undefined && val !== null,
	);
	if (entries.length === 0) return endpoint;

	const searchParams = new URLSearchParams();
	for (const [key, val] of entries) {
		searchParams.append(key, String(val));
	}

	const separator = endpoint.includes("?") ? "&" : "?";
	return `${endpoint}${separator}${searchParams.toString()}`;
}

export async function fetchJson<T>(
	endpoint: string,
	options: RequestOptions = {},
): Promise<Result<T, ApiError | NetworkError>> {
	const { params, ...fetchInit } = options;
	const url = buildUrl(endpoint, params);

	const fetchResult = await R.tryPromise({
		try: () => fetch(url, fetchInit),
		catch: (cause) =>
			new NetworkError({
				message: `Network request to ${url} failed`,
				cause,
			}),
	});

	if (fetchResult.isErr()) {
		return fetchResult;
	}

	const response = fetchResult.value;

	if (!response.ok) {
		const errorText = await response.text().catch(() => "");
		let parsedDetails: unknown = undefined;
		try {
			parsedDetails = errorText ? JSON.parse(errorText) : undefined;
		} catch {
			parsedDetails = errorText;
		}

		return R.err(
			new ApiError({
				status: response.status,
				message:
					(parsedDetails as { error?: string } | undefined)?.error ||
					response.statusText ||
					`Request failed with status ${response.status}`,
				endpoint: url,
				details: parsedDetails,
			}),
		);
	}

	if (response.status === 204) {
		return R.ok(undefined as T);
	}

	return await R.tryPromise({
		try: () => response.json() as Promise<T>,
		catch: (cause) =>
			new ApiError({
				status: response.status,
				message: "Failed to parse JSON response",
				endpoint: url,
				details: cause,
			}),
	});
}

export const api = {
	get: <T>(endpoint: string, options?: RequestOptions) =>
		fetchJson<T>(endpoint, { ...options, method: "GET" }),

	post: <T, B = unknown>(endpoint: string, body?: B, options?: RequestOptions) =>
		fetchJson<T>(endpoint, {
			...options,
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...options?.headers,
			},
			body: body !== undefined ? JSON.stringify(body) : undefined,
		}),

	put: <T, B = unknown>(endpoint: string, body?: B, options?: RequestOptions) =>
		fetchJson<T>(endpoint, {
			...options,
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
				...options?.headers,
			},
			body: body !== undefined ? JSON.stringify(body) : undefined,
		}),

	delete: <T>(endpoint: string, options?: RequestOptions) =>
		fetchJson<T>(endpoint, { ...options, method: "DELETE" }),
};
