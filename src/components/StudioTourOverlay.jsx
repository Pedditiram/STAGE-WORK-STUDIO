import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, MousePointer2, Pause, Play, X } from 'lucide-react';
import StageWorksMark from './StageWorksMark';
import {
  IconScript,
  IconMatrix,
  IconForm,
  IconStage,
  IconCast,
  IconWorld,
  IconPromo,
  IconCampaign,
  IconStoryboard,
  IconClapper as IconPitch,
  IconBudget,
  IconReel,
  IconCompile,
  IconSpark as IconGenerate,
  IconGear as IconSettings,
} from './StudioIcons';
import { PRODUCT } from '../constants/brand';

const STEP_MS = 5500;

const ROOMS = [
  { id: 'writer', label: 'Writer', Icon: IconScript },
  { id: 'matrix', label: 'Matrix', Icon: IconMatrix },
  { id: 'form', label: 'Form', Icon: IconForm },
  { id: 'stage', label: '3D Stage', Icon: IconStage },
  { id: 'cast', label: 'Cast', Icon: IconCast },
  { id: 'world', label: 'World', Icon: IconWorld },
  { id: 'promo', label: 'Promo', Icon: IconPromo },
  { id: 'campaign', label: 'Campaign', Icon: IconCampaign },
  { id: 'storyboard', label: 'Boards', Icon: IconStoryboard },
  { id: 'pitch', label: 'Pitch', Icon: IconPitch },
  { id: 'budget', label: 'Budget', Icon: IconBudget },
  { id: 'reel', label: 'Reel', Icon: IconReel },
  { id: 'compile', label: 'Compile', Icon: IconCompile },
  { id: 'generate', label: 'Generate', Icon: IconGenerate },
  { id: 'settings', label: 'Settings', Icon: IconSettings },
];

