import Link from 'next/link';
import type { RaceSeriesData } from '@/lib/types';


export function RaceSeriesPanel({ data }: { data: RaceSeriesData | null }) {
    if (!data || data.history.length === 0) return null;
    return (
        <section className="mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-4 py-3">
                <h2 className="text-xl font-black text-slate-950">過去の同レース</h2>
                <p className="mt-1 text-xs leading-6 text-slate-600">
                    レース名を正規化して一致した過去{data.sample_size}回を表示します。
                </p>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-600">
                        <tr>
                            <th className="px-4 py-2 text-left">開催</th>
                            <th className="px-3 py-2 text-left">条件</th>
                            <th className="px-3 py-2 text-left">勝ち馬</th>
                            <th className="px-3 py-2 text-right">人気</th>
                            <th className="px-3 py-2 text-left">AI偏差値1位</th>
                            <th className="px-4 py-2 text-right">着順</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {data.history.map((race) => (
                            <tr key={race.race_id}>
                                <td className="px-4 py-3">
                                    {race.url ? (
                                        <Link prefetch={false} href={race.url} className="font-bold text-slate-800 hover:text-primary">
                                            <span className="block text-xs text-slate-500">{race.race_date}</span>
                                            <span>{race.venue_name}{race.race_number}R</span>
                                        </Link>
                                    ) : (
                                        /* レースページを提供していない期間はリンクにしない。 */
                                        <div className="font-bold text-slate-800">
                                            <span className="block text-xs text-slate-500">{race.race_date}</span>
                                            <span>{race.venue_name}{race.race_number}R</span>
                                        </div>
                                    )}
                                </td>
                                <td className="px-3 py-3 text-slate-600">{race.course_label}</td>
                                <td className="px-3 py-3 font-bold text-slate-800">{race.winner_name ?? '—'}</td>
                                <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-600">
                                    {race.winner_popularity ?? '—'}
                                </td>
                                <td className="px-3 py-3 font-bold text-slate-700">{race.top_prediction_name ?? '—'}</td>
                                <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-600">
                                    {race.top_prediction_rank == null ? '—' : `${race.top_prediction_rank}着`}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
