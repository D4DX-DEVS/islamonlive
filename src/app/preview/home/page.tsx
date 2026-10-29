import type { Metadata } from "next";
import { notFound } from "next/navigation";
import HomeSections from "@/components/home/HomeSections";
import { getAdminActor } from "@/lib/auth/actor";
import { getPreviewLayout } from "@/lib/home-layout/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Homepage preview",
  robots: { index: false, follow: false },
};

/* The homepage builder's canvas: the real homepage, inside the real site chrome,
   rendered from the unpublished draft (?source=live for what readers see now).
   Administrators only; anyone else gets the 404. No page-view beacon, so
   previews never count as readers.

   Each section is marked with data-section-id (HomeSections preview mode); the
   builder outlines and selects by it, and these styles draw the outlines and
   the placeholder for a section that has nothing to show. */
const BUILDER_CSS = `
[data-section-id]{position:relative;scroll-margin-top:132px;border-radius:14px;transition:outline-color .15s}
[data-builder] [data-section-id]{cursor:pointer}
[data-builder] [data-section-id]:hover{outline:2px dashed rgba(124,58,237,.55);outline-offset:6px}
[data-section-id][data-selected]{outline:2px solid #7c3aed!important;outline-offset:6px}
[data-builder] [data-section-id]:hover::before,[data-section-id][data-selected]::before{content:attr(data-section-label);position:absolute;top:-34px;left:-6px;z-index:70;background:#7c3aed;color:#fff;font:600 12px/1 system-ui,sans-serif;padding:7px 9px;border-radius:7px;pointer-events:none;white-space:nowrap;box-shadow:0 6px 16px -6px rgba(76,29,149,.6)}
[data-section-id]:empty{min-height:88px;border:2px dashed #cbd5e1;background:#f8fafc}
[data-section-id]:empty::after{content:"\\201C" attr(data-section-label) "\\201D  has nothing to show \\2014  check its source";position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:0 16px;text-align:center;color:#64748b;font:500 13px system-ui,sans-serif}
`;

export default async function HomePreview({ searchParams }: { searchParams: Promise<{ source?: string }> }) {
  const actor = await getAdminActor().catch(() => null);
  if (actor?.role !== "administrator") notFound();
  const { source } = await searchParams;
  const sections = await getPreviewLayout(source === "live" ? "live" : "draft");
  // the builder sets data-builder here from outside React, often before hydration
  return (
    <div className="space-y-8 sm:space-y-12" data-preview-root suppressHydrationWarning>
      <style dangerouslySetInnerHTML={{ __html: BUILDER_CSS }} />
      <h1 className="sr-only">Homepage preview</h1>
      <HomeSections sections={sections} preview />
    </div>
  );
}
