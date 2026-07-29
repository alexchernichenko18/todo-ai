export const MAX_TITLE_LENGTH = 200;
export const MAX_DESCRIPTION_LENGTH = 2000;
export const MAX_CATEGORY_LENGTH = 60;
export const MIN_PROMPT_LENGTH = 10;
export const MAX_PROMPT_LENGTH = 2000;

export function normalizeTitle(value: string): string {
  return value.trim();
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateTitle(value: string): ValidationResult {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: "Title cannot be empty." };
  }
  if (trimmed.length > MAX_TITLE_LENGTH) {
    return {
      valid: false,
      error: `Title cannot exceed ${MAX_TITLE_LENGTH} characters.`,
    };
  }
  return { valid: true };
}

export function validateCategoryName(value: string): ValidationResult {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: "Subject name cannot be empty." };
  }
  if (trimmed.length > MAX_CATEGORY_LENGTH) {
    return {
      valid: false,
      error: `Subject name cannot exceed ${MAX_CATEGORY_LENGTH} characters.`,
    };
  }
  return { valid: true };
}

export function validatePromptInput(value: string): ValidationResult {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: "Describe your goal before submitting." };
  }
  if (trimmed.length < MIN_PROMPT_LENGTH) {
    return {
      valid: false,
      error: "The description is too short. Add more detail about your goal.",
    };
  }
  if (trimmed.length > MAX_PROMPT_LENGTH) {
    return {
      valid: false,
      error: `The description cannot exceed ${MAX_PROMPT_LENGTH} characters.`,
    };
  }
  return { valid: true };
}
