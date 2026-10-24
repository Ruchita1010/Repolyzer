"use client";
// components/MermaidBlock.tsx
import { useEffect, useRef, useState } from "react";

export default function MermaidBlock({ code }: { code: string }) {
  const [svg, setSvg] = useState("");
  const [failed, setFailed] = useState(false);
  const id = useRef("m" + Math.random().toString(36).slice(2));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({ startOnLoad: false, theme: "neutral", securityLevel: "strict" });
        const { svg } = await mermaid.render(id.current, code.trim());
        if (!cancelled) setSvg(svg);
      } catch {
        document.getElementById("d" + id.current)?.remove(); // mermaid leaves an error node behind
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (failed) {
    return (
      <figure className="my-6">
        <pre className="overflow-x-auto rounded-lg bg-stone-100 p-4 text-xs text-stone-700">{code}</pre>
        <figcaption className="mt-2 text-xs text-stone-500">
          Diagram could not be rendered, showing its source instead.
        </figcaption>
      </figure>
    );
  }
  if (!svg) {
    return <div className="my-6 h-40 animate-pulse rounded-lg bg-stone-100" aria-label="Rendering diagram" />;
  }
  return (
    <figure className="my-6 overflow-x-auto rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex justify-center [&_svg]:h-auto [&_svg]:max-w-full" dangerouslySetInnerHTML={{ __html: svg }} />
      <figcaption className="mt-2 text-center text-xs text-stone-500">Architecture diagram</figcaption>
    </figure>
  );
}
