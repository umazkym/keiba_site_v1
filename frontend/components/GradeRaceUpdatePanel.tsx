import type { GradeRaceUpdatePlan } from '@/lib/grade-race-update-plan';

type GradeRaceUpdatePanelProps = {
  plan: GradeRaceUpdatePlan;
};

export function GradeRaceUpdatePanel({ plan }: GradeRaceUpdatePanelProps) {
  const currentIndex = plan.stages.findIndex((stage) => stage.key === plan.currentStageKey);

  return (
    <section className="border border-slate-200 bg-slate-50 p-4 sm:p-5" aria-label="重賞記事の更新予定">
      <div className="mb-3">
        <p className="text-xs font-bold tracking-[0.14em] text-slate-400">重賞記事の更新方針</p>
        <h2 className="mt-1 text-lg font-black leading-7 text-slate-900">
          同じURLで、レース当日まで情報を更新します
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          展望、枠順、前日オッズ、当日朝の馬場を別記事に分けず、このページへ追記して判断材料を集約します。
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {plan.stages.map((stage, index) => {
          const isDone = index <= currentIndex;
          const isCurrent = stage.key === plan.currentStageKey;

          return (
            <div
              key={stage.key}
              className={`border p-3 ${
                isCurrent
                  ? 'border-primary bg-white'
                  : isDone
                    ? 'border-slate-200 bg-white'
                    : 'border-slate-200 bg-slate-100/70'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-black text-slate-900">{stage.label}</p>
                <span className={`shrink-0 text-[11px] font-bold ${isDone ? 'text-primary' : 'text-slate-400'}`}>
                  {isCurrent ? '現在' : isDone ? '反映済み' : '予定'}
                </span>
              </div>
              <p className="mt-1 text-xs font-bold text-slate-500">{stage.timing}</p>
              <p className="mt-2 text-xs leading-5 text-slate-600">{stage.focus}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
