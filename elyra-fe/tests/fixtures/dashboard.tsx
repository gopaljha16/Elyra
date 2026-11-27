import { createRoot } from "react-dom/client";
import { Dating } from "../../app/(onboarding)/dashboard/dating";
createRoot(document.getElementById("root")!).render(
  <Dating initialActivities={["Coffee"]} initialLocation="Town" />,
);
