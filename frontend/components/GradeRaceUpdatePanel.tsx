import type { GradeRaceUpdatePlan } from '@/lib/grade-race-update-plan';

type GradeRaceUpdatePanelProps = {
  plan: GradeRaceUpdatePlan;
};

export function GradeRaceUpdatePanel({ plan }: GradeRaceUpdatePanelProps) {
  const currentIndex = plan.stages.findIndex((stage) => stage.key === plan.currentStageKey);

  return (
    <section className="border border-slate-200 bg-slate-50 p-3 sm:p-5" aria-label="重賞記事の更新予定">
      <div className="mb-2.5 sm:mb-3">
        <p className="text-[10px] font-bold tracking-[0.14em] text-slate-400 sm:text-xs">重賞記事の更新方針</p>
        <h2 className="mt-1 text-base font-black leading-6 text-slate-900 sm:text-lg sm:leading-7">
          同じURLで、レース当日まで情報を更新します
        </h2>
        <p className="mt-1.5 text-xs leading-5 text-slate-600 sm:mt-2 sm:text-sm sm:leading-6">
          出走予定、枠順、直前条件、当日朝の馬場、確定結果を別記事に分けず、このページへ追記します。
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {plan.stages.map((stage, index) => {
          const isDone = index <= currentIndex;
          const isCurrent = stage.key === plan.currentStageKey;

          return (
            <div
              key={stage.key}
              className={`border p-2.5 sm:p-3 ${
                isCurrent
                  ? 'border-primary bg-white'
                  : isDone
                    ? 'border-slate-200 bg-white'
                    : 'border-slate-200 bg-slate-100/70'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-black text-slate-900 sm:text-sm">{stage.label}</p>
                <span className={`shrink-0 text-[11px] font-bold ${isDone ? 'text-primary' : 'text-slate-400'}`}>
                  {isCurrent ? '現在' : isDone ? '反映済み' : '予定'}
                </span>
              </div>
              <p className="mt-1 text-xs font-bold text-slate-500">{stage.timing}</p>
              <p className="mt-1.5 text-[11px] leading-4 text-slate-600 sm:mt-2 sm:text-xs sm:leading-5">{stage.focus}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
