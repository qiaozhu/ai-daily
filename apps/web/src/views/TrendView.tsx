import type { TrendsResponse } from '@ai-daily/shared';
import { categoryColors } from '../lib/categories.ts';
import { onLinkClick } from '../lib/router.ts';

interface Props {
  data: TrendsResponse;
  dayHref: (date: string) => string;
  onSearch: (topic: string) => void;
}

const TH = 'px-3 py-2 text-left text-footnote font-semibold whitespace-nowrap text-text-2';
const TD = 'border-t-[0.5px] border-separator px-3 py-2 text-subhead whitespace-nowrap';

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="tsec mb-4 rounded-card bg-surface p-4 shadow-card">
      <h2 className="mb-2 text-headline">{title}</h2>
      {children}
    </section>
  );
}

/** v5 trend view (category distribution per day + recurring topics), restyled with the v1 tokens */
export function TrendView({ data: t, dayHref, onSearch }: Props) {
  const dates = t.days.map((d) => d.date);
  const cnt: Record<string, Record<string, number>> = {};
  for (const r of t.per_day) (cnt[r.date] ||= {})[r.category] = r.n;
  const color = categoryColors(t.category_totals.map((c) => c.category));
  const mx = Math.max(1, ...t.category_totals.map((c) => c.n));
  const last7 = dates.slice(-7);
  const rec = t.recurring_topics;
  const show = (rec.length ? rec : t.topics).slice(0, 30);
  const tmx = Math.max(1, ...show.map((x) => x.story_count));
  const bar = (w: number, bg?: string) => (
    <span
      className="mr-1.5 inline-block h-1.5 rounded-xs align-middle"
      style={{ width: w, background: bg ?? 'var(--ad-brand)' }}
    />
  );

  return (
    <>
      <p className="vh mb-4 text-footnote text-text-2">全部 {dates.length} 天日报的分类分布与反复出现的话题</p>
      <Card title="每日分类分布">
        <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-footnote text-text-2">
          {t.category_totals.map((c) => (
            <span key={c.category} className="inline-flex items-center gap-1">
              <i className="size-2 rounded-xs" style={{ background: color(c.category) }} />
              {c.category}
            </span>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="trend w-full">
            <tbody>
              <tr>
                <th className={TH}>日期</th>
                <th className={TH}>分类分布</th>
                <th className={TH}>条数</th>
              </tr>
              {t.days
                .slice()
                .reverse()
                .map((d) => {
                  const c = cnt[d.date] || {};
                  const tot = Object.values(c).reduce((a, b) => a + b, 0) || 1;
                  return (
                    <tr key={d.date}>
                      <td className={TD}>
                        <a
                          className="tlink text-brand-text"
                          data-date={d.date}
                          href={dayHref(d.date)}
                          onClick={onLinkClick}
                        >
                          {d.date}
                        </a>
                      </td>
                      <td className={`${TD} w-full`}>
                        <div className="flex h-2 min-w-32 overflow-hidden rounded-xs bg-surface-2">
                          {Object.entries(c).map(([k, v]) => (
                            <span
                              key={k}
                              title={`${k} ${v}`}
                              style={{ width: `${(v / tot) * 100}%`, background: color(k) }}
                            />
                          ))}
                        </div>
                      </td>
                      <td className={TD}>{d.n}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="分类累计（近 7 天明细）">
        <div className="overflow-x-auto">
          <table className="trend w-full">
            <tbody>
              <tr>
                <th className={TH}>分类</th>
                <th className={TH}>累计</th>
                {last7.map((d) => (
                  <th key={d} className={TH}>
                    {d.slice(5)}
                  </th>
                ))}
              </tr>
              {t.category_totals.map((c) => (
                <tr key={c.category}>
                  <td className={TD}>{c.category}</td>
                  <td className={TD}>
                    {bar((c.n / mx) * 90, color(c.category))}
                    {c.n}
                  </td>
                  {last7.map((d) => (
                    <td key={d} className={`${TD} text-text-2`}>
                      {cnt[d]?.[c.category] || '·'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title={rec.length ? '跨日反复出现的话题' : '热门话题'}>
        {!rec.length && (
          <p className="mb-1.5 text-footnote text-text-2">
            目前仅有 {dates.length} 天数据，积累 2 天以上后将显示跨日反复出现的话题。
          </p>
        )}
        <div className="overflow-x-auto">
          <table className="trend w-full">
            <tbody>
              <tr>
                <th className={TH}>话题</th>
                <th className={TH}>出现天数</th>
                <th className={TH}>相关资讯</th>
                <th className={TH}>最近一次</th>
              </tr>
              {show.map((x) => (
                <tr key={x.topic}>
                  <td className={TD}>
                    <button
                      type="button"
                      className="tlink text-brand-text"
                      data-search={x.topic}
                      onClick={() => onSearch(x.topic)}
                    >
                      {x.topic}
                    </button>
                  </td>
                  <td className={TD}>{x.day_count}</td>
                  <td className={TD}>
                    {bar((x.story_count / tmx) * 80)}
                    {x.story_count}
                  </td>
                  <td className={`${TD} text-text-2`}>{x.last_seen}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
