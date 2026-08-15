import { TaggedError } from "better-result";

export class ApiError extends TaggedError("ApiError")<{
	status: number;
	message: string;
	endpoint: string;
	details?: unknown;
}> { }

export class NetworkError extends TaggedError("NetworkError")<{
	message: string;
	cause?: unknown;
}> { }

export class DatabaseError extends TaggedError("DatabaseError")<{
	message: string;
	cause?: unknown;
}> { }

export class BpmnError extends TaggedError("BpmnError")<{
	operation: "import" | "export" | "render" | "annotation" | "modeling";
	message: string;
	cause?: unknown;
}> { }

export class ValidationError extends TaggedError("ValidationError")<{
	message: string;
	field?: string;
	issues?: unknown;
}> { }
