"use client";

export type InvestigationResultClaim = "liberal" | "fascist";

export type ClaimInvestigationResultModalProps = {
  open: boolean;
  onClose?: () => void;
  onSubmit?: (result: InvestigationResultClaim) => void;
};

export default function ClaimInvestigationResultModal({
  open,
}: ClaimInvestigationResultModalProps) {
  if (!open) return null;
  return null;
}
