import { useEffect, useRef } from 'react';
import { transportClock, type ClockState } from '../audio/transportClock';

// Subscribe to the shared transport clock without causing React re-renders.
// The callback fires every animation frame while playing; use it to imperatively
// write DOM (e.g. the playhead transform) so we never churn React state at 60fps.

export function useTransportPosition(onTick: (s: ClockState) => void): void {
  const ref = useRef(onTick);
  ref.current = onTick;
  useEffect(() => transportClock.subscribe((s) => ref.current(s)), []);
}
