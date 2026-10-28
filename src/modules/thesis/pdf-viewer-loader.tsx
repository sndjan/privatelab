"use client";

import dynamic from "next/dynamic";

// pdf.js needs the browser, so the viewer is loaded on the client only.
export const PdfViewer = dynamic(() => import("./pdf-viewer"), { ssr: false });
