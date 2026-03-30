import { useCall } from "../../context/CallContext";
import { useIsMobile } from "../../hooks/useIsMobile";
import { CallView } from "./CallView";

export function CallModal() {
  const { activeCall } = useCall();
  const isMobile = useIsMobile();

  if (!activeCall || isMobile) return null;

  return <CallView layout="modal" />;
}
