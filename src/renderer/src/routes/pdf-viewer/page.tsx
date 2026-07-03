import { lazy, Suspense } from "react";
import { useQueryState } from "nuqs";

const PDFViewerApp = lazy(() => import("./pdf-viewer/lazy"));

function Page() {
  const [url] = useQueryState("url");
  const [cacheURL] = useQueryState("cacheURL");
  if (!url) {
    return null;
  }

  return (
    <>
      <title>{url}</title>
      <Suspense fallback={<div className="absolute inset-0 bg-slate-200/70 dark:bg-slate-800" />}>
        <PDFViewerApp pdfFilePath={cacheURL ?? url} />
      </Suspense>
    </>
  );
}

export default Page;
