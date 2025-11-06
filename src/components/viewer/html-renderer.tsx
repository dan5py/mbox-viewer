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
      if (iframeDoc?.body) {
        const newHeight = iframeDoc.body.scrollHeight;
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

    const handleLoad = () => {
      resizeIframe();

      // Observe content changes for dynamic resizing (e.g., images loading)
      const observer = new MutationObserver(resizeIframe);
      if (iframe.contentWindow?.document.body) {
        observer.observe(iframe.contentWindow.document.body, {
          childList: true,
          subtree: true,
          attributes: true,
        });
      }

      // Also handle images loading
      const images = iframe.contentWindow?.document.querySelectorAll("img");
      images?.forEach((img) => {
        img.addEventListener("load", resizeIframe);
      });

      return () => {
        observer.disconnect();
        images?.forEach((img) => {
          img.removeEventListener("load", resizeIframe);
        });
      };
    };

    iframe.addEventListener("load", handleLoad);
    window.addEventListener("resize", resizeIframe);

    return () => {
      iframe.removeEventListener("load", handleLoad);
      window.removeEventListener("resize", resizeIframe);
    };
  }, [resizeIframe]);

  // Inject styles
  const sandboxedHtml = `
    <style>
      body { 
        margin: 0; 
        overflow: hidden; 
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
