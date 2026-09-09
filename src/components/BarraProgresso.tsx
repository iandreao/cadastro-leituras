"use client";

import NextTopLoader from "nextjs-toploader";

export default function BarraProgresso() {
  return (
    <NextTopLoader
      color="#0f766e"
      height={3}
      showSpinner={false}
      shadow="0 0 8px #0f766e"
      crawlSpeed={180}
      speed={200}
    />
  );
}
