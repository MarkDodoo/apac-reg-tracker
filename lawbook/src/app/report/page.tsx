/**
 * /report — questionnaire-driven regulatory briefing. See ReportGenerator
 * for the stateless-by-design reasoning (PROJECT_LOG Session 19).
 */
import type { Metadata } from "next";
import { ReportGenerator } from "@/components/ReportGenerator";
import { buildMetadata } from "@/lib/seo";

export function generateMetadata(): Metadata {
  return buildMetadata({
    title: "Your Regulatory Briefing",
    description:
      "Generate a written regulatory briefing tailored to your institution type, jurisdictions, and topics of interest — created on the spot, nothing saved.",
    path: "/report",
  });
}

export const dynamic = "force-dynamic";

export default function ReportPage() {
  return <ReportGenerator />;
}
