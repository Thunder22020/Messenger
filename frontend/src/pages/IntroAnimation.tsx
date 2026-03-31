import { useEffect, useRef, useState } from "react";

type Phase = "idle" | "synk" | "greenDot" | "transition";

export function IntroAnimation({
  onTransition,
  onDone,
}: {
  onTransition: () => void;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [logoTransform, setLogoTransform] = useState<string>("");
  const overlayLogoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (fn: () => void, ms: number) => timers.push(setTimeout(fn, ms));

    const startTransition = () => {
      setPhase("transition");
      onTransition();
      requestAnimationFrame(() => {
        const targetEl = document.querySelector(".auth-page-logo") as HTMLElement | null;
        const overlayEl = overlayLogoRef.current;
        if (!targetEl || !overlayEl) return;

        const tgt = targetEl.getBoundingClientRect();
        const ov  = overlayEl.getBoundingClientRect();

        const tgtCY = tgt.top - window.innerHeight + tgt.height / 2;
        const ovCY  = ov.top  + ov.height  / 2;
        const tgtCX = tgt.left + tgt.width  / 2;
        const ovCX  = ov.left  + ov.width   / 2;

        setLogoTransform(
          `translate(${Math.round(tgtCX - ovCX)}px, ${Math.round(tgtCY - ovCY)}px)`
        );
      });
    };

    at(() => setPhase("synk"),     150);
    at(() => setPhase("greenDot"), 1400);
    at(startTransition,            2400);
    at(onDone,                     3700);

    return () => timers.forEach(clearTimeout);
  }, [onTransition, onDone]);

  const logoVisible  = ["synk", "greenDot", "transition"].includes(phase);
  const greenActive  = ["greenDot", "transition"].includes(phase);
  const overlayExiting = phase === "transition";

  return (
    <div className={`intro-overlay${overlayExiting ? " intro-overlay--exit" : ""}`}>
      <div className="intro-stage intro-stage--solo">
        <div
          ref={overlayLogoRef}
          className={`intro-logo-wrap solo${logoVisible ? " visible" : ""}`}
          style={logoTransform ? {
            transform: logoTransform,
            transition: "transform 850ms cubic-bezier(0.22, 1, 0.36, 1)",
          } : undefined}
        >
          <div className={`intro-logo-img${greenActive ? " fading" : ""}`} />
          <div className={`intro-logo-img intro-logo-img--green${greenActive ? " visible" : ""}`} />
        </div>
      </div>
    </div>
  );
}