const STEPS = [
  { room: 'writer', target: 'tab-writer', kicker: 'Writer', title: 'Open Writer Console', body: 'Start on the page. The rest of the studio follows this story.' },
  { room: 'writer', target: 'writer-pages', kicker: 'Pages', title: 'Screenplay', body: 'Type or paste the script. Shots can be broken out from these pages.' },
  { room: 'writer', target: 'writer-synopsis', kicker: 'Synopsis', title: 'Master synopsis', body: 'The logline and bible live here — next to the pages, not in a side doc.' },
  { room: 'writer', target: 'writer-lock', kicker: 'Lock', title: 'Lock the page', body: 'Lock before the take so the matrix does not drift from the story.' },

  { room: 'matrix', target: 'tab-matrix', kicker: 'Matrix', title: 'Open Cinema Matrix', body: 'The grid is the call sheet: one row per take, crafts across the columns.' },
  { room: 'matrix', target: 'matrix-shot', kicker: 'Shot', title: 'Pick a take', body: 'Click a shot row to work that take. Mute or clone from here.' },
  { room: 'matrix', target: 'matrix-craft', kicker: 'Craft', title: 'Fill a craft cell', body: 'Lens, light, performance — each cell is a craft on that shot.' },
  { room: 'matrix', target: 'matrix-compile', kicker: 'Compile', title: 'Send the row to Compile', body: 'When the row is honest, compile Frame 0 and Frame 120 from it.' },

  { room: 'form', target: 'tab-form', kicker: 'Form', title: 'Open Form desk', body: 'Same shot as the matrix, one craft at a time, in depth.' },
  { room: 'form', target: 'form-strip', kicker: 'Strip', title: 'Shot strip', body: 'Jump takes without leaving the desk. The active shot stays highlighted.' },
  { room: 'form', target: 'form-lens', kicker: 'Lens', title: 'Camera & lens', body: 'Focal length, height, move. This writes the same cell as the matrix.' },
  { room: 'form', target: 'form-wardrobe', kicker: 'Wardrobe', title: 'Performance & wardrobe', body: 'Look, gait, costume. Enhance with LLM when the line needs lift.' },

  { room: 'stage', target: 'tab-stage', kicker: 'Stage', title: 'Open 3D Stage', body: 'Director canvas. Block the take in space before you generate.' },
  { room: 'stage', target: 'stage-block', kicker: 'Block', title: 'Place the talent', body: 'Put bodies on the floor plan. This is pre-viz without a second stack.' },
  { room: 'stage', target: 'stage-cam', kicker: 'Camera', title: 'Set the camera', body: 'Height, lens, and move live on the stage — same values as Form.' },

  { room: 'cast', target: 'tab-cast', kicker: 'Cast', title: 'Open Characters', body: 'The bible holds face, voice, and costume so every take matches.' },
  { room: 'cast', target: 'cast-look', kicker: 'Look', title: 'Look & gait', body: 'Lock the face, walk, and voice once. Shots inherit this, they do not reinvent it.' },
  { room: 'cast', target: 'cast-wardrobe', kicker: 'Costume', title: 'Wardrobe elements', body: 'Outfit, accessories, palette. Extract from script or write by hand.' },

  { room: 'world', target: 'tab-world', kicker: 'World', title: 'Open World console', body: 'Locations, plates, and environment continuity for every scene.' },
  { room: 'world', target: 'world-place', kicker: 'Place', title: 'Location bible', body: 'Name the courtyard, the light, the geography. Shots pull from here.' },
  { room: 'world', target: 'world-plate', kicker: 'Plate', title: 'Environment plates', body: 'Still plates lock the world so Generate does not invent a new city.' },

  { room: 'promo', target: 'tab-promo', kicker: 'Promo', title: 'Open Promo Pack', body: 'Trailer, teaser, and social cuts from the same slate.' },
  { room: 'promo', target: 'promo-trailer', kicker: 'Trailer', title: 'Trailer cut', body: 'Pull hero takes into a trailer spine without leaving the OS.' },
  { room: 'promo', target: 'promo-social', kicker: 'Social', title: 'Reels & teaser', body: 'Vertical and teaser lengths from the same locked look.' },

  { room: 'campaign', target: 'tab-campaign', kicker: 'Campaign', title: 'Open Campaign Kit', body: 'Posters, hoardings, and research — not a trailer cut.' },
  { room: 'campaign', target: 'campaign-kit', kicker: 'Kit', title: 'Key-art units', body: 'One-sheet, social, outdoor. Prompts from the locked slate.' },
  { room: 'campaign', target: 'campaign-research', kicker: 'Research', title: 'Research desk', body: 'Audience, comps, markets, calendar. Stay on the OS.' },

  { room: 'storyboard', target: 'tab-storyboard', kicker: 'Boards', title: 'Open Storyboard', body: 'One panel per shot. Still prompt sits under the frame.' },
  { room: 'storyboard', target: 'board-frame', kicker: 'Frame', title: 'The panel', body: 'Generated still if you have one. Empty frame until Generate.' },
  { room: 'storyboard', target: 'board-prompt', kicker: 'Prompt', title: 'Prompt under the frame', body: 'Clear still prompt. Copy it. Not a video dump unless you ask.' },

  { room: 'pitch', target: 'tab-pitch', kicker: 'Pitch', title: 'Open Pitch Deck', body: 'The boardroom book: story, look, and ask in one deck.' },
  { room: 'pitch', target: 'pitch-slides', kicker: 'Slides', title: 'Investor slides', body: 'Logline, craft, and comps. Built from the project, not a side deck.' },
  { room: 'pitch', target: 'pitch-export', kicker: 'Export', title: 'Share the book', body: 'Export when the look is locked. This is the raise, not a mood board.' },

  { room: 'budget', target: 'tab-budget', kicker: 'Budget', title: 'Open Budget', body: 'Picture estimate for producers and investors. Granted per user.' },
  { room: 'budget', target: 'budget-line', kicker: 'Lines', title: 'Cost lines', body: 'Craft, generate, and post sit on the same estimate as the slate.' },
  { room: 'budget', target: 'budget-grant', kicker: 'Grant', title: 'Who can see it', body: 'Owner always. Others only if Budget is switched on for them.' },

  { room: 'reel', target: 'tab-reel', kicker: 'Reel', title: 'Open Feature Reel', body: 'Play the takes in order. This is the cut before the cut.' },
  { room: 'reel', target: 'reel-takes', kicker: 'Takes', title: 'Take list', body: 'Every generated still and clip on the shot, in slate order.' },
  { room: 'reel', target: 'reel-play', kicker: 'Play', title: 'Play the reel', body: 'Watch continuity. If a take breaks the look, go back to Generate.' },

  { room: 'compile', target: 'tab-compile', kicker: 'Compile', title: 'Open Prompt Compiler', body: 'Turn the slate into keyframe prompts the generate desk can run.' },
  { room: 'compile', target: 'compile-f0', kicker: 'Frame 0', title: 'First keyframe', body: 'Frame 0 is the open of the take — composition locked.' },
  { room: 'compile', target: 'compile-f120', kicker: 'Frame 120', title: 'End keyframe', body: 'Frame 120 is where the take lands. Continuity holds between them.' },

  { room: 'generate', target: 'tab-generate', kicker: 'Generate', title: 'Open Generate desk', body: 'Stills and motion from the compiled take — not from a blank chat.' },
  { room: 'generate', target: 'generate-still', kicker: 'Still', title: 'Look lock', body: 'The still is the continuity plate. Keep it before you run video.' },
  { room: 'generate', target: 'generate-run', kicker: 'Run', title: 'Generate the take', body: 'Run image or video. Save the take back onto the shot.' },

  { room: 'settings', target: 'tab-settings', kicker: 'Settings', title: 'Open Settings', body: 'Owner controls who sees which room, and who gets a project.' },
  { room: 'settings', target: 'settings-consoles', kicker: 'Access', title: 'Per-user consoles', body: 'Switch Writer, Matrix, Generate… on or off for each collaborator.' },
  { room: 'settings', target: 'settings-otp', kicker: 'Invite', title: 'Welcome + OTP', body: 'One mail with a welcome and a 6-digit OTP. That is how they log in.' },
];

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function firstStepForRoom(roomId) {
  return STEPS.findIndex((s) => s.room === roomId);
}

