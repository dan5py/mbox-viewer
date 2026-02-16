"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useTheme } from "next-themes";

const LIGHT_PREVIEW_SRC = "/landing-preview.png";
const DARK_PREVIEW_SRC = "/landing-preview-dark.png";

export function LandingPreview() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className="w-full aspect-video bg-muted/50 animate-pulse"
        aria-hidden="true"
      />
    );
  }

  const src = resolvedTheme === "dark" ? DARK_PREVIEW_SRC : LIGHT_PREVIEW_SRC;

  return (
    <Image
      src={src}
      alt="MBOX Viewer application preview"
      width={1920}
      height={1080}
      sizes="(max-width: 1280px) 100vw, 1280px"
      className="w-full h-auto"
      priority
    />
  );
}
