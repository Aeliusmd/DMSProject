export const PASSWORD_MIN_LENGTH = 8;

export function validateNewPassword(password) {
  const value = password || "";

  if (!value.trim()) {
    return "New password is required";
  }

  if (value.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  }

  if (!/[A-Z]/.test(value)) {
    return "Password must include at least one uppercase letter";
  }

  if (!/[a-z]/.test(value)) {
    return "Password must include at least one lowercase letter";
  }

  if (!/[0-9]/.test(value)) {
    return "Password must include at least one number";
  }

  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(value)) {
    return "Password must include at least one special character";
  }

  return "";
}

export function validateConfirmPassword(newPassword, confirmPassword) {
  if (!confirmPassword.trim()) {
    return "Confirm password is required";
  }

  if (newPassword !== confirmPassword) {
    return "Passwords do not match";
  }

  return "";
}

export function validatePasswordChangeForm(data) {
  const errors = {};

  if (!data.currentPassword.trim()) {
    errors.currentPassword = "Current password is required";
  }

  const newPasswordError = validateNewPassword(data.newPassword);

  if (newPasswordError) {
    errors.newPassword = newPasswordError;
  }

  const confirmPasswordError = validateConfirmPassword(
    data.newPassword,
    data.confirmPassword
  );

  if (confirmPasswordError) {
    errors.confirmPassword = confirmPasswordError;
  }

  if (
    data.currentPassword &&
    data.newPassword &&
    data.currentPassword === data.newPassword
  ) {
    errors.newPassword = "New password must be different from current password";
  }

  return errors;
}