function WriterMock({ on }) {
  return (
    <div className="sps-mock">
      <div className={`sps-mock-panel${on === 'writer-pages' ? ' is-hot' : ''}`} data-tour-id="writer-pages">
        <p className="sps-mock-label">Screenplay</p>
        <p className="sps-mock-line">INT. TEMPLE COURTYARD — DUSK</p>
        <p className="sps-mock-line dim">RAMA holds the bow. The court holds its breath.</p>
        <p className="sps-mock-line dim">RAMA: We only get one chance at this.</p>
      </div>
      <div className={`sps-mock-panel${on === 'writer-synopsis' ? ' is-hot' : ''}`} data-tour-id="writer-synopsis">
        <p className="sps-mock-label">Synopsis</p>
        <p className="sps-mock-line">A prince, a vow, a bow that will not bend for anyone else.</p>
      </div>
      <button type="button" className={`sps-mock-btn${on === 'writer-lock' ? ' is-hot' : ''}`} data-tour-id="writer-lock">
        Lock page
      </button>
    </div>
  );
}

function MatrixMock({ on }) {
  return (
    <div className="sps-mock sps-mock-grid">
      <div className="sps-mock-table">
        <div className="sps-mock-tr head">
          <span>Shot</span><span>Lens</span><span>Light</span><span>Action</span>
        </div>
        <div className={`sps-mock-tr${on === 'matrix-shot' ? ' is-hot' : ''}`} data-tour-id="matrix-shot">
          <span>1A</span><span>40mm</span><span>Golden</span><span>Draws bow</span>
        </div>
        <div className="sps-mock-tr">
          <span>1B</span><span>85mm</span><span>Rim</span><span>Eyes to Sita</span>
        </div>
        <div className={`sps-mock-cell${on === 'matrix-craft' ? ' is-hot' : ''}`} data-tour-id="matrix-craft">
          Craft cell · Lighting: warm courtyard bounce, hard rim on metal
        </div>
      </div>
      <button type="button" className={`sps-mock-btn${on === 'matrix-compile' ? ' is-hot' : ''}`} data-tour-id="matrix-compile">
        Compile this shot
      </button>
    </div>
  );
}

function FormMock({ on }) {
  return (
    <div className="sps-mock">
      <div className={`sps-mock-strip${on === 'form-strip' ? ' is-hot' : ''}`} data-tour-id="form-strip">
        <span className="is-on">1A</span><span>1B</span><span>2A</span><span>2B</span>
      </div>
      <div className={`sps-mock-field${on === 'form-lens' ? ' is-hot' : ''}`} data-tour-id="form-lens">
        <p className="sps-mock-label">Camera / lens</p>
        <p className="sps-mock-line">40mm · chest height · slow push</p>
      </div>
      <div className={`sps-mock-field${on === 'form-wardrobe' ? ' is-hot' : ''}`} data-tour-id="form-wardrobe">
        <p className="sps-mock-label">Wardrobe · Enhance</p>
        <p className="sps-mock-line">Saffron dhoti, gold vambrace, dust on hem</p>
      </div>
    </div>
  );
}

