/**
 * Result of a validation check
 */
export interface ValidationResult {
    /** Whether the validation passed */
    isValid: boolean;
    /** Error message if validation failed */
    error?: string;
    /** Additional context about the validation */
    details?: Record<string, any>;
}

/**
 * Creates a successful validation result
 */
export function validationSuccess(): ValidationResult {
    return { isValid: true };
}

/**
 * Creates a failed validation result
 * @param error Error message
 * @param details Optional additional context
 */
export function validationFailure(error: string, details?: Record<string, any>): ValidationResult {
    return {
        isValid: false,
        error,
        details
    };
}
