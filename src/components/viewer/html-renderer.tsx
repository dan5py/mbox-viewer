"use client";

import { FC, useCallback, useLayoutEffect, useMemo, useRef } from "react";

import { EmailAttachment } from "~/types/files";

interface HtmlRendererProps {
  html: string;
  className?: string;
  attachments?: EmailAttachment[];
}

const HtmlRenderer: FC<HtmlRendererProps> = ({
  html,
  className,
  attachments,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const resizeFrameIdRef = useRef<number | null>(null);

  const processedHtml = useMemo(() => {
    if (!attachments || attachments.length === 0) {
      return html;
    }

    // Create a map of Content-ID to attachment data for quick lookups
    const cidMap = new Map<string, EmailAttachment>();
    for (const att of attachments) {
      if (att.contentId) {
        cidMap.set(att.contentId, att);
      }
    }

    if (cidMap.size === 0) {
      return html;
    }

    // Replace cid: links with base64 data URLs
    return html.replace(/src="cid:([^"]+)"/g, (match, cid) => {
      const attachment = cidMap.get(cid);
      if (attachment) {
        return `src="data:${attachment.mimeType};base64,${attachment.data}"`;
      }
      return match; // Keep original src if no matching attachment found
    });
  }, [html, attachments]);

  const measureIframeHeight = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const iframeDoc = iframe.contentWindow?.document;
    if (!iframeDoc?.body || !iframeDoc?.documentElement) return;

    const body = iframeDoc.body;
    const documentElement = iframeDoc.documentElement;

    iframe.style.height = "auto";
    const newHeight = Math.max(
      body.scrollHeight,
      body.offsetHeight,
      body.clientHeight,
      documentElement.scrollHeight,
      documentElement.offsetHeight,
      documentElement.clientHeight
    );

    if (newHeight > 0) {
      iframe.style.height = `${newHeight}px`;
    }
  }, []);

  const scheduleResize = useCallback(() => {
    if (typeof window === "undefined") return;
    if (resizeFrameIdRef.current !== null) {
      window.cancelAnimationFrame(resizeFrameIdRef.current);
    }

    resizeFrameIdRef.current = window.requestAnimationFrame(() => {
      resizeFrameIdRef.current = null;
      measureIframeHeight();
    });
  }, [measureIframeHeight]);

  useLayoutEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    let resizeObserver: ResizeObserver | null = null;
    let mutationObserver: MutationObserver | null = null;
    let parentResizeObserver: ResizeObserver | null = null;
    let removeImageListeners: Array<() => void> = [];
    let followUpFrameId: number | null = null;
    let followUpTimeouts: number[] = [];

    const clearImageListeners = () => {
      removeImageListeners.forEach((removeListener) => removeListener());
      removeImageListeners = [];
    };

    const clearFollowUpResizes = () => {
      if (followUpFrameId !== null) {
        window.cancelAnimationFrame(followUpFrameId);
        followUpFrameId = null;
      }
      followUpTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
      followUpTimeouts = [];
    };

    const addImageListeners = (iframeDoc: Document) => {
      const images = iframeDoc.querySelectorAll("img");
      images.forEach((img) => {
        img.addEventListener("load", scheduleResize, { once: true });
        img.addEventListener("error", scheduleResize, { once: true });
        removeImageListeners.push(() => {
          img.removeEventListener("load", scheduleResize);
          img.removeEventListener("error", scheduleResize);
        });
      });
    };

    const runLoadResizePasses = () => {
      clearFollowUpResizes();
      scheduleResize();
      followUpFrameId = window.requestAnimationFrame(() => {
        scheduleResize();
      });
      followUpTimeouts = [
        window.setTimeout(scheduleResize, 120),
        window.setTimeout(scheduleResize, 420),
      ];
    };

    const handleLoad = () => {
      runLoadResizePasses();
      const iframeDoc = iframe.contentWindow?.document;
      if (!iframeDoc?.body || !iframeDoc?.documentElement) {
        return;
      }

      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (mutationObserver) {
        mutationObserver.disconnect();
      }
      clearImageListeners();

      // Observe content changes for dynamic resizing (e.g., images loading)
      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(() => scheduleResize());
        resizeObserver.observe(iframeDoc.body);
        resizeObserver.observe(iframeDoc.documentElement);
      } else {
        mutationObserver = new MutationObserver(scheduleResize);
        mutationObserver.observe(iframeDoc.body, {
          childList: true,
          subtree: true,
          attributes: true,
        });
      }

      // Also handle images loading
      addImageListeners(iframeDoc);
    };

    iframe.addEventListener("load", handleLoad);
    window.addEventListener("resize", scheduleResize);
    if (typeof ResizeObserver !== "undefined" && iframe.parentElement) {
      parentResizeObserver = new ResizeObserver(() => scheduleResize());
      parentResizeObserver.observe(iframe.parentElement);
    }
    if (iframe.contentWindow?.document.readyState === "complete") {
      handleLoad();
    } else {
      scheduleResize();
    }

    return () => {
      iframe.removeEventListener("load", handleLoad);
      window.removeEventListener("resize", scheduleResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (mutationObserver) {
        mutationObserver.disconnect();
      }
      if (parentResizeObserver) {
        parentResizeObserver.disconnect();
      }
      clearImageListeners();
      clearFollowUpResizes();
      if (resizeFrameIdRef.current !== null) {
        window.cancelAnimationFrame(resizeFrameIdRef.current);
        resizeFrameIdRef.current = null;
      }
    };
  }, [scheduleResize]);

  // Inject styles
  const sandboxedHtml = `
    <style>
      body { 
        margin: 0; 
        overflow-x: hidden;
        overflow-y: visible;
        word-break: break-word;
        overflow-wrap: anywhere;
      }
    </style>
    <base target="_blank">
    ${processedHtml}
  `;

  return (
    <iframe
      ref={iframeRef}
      title="Email HTML content"
      srcDoc={sandboxedHtml}
      className={className}
      sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
      style={{ width: "100%", border: "none", display: "block" }}
    />
  );
};

export default HtmlRenderer;
