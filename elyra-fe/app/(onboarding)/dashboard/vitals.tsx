"use client";

import { useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { useReportWebVitals } from "next/web-vitals";
import { endpoint } from "@/lib/onboarding";

export function DashboardVitals() {
  const { getToken } = useAuth();
  const report = useCallback<Parameters<typeof useReportWebVitals>[0]>(
    ({ id, name, value }) => {
      if (!["LCP", "INP", "CLS"].includes(name)) return;
      const navigation = performance.getEntriesByType("navigation")[0];
      if (!navigation || new URL(navigation.name).pathname !== "/dashboard") return;
      const frame = innerWidth < 640 ? "phone" : innerWidth < 1024 ? "tablet" : "desktop";
      void getToken()
        .then((token) =>
          token
            ? fetch(endpoint + "/api/dating/vitals", {
                method: "POST",
                keepalive: true,
                headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
                body: JSON.stringify({ id, name, value, frame }),
              })
            : undefined,
        )
        .catch(() => undefined);
    },
    [getToken],
  );
  useReportWebVitals(report);
  return null;
}
