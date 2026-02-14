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

  const resizeIframe = useCallback(() => {
    if (iframeRef.current) {
      const iframeDoc = iframeRef.current.contentWindow?.document;
      if (iframeDoc?.body && iframeDoc?.documentElement) {
        const body = iframeDoc.body;
        const documentElement = iframeDoc.documentElement;
        const newHeight = Math.max(
          body.scrollHeight,
          body.offsetHeight,
          body.clientHeight,
          documentElement.scrollHeight,
          documentElement.offsetHeight,
          documentElement.clientHeight
        );
        if (
          newHeight > 0 &&
          iframeRef.current.style.height !== `${newHeight}px`
        ) {
          iframeRef.current.style.height = `${newHeight}px`;
        }
      }
    }
  }, []);

  useLayoutEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    let resizeObserver: ResizeObserver | null = null;
    let mutationObserver: MutationObserver | null = null;
    let removeImageListeners: Array<() => void> = [];

    const handleLoad = () => {
      resizeIframe();
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
      removeImageListeners.forEach((removeListener) => removeListener());
      removeImageListeners = [];

      // Observe content changes for dynamic resizing (e.g., images loading)
      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(() => resizeIframe());
        resizeObserver.observe(iframeDoc.body);
        resizeObserver.observe(iframeDoc.documentElement);
      } else {
        mutationObserver = new MutationObserver(resizeIframe);
        mutationObserver.observe(iframeDoc.body, {
          childList: true,
          subtree: true,
          attributes: true,
        });
      }

      // Also handle images loading
      const images = iframeDoc.querySelectorAll("img");
      images.forEach((img) => {
        img.addEventListener("load", resizeIframe, { once: true });
        img.addEventListener("error", resizeIframe, { once: true });
        removeImageListeners.push(() => {
          img.removeEventListener("load", resizeIframe);
          img.removeEventListener("error", resizeIframe);
        });
      });
    };

    iframe.addEventListener("load", handleLoad);
    window.addEventListener("resize", resizeIframe);
    if (iframe.contentWindow?.document.readyState === "complete") {
      handleLoad();
    }

    return () => {
      iframe.removeEventListener("load", handleLoad);
      window.removeEventListener("resize", resizeIframe);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (mutationObserver) {
        mutationObserver.disconnect();
      }
      removeImageListeners.forEach((removeListener) => removeListener());
    };
  }, [resizeIframe]);

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
      srcDoc={sandboxedHtml}
      className={className}
      sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
      style={{ width: "100%", border: "none", display: "block" }}
      onLoad={resizeIframe} // Initial resize on load
    />
  );
};

export default HtmlRenderer;
