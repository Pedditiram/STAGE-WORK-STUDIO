import React, { useEffect, useState } from 'react';

const DEMO_KEY = 'sps_gesture_demo_seen';
const HELP_KEY = 'sps_gesture_help_open';

function isPhone() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 767px)').matches;
}

export default function MobileGestureHelp({ hidden = false, onOpenNavigator }) {
  const [demo, setDemo] = useState(() => {
    try {
      return localStorage.getItem(DEMO_KEY) !== '1';
    } catch {
      return true;
    }
  });
  const [step, setStep] = useState(0);
  const [helpOpen, setHelpOpen] = useState(() => {
    try {
      return localStorage.getItem(HELP_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(HELP_KEY, helpOpen ? '1' : '0');
    } catch (e) {}
  }, [helpOpen]);

  useEffect(() => {
    if (hidden || !demo || !isPhone()) return undefined;
    const t = setInterval(() => setStep((s) => (s === 0 ? 1 : 0)), 3200);
    return () => clearInterval(t);
  }, [hidden, demo]);

  const dismissDemo = () => {
    try {
      localStorage.setItem(DEMO_KEY, '1');
    } catch (e) {}
    setDemo(false);
    setHelpOpen(false);
  };

  if (hidden) return null;

  return (
    <>
      {demo ? (
        <div className="sps-gesture-demo" role="dialog" aria-label="Navigator gesture demo">
          <button
            type="button"
            className="sps-gesture-demo-close"
            aria-label="Close gesture demo"
            onClick={dismissDemo}
          >
            Close
          </button>
          <div className="sps-gesture-demo-stage">
            {step === 0 ? (
              <>
                <div className="sps-gesture-demo-edge" />
                <div className="sps-gesture-demo-hand sps-gesture-demo-hand--swipe" aria-hidden />
                <p className="sps-gesture-demo-caption">Swipe in from the left edge</p>
              </>
            ) : (
              <>
                <div className="sps-gesture-demo-taps" aria-hidden>
                  <span />
                  <span />
                </div>
                <p className="sps-gesture-demo-caption">Two-finger tap anywhere</p>
              </>
            )}
          </div>
          <p className="sps-gesture-demo-sub">Opens the Navigator — on a computer use Shift + Space</p>
          <div className="sps-gesture-demo-actions">
            <button
              type="button"
              className="sps-btn sps-btn-primary"
              onClick={() => {
                dismissDemo();
                onOpenNavigator?.();
              }}
            >
              Open menu
            </button>
            <button type="button" className="sps-btn" onClick={dismissDemo}>
              Close
            </button>
          </div>
        </div>
      ) : null}

      <aside className="sps-gesture-help" aria-label="Mobile navigator">
        <div className="sps-gesture-help-dock">
          <button
            type="button"
            className="sps-gesture-help-toggle"
            onClick={() => onOpenNavigator?.()}
          >
            Menu
          </button>
          <button
            type="button"
            className="sps-gesture-help-toggle"
            aria-expanded={helpOpen}
            onClick={() => setHelpOpen((v) => !v)}
          >
            Gestures
          </button>
        </div>
        {helpOpen ? (
          <div className="sps-gesture-help-card">
            <button
              type="button"
              className="sps-gesture-help-card-close"
              aria-label="Close gesture help"
              onClick={() => setHelpOpen(false)}
            >
              Close
            </button>
            <p className="sps-gesture-help-title">Open Navigator</p>
            <ul>
              <li>Tap <strong>Menu</strong></li>
              <li>Swipe in from the <strong>left edge</strong></li>
              <li><strong>Two-finger tap</strong> anywhere</li>
              <li>Header <strong>menu</strong> button</li>
              <li>On desktop: <strong>Shift + Space</strong></li>
            </ul>
          </div>
        ) : null}
      </aside>
    </>
  );
}
