"use client";

import { useEffect } from "react";

export function draftKey(userId: string) {
  return `elyra-onboarding-v1:${userId}`;
}

export function discardDraft(userId: string) {
  try {
    localStorage.removeItem(draftKey(userId));
  } catch {
    /* Storage may be restricted. */
  }
}

export function ClearDraft({ userId }: { userId: string }) {
  useEffect(() => discardDraft(userId), [userId]);
  return null;
}
