"use client";

export type ClaimCardsModalMode = "president" | "chancellor";

export type ClaimCardsModalProps = {
  open: boolean;
  mode: ClaimCardsModalMode;
  onClose?: () => void;
  onSubmit?: (cards: string) => void;
};

export default function ClaimCardsModal({ open }: ClaimCardsModalProps) {
  if (!open) return null;
  return null;
}
