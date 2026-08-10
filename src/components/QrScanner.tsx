"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import type { Html5QrcodeScanner } from "html5-qrcode";

const QR_READER_ELEMENT_ID = "gate-qr-reader";

/**
 * Thin wrapper around html5-qrcode's Html5QrcodeScanner, which renders
 * its own full scanner UI (camera picker, viewfinder box, torch toggle)
 * — the whole reason it was picked over a bare decoding library. The
 * import is deferred into useEffect rather than a top-level import
 * because the library touches navigator.mediaDevices at module scope,
 * which would break server rendering the same way a top-level
 * browser-only import (e.g. Mapbox) would elsewhere in this app.
 */
export function QrScanner({ onScan }: { onScan: (decodedText: string) => void }) {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  // Always calls the latest onScan without needing it in the effect's
  // dependency array (which must stay empty — the scanner is only ever
  // set up once).
  const handleScan = useEffectEvent((decodedText: string) => onScan(decodedText));

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { Html5QrcodeScanner } = await import("html5-qrcode");
      if (cancelled) return;

      const scanner = new Html5QrcodeScanner(
        QR_READER_ELEMENT_ID,
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false,
      );

      scanner.render(
        (decodedText) => handleScan(decodedText),
        () => {},
      );

      scannerRef.current = scanner;
    })();

    return () => {
      cancelled = true;
      scannerRef.current?.clear().catch(() => {});
    };
  }, []);

  return <div id={QR_READER_ELEMENT_ID} />;
}