function CastMock({ on }) {
  return (
    <div className="sps-mock sps-mock-split">
      <div className={`sps-mock-panel${on === 'cast-look' ? ' is-hot' : ''}`} data-tour-id="cast-look">
        <p className="sps-mock-label">Look & gait</p>
        <p className="sps-mock-line">Steady eyes, military spine, walk like a vow.</p>
      </div>
      <div className={`sps-mock-panel${on === 'cast-wardrobe' ? ' is-hot' : ''}`} data-tour-id="cast-wardrobe">
        <p className="sps-mock-label">Wardrobe elements</p>
        <p className="sps-mock-line">Outfit · accessories · palette · costume notes</p>
      </div>
    </div>
  );
}

function StageMock({ on }) {
  return (
    <div className="sps-mock">
      <div className={`sps-mock-still${on === 'stage-block' ? ' is-hot' : ''}`} data-tour-id="stage-block">
        <p className="sps-mock-label">Blocking</p>
        <div className="sps-mock-frame" />
      </div>
      <div className={`sps-mock-field${on === 'stage-cam' ? ' is-hot' : ''}`} data-tour-id="stage-cam">
        <p className="sps-mock-label">Camera</p>
        <p className="sps-mock-line">40mm · 1.4m · slow dolly in</p>
      </div>
    </div>
  );
}

function WorldMock({ on }) {
  return (
    <div className="sps-mock sps-mock-split">
      <div className={`sps-mock-panel${on === 'world-place' ? ' is-hot' : ''}`} data-tour-id="world-place">
        <p className="sps-mock-label">Location</p>
        <p className="sps-mock-line">Temple courtyard · west light · stone dust</p>
      </div>
      <div className={`sps-mock-panel${on === 'world-plate' ? ' is-hot' : ''}`} data-tour-id="world-plate">
        <p className="sps-mock-label">Environment plate</p>
        <p className="sps-mock-line">Lock the plate so Generate keeps the same world.</p>
      </div>
    </div>
  );
}

function PromoMock({ on }) {
  return (
    <div className="sps-mock sps-mock-split">
      <div className={`sps-mock-panel${on === 'promo-trailer' ? ' is-hot' : ''}`} data-tour-id="promo-trailer">
        <p className="sps-mock-label">Trailer</p>
        <p className="sps-mock-line">Hero takes on a trailer spine.</p>
      </div>
      <div className={`sps-mock-panel${on === 'promo-social' ? ' is-hot' : ''}`} data-tour-id="promo-social">
        <p className="sps-mock-label">Teaser / reels</p>
        <p className="sps-mock-line">Vertical and teaser lengths, same look.</p>
      </div>
    </div>
  );
}

function CampaignMock({ on }) {
  return (
    <div className="sps-mock sps-mock-split">
      <div className={`sps-mock-panel${on === 'campaign-kit' ? ' is-hot' : ''}`} data-tour-id="campaign-kit">
        <p className="sps-mock-label">Key art</p>
        <p className="sps-mock-line">One-sheet, outdoor, OTT. Same face.</p>
      </div>
      <div className={`sps-mock-panel${on === 'campaign-research' ? ' is-hot' : ''}`} data-tour-id="campaign-research">
        <p className="sps-mock-label">Research</p>
        <p className="sps-mock-line">Audience, markets, calendar, spend.</p>
      </div>
    </div>
  );
}

function StoryboardMock({ on }) {
  return (
    <div className="sps-mock sps-mock-split">
      <div className={`sps-mock-panel${on === 'board-frame' ? ' is-hot' : ''}`} data-tour-id="board-frame">
        <p className="sps-mock-label">Frame</p>
        <p className="sps-mock-line">SC01_SH01 still</p>
      </div>
      <div className={`sps-mock-panel${on === 'board-prompt' ? ' is-hot' : ''}`} data-tour-id="board-prompt">
        <p className="sps-mock-label">Prompt</p>
        <p className="sps-mock-line">Still prompt under the panel.</p>
      </div>
    </div>
  );
}

