import { useEffect, useRef, useState } from "react";

type Phase = "idle" | "readyTo" | "synk" | "question" | "greenDot" | "transition";

export function IntroAnimation({
  isFirstTime,
  onTransition,
  onDone,
}: {
  isFirstTime: boolean;
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
      // After React commits, measure positions for FLIP animation
      requestAnimationFrame(() => {
        const targetEl = document.querySelector(".auth-page-logo") as HTMLElement | null;
        const overlayEl = overlayLogoRef.current;
        if (!targetEl || !overlayEl) return;

        const tgt = targetEl.getBoundingClientRect();
        const ov  = overlayEl.getBoundingClientRect();

        // .login-with-logo--hidden has translateY(100vh) — compensate to get natural position
        const tgtCY = tgt.top - window.innerHeight + tgt.height / 2;
        const ovCY  = ov.top  + ov.height  / 2;
        const tgtCX = tgt.left + tgt.width  / 2;
        const ovCX  = ov.left  + ov.width   / 2;

        setLogoTransform(
          `translate(${Math.round(tgtCX - ovCX)}px, ${Math.round(tgtCY - ovCY)}px)`
        );
      });
    };

    if (isFirstTime) {
      at(() => setPhase("readyTo"),  400);
      at(() => setPhase("synk"),     1100);  // 700ms gap — dramatic pause
      at(() => setPhase("question"), 1380);
      at(() => setPhase("greenDot"), 2400);  // 1020ms gap — dot landing is noticeable
      at(startTransition, 3300);
      at(onDone, 4600);
    } else {
      at(() => setPhase("synk"),     150);
      at(() => setPhase("greenDot"), 1400);  // 1250ms gap
      at(startTransition, 2400);
      at(onDone, 3700);
    }

    return () => timers.forEach(clearTimeout);
  }, [isFirstTime, onTransition, onDone]);

  const readyToVisible  = ["readyTo", "synk", "question", "greenDot"].includes(phase);
  const readyToHiding   = phase === "transition";
  const logoVisible     = ["synk", "question", "greenDot", "transition"].includes(phase);
  const greenActive     = ["greenDot", "transition"].includes(phase);
  const questionVisible = ["question", "greenDot"].includes(phase);
  const questionHiding  = phase === "transition";
  const overlayExiting  = phase === "transition";

  return (
    <div className={`intro-overlay${overlayExiting ? " intro-overlay--exit" : ""}`}>
      <div className={`intro-stage${!isFirstTime ? " intro-stage--solo" : ""}`}>

        {isFirstTime && (
          <span className={[
            "intro-ready-to",
            readyToVisible ? "visible" : "",
            readyToHiding  ? "hiding"  : "",
          ].filter(Boolean).join(" ")}>
            Ready to
          </span>
        )}

        <div
          ref={overlayLogoRef}
          className={[
            "intro-logo-wrap",
            logoVisible  ? "visible" : "",
            !isFirstTime ? "solo"    : "",
          ].filter(Boolean).join(" ")}
          style={logoTransform ? {
            transform: logoTransform,
            transition: "transform 850ms cubic-bezier(0.22, 1, 0.36, 1)",
          } : undefined}
        >
          <div className={`intro-logo-img${greenActive ? " fading" : ""}`} />
          <div className={`intro-logo-img intro-logo-img--green${greenActive ? " visible" : ""}`} />
        </div>

        {isFirstTime && (
          <span className={[
            "intro-question",
            questionVisible ? "visible" : "",
            questionHiding  ? "hiding"  : "",
          ].filter(Boolean).join(" ")}>
            ?
          </span>
        )}

      </div>
    </div>
  );
}
