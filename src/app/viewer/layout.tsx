import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Viewer | MBOX Viewer",
  description:
    "Browse, search, and export messages from your local MBOX files.",
};

export default function ViewerLayout({ children }: { children: ReactNode }) {
  return children;
}
