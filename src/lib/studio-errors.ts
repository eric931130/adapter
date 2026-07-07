export type StudioErrorName =
  | "ValidationError"
  | "ModelCapabilityError"
  | "FileParsingError"
  | "GenerationError"
  | "ExportError"
  | "StorageError"
  | "CostLimitError";

export class StudioError extends Error {
  code: string;
  userMessage: string;
  details?: Record<string, unknown>;
  recoverable: boolean;
  suggestedAction: string;

  constructor(
    name: StudioErrorName,
    options: {
      code: string;
      message: string;
      userMessage: string;
      details?: Record<string, unknown>;
      recoverable?: boolean;
      suggestedAction: string;
    },
  ) {
    super(options.message);
    this.name = name;
    this.code = options.code;
    this.userMessage = options.userMessage;
    this.details = options.details;
    this.recoverable = options.recoverable ?? true;
    this.suggestedAction = options.suggestedAction;
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof StudioError) {
    return {
      code: error.code,
      error: error.userMessage,
      message: error.message,
      details: error.details,
      recoverable: error.recoverable,
      suggestedAction: error.suggestedAction,
    };
  }

  return {
    code: "UNKNOWN_ERROR",
    error: error instanceof Error ? error.message : "操作失敗",
    recoverable: true,
    suggestedAction: "請確認輸入資料後再試一次。",
  };
}
