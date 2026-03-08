import type { Question } from './types';

/**
 * Checks whether the Continue button should be enabled for the current question.
 * Returns true if the question is optional or has a non-empty value.
 */
export function hasAnswerForQuestion(question: Question, value: any): boolean {
  const isRequired = question.validation?.required === true;

  if (!isRequired) return true;

  if (value === undefined || value === null || value === '') return false;

  if (Array.isArray(value) && value.length === 0) return false;

  return true;
}

/**
 * Validates the current answer against the question's validation rules.
 * Returns null if valid, or an error message string if invalid.
 * Called when the user clicks Continue.
 */
export function validateCurrentQuestion(question: Question, value: any): string | null {
  const rules = question.validation;
  const isRequired = rules?.required === true;

  if (isRequired) {
    if (value === undefined || value === null || value === '') {
      return rules?.customMessage ?? 'This question requires an answer.';
    }
    if (Array.isArray(value) && value.length === 0) {
      return rules?.customMessage ?? 'Please select at least one option.';
    }
  }

  // optional field with no value — nothing to validate
  if (value === undefined || value === null || value === '') return null;

  if (typeof value === 'string' && question.type !== 'date') {
    const trimmed = value.trim();
    if (rules?.minLength !== undefined && trimmed.length < rules.minLength) {
      return rules.customMessage ?? `Please enter at least ${rules.minLength} characters.`;
    }
    if (rules?.maxLength !== undefined && trimmed.length > rules.maxLength) {
      return rules.customMessage ?? `Please keep your response under ${rules.maxLength} characters.`;
    }
    if (rules?.pattern && !new RegExp(rules.pattern).test(value)) {
      return rules.customMessage ?? 'Please enter a valid value.';
    }
  }

  if (typeof value === 'number') {
    if (rules?.min !== undefined && value < rules.min) {
      return rules.customMessage ?? `Value must be at least ${rules.min}${question.unit ? ' ' + question.unit : ''}.`;
    }
    if (rules?.max !== undefined && value > rules.max) {
      return rules.customMessage ?? `Value must be at most ${rules.max}${question.unit ? ' ' + question.unit : ''}.`;
    }
  }

  // patient has to be at least 18 years old and birthdate cannot be in the future or ridiculously old
  if (question.type === 'date' && typeof value === 'string') {
    const parts = value.split('-');
    if (parts.length !== 3) return 'Please enter a valid date.';

    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const date = new Date(year, month, day);

    if (isNaN(date.getTime())) return 'Please enter a valid date.';

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (date > today) return 'Date cannot be in the future.';

    let age = today.getFullYear() - date.getFullYear();
    const monthDiff = today.getMonth() - date.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
      age--;
    }

    if (age < 18) return 'Patient must be at least 18 years old.';
    if (age > 120) return 'Please enter a valid birth date.';
  }

  return null;
}