function PitchMock({ on }) {
  return (
    <div className="sps-mock">
      <div className={`sps-mock-panel${on === 'pitch-slides' ? ' is-hot' : ''}`} data-tour-id="pitch-slides">
        <p className="sps-mock-label">Investor slides</p>
        <p className="sps-mock-line">Logline · craft · comps · the ask</p>
      </div>
      <button type="button" className={`sps-mock-btn${on === 'pitch-export' ? ' is-hot' : ''}`} data-tour-id="pitch-export">
        Export deck
      </button>
    </div>
  );
}

function BudgetMock({ on }) {
  return (
    <div className="sps-mock">
      <div className={`sps-mock-panel${on === 'budget-line' ? ' is-hot' : ''}`} data-tour-id="budget-line">
        <p className="sps-mock-label">Picture estimate</p>
        <p className="sps-mock-line">Craft · generate · post on one sheet</p>
      </div>
      <div className={`sps-mock-panel${on === 'budget-grant' ? ' is-hot' : ''}`} data-tour-id="budget-grant">
        <p className="sps-mock-label">Grant access</p>
        <p className="sps-mock-line">Switch Budget on for producer / investor users.</p>
      </div>
    </div>
  );
}

function ReelMock({ on }) {
  return (
    <div className="sps-mock">
      <div className={`sps-mock-panel${on === 'reel-takes' ? ' is-hot' : ''}`} data-tour-id="reel-takes">
        <p className="sps-mock-label">Takes</p>
        <p className="sps-mock-line">1A still · 1A motion · 1B still</p>
      </div>
      <button type="button" className={`sps-mock-btn${on === 'reel-play' ? ' is-hot' : ''}`} data-tour-id="reel-play">
        Play reel
      </button>
    </div>
  );
}

function CompileMock({ on }) {
  return (
    <div className="sps-mock sps-mock-split">
      <div className={`sps-mock-panel${on === 'compile-f0' ? ' is-hot' : ''}`} data-tour-id="compile-f0">
        <p className="sps-mock-label">Frame 0</p>
        <p className="sps-mock-line">Wide courtyard. Bow unraised. Light from the west.</p>
      </div>
      <div className={`sps-mock-panel${on === 'compile-f120' ? ' is-hot' : ''}`} data-tour-id="compile-f120">
        <p className="sps-mock-label">Frame 120</p>
        <p className="sps-mock-line">Bow at full draw. Metal catch-light. Eyes locked.</p>
      </div>
    </div>
  );
}

function GenerateMock({ on }) {
  return (
    <div className="sps-mock">
      <div className={`sps-mock-still${on === 'generate-still' ? ' is-hot' : ''}`} data-tour-id="generate-still">
        <p className="sps-mock-label">Look lock still</p>
        <div className="sps-mock-frame" />
      </div>
      <button type="button" className={`sps-mock-btn${on === 'generate-run' ? ' is-hot' : ''}`} data-tour-id="generate-run">
        Generate take
      </button>
    </div>
  );
}

function SettingsMock({ on }) {
  return (
    <div className="sps-mock">
      <div className={`sps-mock-panel${on === 'settings-consoles' ? ' is-hot' : ''}`} data-tour-id="settings-consoles">
        <p className="sps-mock-label">Console access for this user</p>
        <p className="sps-mock-chips"><span>Writer</span><span>Matrix</span><span className="off">Generate</span></p>
      </div>
      <div className={`sps-mock-panel${on === 'settings-otp' ? ' is-hot' : ''}`} data-tour-id="settings-otp">
        <p className="sps-mock-label">Invite OTP</p>
        <p className="sps-mock-line">Welcome mail + 6-digit code to their inbox.</p>
      </div>
    </div>
  );
}

const MOCKS = {
  writer: WriterMock,
  matrix: MatrixMock,
  form: FormMock,
  stage: StageMock,
  cast: CastMock,
  world: WorldMock,
  promo: PromoMock,
  campaign: CampaignMock,
  storyboard: StoryboardMock,
  pitch: PitchMock,
  budget: BudgetMock,
  reel: ReelMock,
  compile: CompileMock,
  generate: GenerateMock,
  settings: SettingsMock,
};

