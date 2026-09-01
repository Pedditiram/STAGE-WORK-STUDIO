import React, { Suspense, lazy, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { parseAspectNumeric } from '../constants/aspectRatios';

const SceneBuilder3D = lazy(() => import('./SceneBuilder3D'));

/**
 * 3D Stage — edge-to-edge viewport for camera crew.
 */
export default function DirectorCanvas({
  shot,
  aspectRatio = '21:9 Ultrawide',
  activeShotIndex = 0,
  projectTitle = '',
  shots = [],
  setActiveShotIndex,
  setAspectRatio,
  isFullscreen = false,
  onMinimizeHeader,
  onUpdateShot,
  autoSaveIntervalId: autoSaveIntervalIdProp,
}) {
  const aspectNumeric = useMemo(() => parseAspectNumeric(aspectRatio), [aspectRatio]);

  return (
    <div
      className="flex flex-col w-full h-full min-h-0 p-0 m-0 gap-0 bg-black border-0 rounded-none shadow-none force-dark sps-view-enter"
      data-force-dark="true"
    >
      <div className="flex-1 relative overflow-hidden min-h-0 rounded-none">
        <Suspense
          fallback={
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#0c0b0a] text-[var(--sps-gold)]">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-xs tracking-wide uppercase">Opening stage</span>
            </div>
          }
        >
          <SceneBuilder3D
            shot={shot}
            aspectRatio={aspectRatio}
            aspectNumeric={aspectNumeric}
            activeShotIndex={activeShotIndex}
            projectTitle={projectTitle}
            shots={shots}
            setActiveShotIndex={setActiveShotIndex}
            setAspectRatio={setAspectRatio}
            isFullscreen
            onMinimizeHeader={onMinimizeHeader}
            onUpdateShot={onUpdateShot}
            autoSaveIntervalId={autoSaveIntervalIdProp}
          />
        </Suspense>
      </div>
    </div>
  );
}
