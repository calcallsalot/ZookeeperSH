"use client";

export type ClaimRoleModalProps = {
  open: boolean;
  onClose?: () => void;
  onSubmit?: (roleId: string) => void;
};

export default function ClaimRoleModal({ open }: ClaimRoleModalProps) {
  if (!open) return null;
  return null;
}