export default function StudioTourOverlay({ isOpen, onClose }) {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [reduce, setReduce] = useState(false);
  const [pos, setPos] = useState({ x: 48, y: 28, maxX: 640 });
  const stageRef = useRef(null);
  const step = STEPS[i];
  const n = STEPS.length;
  const Mock = MOCKS[step?.room] || WriterMock;

  useEffect(() => {
    if (!isOpen) return undefined;
    setI(0);
    setPlaying(true);
    setReduce(prefersReducedMotion());
    return undefined;
  }, [isOpen]);

  const measure = useCallback(() => {
    const stage = stageRef.current;
    const id = STEPS[i]?.target;
    const el = stage?.querySelector(`[data-tour-id="${id}"]`);
    if (!stage || !el) return;
    const s = stage.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setPos({
      x: r.left - s.left + Math.min(r.width / 2, 80),
      y: r.top - s.top + Math.min(r.height, 36),
      maxX: s.width,
    });
  }, [i]);

  useLayoutEffect(() => {
    if (!isOpen) return undefined;
    const t = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(t);
      window.removeEventListener('resize', measure);
    };
  }, [isOpen, measure, i]);

  const next = useCallback(() => {
    setI((n0) => {
      if (n0 >= STEPS.length - 1) {
        setPlaying(false);
        return n0;
      }
      return n0 + 1;
    });
  }, []);
  const prev = useCallback(() => setI((n0) => Math.max(0, n0 - 1)), []);

  useEffect(() => {
    if (!isOpen || !playing) return undefined;
    const t = setInterval(next, STEP_MS);
    return () => clearInterval(t);
  }, [isOpen, playing, next, i]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === ' ') {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, next, prev, onClose]);

  if (!isOpen || !step) return null;

  const last = i === n - 1;

  return (
    <div className="sps-tour" role="dialog" aria-label="Studio demo tour">
      <div className="sps-tour-stage" ref={stageRef}>
        <div className="sps-tour-chrome">
          <StageWorksMark size={28} className="w-7 h-7 rounded-md shrink-0" />
          <span className="sps-tour-product">{PRODUCT}</span>
          <div className="sps-tour-rooms" role="list">
            {ROOMS.map((s) => {
              const Icon = s.Icon;
              const on = step.room === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="listitem"
                  data-tour-id={`tab-${s.id}`}
                  className={`sps-tour-room${on ? ' is-on' : ''}`}
                  onClick={() => {
                    const idx = firstStepForRoom(s.id);
                    if (idx >= 0) setI(idx);
                  }}
                  title={s.label}
                >
                  <Icon size={16} />
                  <span>{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="sps-tour-caption">
          <p className="sps-tour-pop-kicker">{step.kicker} · {String(i + 1).padStart(2, '0')} / {String(n).padStart(2, '0')}</p>
          <p className="sps-tour-pop-title">{step.title}</p>
          <p className="sps-tour-pop-body">{step.body}</p>
        </div>

        <div className="sps-tour-work">
          <Mock on={step.target} />
        </div>

        {!reduce ? (
          <div
            className="sps-tour-pointer"
            style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
            aria-hidden
          >
            <MousePointer2 className="w-5 h-5" strokeWidth={2.2} />
          </div>
        ) : null}
      </div>

      <div className="sps-tour-bar">
        <button type="button" className="sps-icon-btn" onClick={prev} aria-label="Previous" disabled={i === 0}>
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button type="button" className="sps-icon-btn" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
        <button type="button" className="sps-icon-btn" onClick={next} aria-label="Next" disabled={last}>
          <ChevronRight className="w-4 h-4" />
        </button>
        <span className="sps-pres-meta text-[11px]">
          {last ? 'Tour complete — exit or replay from Writer' : 'Inside the desk · ghost pointer only'}
        </span>
        <span className="flex-1" />
        <button
          type="button"
          className="sps-btn text-xs"
          onClick={() => {
            setI(0);
            setPlaying(true);
          }}
        >
          Replay
        </button>
        <button type="button" className="sps-btn sps-btn-primary text-xs" onClick={onClose}>
          <X className="w-3.5 h-3.5" />
          Exit demo
        </button>
      </div>
    </div>
  );
}
