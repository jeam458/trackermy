import { Mic, MicOff, Volume2, Sparkles, BookmarkPlus, Hand } from 'lucide-react'

interface VoiceControlPanelProps {
  voiceCoach: any
  onToggleTools: () => void
  coachToolsOpen: boolean
}

export function VoiceControlPanel({
  voiceCoach,
  onToggleTools,
  coachToolsOpen
}: VoiceControlPanelProps) {
  if (voiceCoach.hidden) return null

  return (
    <div
      className={`pointer-events-auto fixed z-[45] top-[max(5.5rem,calc(env(safe-area-inset-top)+5rem))] ${
        coachToolsOpen ? 'right-3' : 'left-3'
      }`}
    >
      <button
        type="button"
        onClick={onToggleTools}
        className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/12 bg-[#121821]/95 text-teal-200 shadow-lg hover:bg-white/10"
        aria-expanded={coachToolsOpen}
        aria-label="Herramientas de voz y aprendizaje del coach"
        title="Voz y aprendizaje"
      >
        <Hand className="h-5 w-5" aria-hidden />
      </button>
      {coachToolsOpen ? (
        <div className={`absolute top-[calc(100%+0.5rem)] ${coachToolsOpen ? 'right-0' : 'left-0'}`}>
          <VoiceControlToolsPanel voiceCoach={voiceCoach} />
        </div>
      ) : null}
    </div>
  )
}

function VoiceControlToolsPanel({ voiceCoach }: { voiceCoach: any }) {
  return (
    <div className="flex w-56 flex-col gap-2.5 rounded-2xl border border-white/12 bg-[#121821]/97 p-3 shadow-[0_16px_40px_rgba(0,0,0,0.45)] backdrop-blur-md">
      <button
        type="button"
        onClick={voiceCoach.toggleListen}
        disabled={!voiceCoach.supported}
        className="flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600/90 text-sm font-medium text-white shadow-md hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
        aria-pressed={voiceCoach.listening}
      >
        {voiceCoach.listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        {voiceCoach.listening ? voiceCoach.voice.stop : voiceCoach.voice.listen}
      </button>
      <label className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
        <span className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-200/90" aria-hidden />
          {voiceCoach.voice.learnMode}
        </span>
        <input
          type="checkbox"
          checked={voiceCoach.learnMode}
          onChange={(e) => voiceCoach.setLearnMode(e.target.checked)}
          className="h-4 w-4 accent-amber-400"
        />
      </label>
      {voiceCoach.pendingLearn ? (
        <button
          type="button"
          onClick={() => voiceCoach.savePendingShortcut()}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-800/90 text-sm font-medium text-amber-200 hover:bg-slate-700"
          title={voiceCoach.voice.saveShortcut}
        >
          <BookmarkPlus className="h-4 w-4" />
          {voiceCoach.voice.saveShortcut}
        </button>
      ) : null}
      <label className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
        <span className="flex items-center gap-2">
          <Volume2 className="h-4 w-4 text-sky-200/90" aria-hidden />
          {voiceCoach.voice.coachVoiceReadHint}
        </span>
        <input
          type="checkbox"
          checked={voiceCoach.coachVoiceRead}
          onChange={(e) => voiceCoach.setCoachVoiceRead(e.target.checked)}
          className="h-4 w-4 accent-sky-400"
        />
      </label>
    </div>
  )
}
