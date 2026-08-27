export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export function validateNewPassword(password) {
  const value = password || "";

  if (!value.trim()) {
    return "New password is required";
  }

  if (value.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  }

  if (value.length > PASSWORD_MAX_LENGTH) {
    return `Password must be ${PASSWORD_MAX_LENGTH} characters or less`;
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
  if (!String(confirmPassword || "").trim()) {
    return "Confirm password is required";
  }

  if (newPassword !== confirmPassword) {
    return "Passwords do not match";
  }

  return "";
}

export function validatePasswordChangeForm(data) {
  const errors = {};
  const currentPassword = String(data?.currentPassword || "");
  const newPassword = String(data?.newPassword || "");
  const confirmPassword = String(data?.confirmPassword || "");

  if (!currentPassword.trim()) {
    errors.currentPassword = "Current password is required";
  }

  const newPasswordError = validateNewPassword(newPassword);

  if (newPasswordError) {
    errors.newPassword = newPasswordError;
  }

  const confirmPasswordError = validateConfirmPassword(
    newPassword,
    confirmPassword
  );

  if (confirmPasswordError) {
    errors.confirmPassword = confirmPasswordError;
  }

  if (currentPassword && newPassword && currentPassword === newPassword) {
    errors.newPassword = "New password must be different from current password";
  }

  return errors;
}

export function validateForgotPasswordForm(data) {
  const errors = {};
  const email = (data.email || "").trim();

  if (!email) {
    errors.email = "Email is required";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    errors.email = "Enter a valid email address";
  }

  const newPasswordError = validateNewPassword(data.password);

  if (newPasswordError) {
    errors.password = newPasswordError.replace("New password", "Password");
  }

  const confirmPasswordError = validateConfirmPassword(
    data.password,
    data.confirmPassword || ""
  );

  if (confirmPasswordError) {
    errors.confirmPassword = confirmPasswordError;
  }

  return errors;
}