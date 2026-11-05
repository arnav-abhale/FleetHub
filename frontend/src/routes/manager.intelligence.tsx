import { createFileRoute } from "@tanstack/react-router";
import { DriverIntelligencePage } from "@/pages/manager/driver-intelligence-page";

export const Route = createFileRoute("/manager/intelligence")({
  head: () => ({
    meta: [
      { title: "Driver Intelligence & Safety AI — FleetHub" },
      {
        name: "description",
        content: "Predictive ML driver safety scoring, telematics analysis, and intelligent delivery assignment.",
      },
      { property: "og:title", content: "Driver Intelligence — FleetHub" },
      { property: "og:description", content: "Predictive driver intelligence and fleet risk monitoring." },
    ],
  }),
  component: DriverIntelligencePage,
});
