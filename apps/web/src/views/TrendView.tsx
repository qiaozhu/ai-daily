import type { TrendsResponse } from '@ai-daily/shared';
import { categoryColors } from '../lib/categories.ts';

interface Props {
  data: TrendsResponse;
  onDate: (date: string) => void;
  onSearch: (topic: string) => void;
}

/** category distribution per day + recurring topics (all history) */
export function TrendView({ data: t, onDate, onSearch }: Props) {
  const dates = t.days.map((d) => d.date);
  const cnt: Record<string, Record<string, number>> = {};
  for (const r of t.per_day) (cnt[r.date] ||= {})[r.category] = r.n;
  const color = categoryColors(t.category_totals.map((c) => c.category));
  const mx = Math.max(1, ...t.category_totals.map((c) => c.n));
  const last7 = dates.slice(-7);
  const rec = t.recurring_topics;
  const show = (rec.length ? rec : t.topics).slice(0, 30);
  const tmx = Math.max(1, ...show.map((x) => x.story_count));

  return (
    <>
      <div className="vh">
        <h2>📈 趋势</h2>
        <p>全部 {dates.length} 天日报的分类分布与反复出现的话题</p>
      </div>
      <section className="tsec">
        <h3>每日分类分布</h3>
        <div className="legend">
          {t.category_totals.map((c) => (
            <span key={c.category}>
              <i style={{ background: color(c.category) }}></i>
              {c.category}
            </span>
          ))}
        </div>
        <div className="tscroll">
          <table className="trend">
            <tbody>
              <tr>
                <th>日期</th>
                <th>分类分布</th>
                <th>条数</th>
              </tr>
              {t.days
                .slice()
                .reverse()
                .map((d) => {
                  const c = cnt[d.date] || {};
                  const tot = Object.values(c).reduce((a, b) => a + b, 0) || 1;
                  return (
                    <tr key={d.date}>
                      <td>
                        <button type="button" className="tlink" data-date={d.date} onClick={() => onDate(d.date)}>
                          {d.date}
                        </button>
                      </td>
                      <td>
                        <div className="stack">
                          {Object.entries(c).map(([k, v]) => (
                            <span
                              key={k}
                              title={`${k} ${v}`}
                              style={{ width: `${(v / tot) * 100}%`, background: color(k) }}
                            />
                          ))}
                        </div>
                      </td>
                      <td>{d.n}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>
      <section className="tsec">
        <h3>分类累计（近 7 天明细）</h3>
        <div className="tscroll">
          <table className="trend">
            <tbody>
              <tr>
                <th>分类</th>
                <th>累计</th>
                {last7.map((d) => (
                  <th key={d}>{d.slice(5)}</th>
                ))}
              </tr>
              {t.category_totals.map((c) => (
                <tr key={c.category}>
                  <td>{c.category}</td>
                  <td>
                    <span className="bar" style={{ width: `${(c.n / mx) * 90}px`, background: color(c.category) }} />
                    {c.n}
                  </td>
                  {last7.map((d) => (
                    <td key={d}>{cnt[d]?.[c.category] || '·'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="tsec">
        <h3>{rec.length ? '跨日反复出现的话题' : '热门话题'}</h3>
        {!rec.length && (
          <p style={{ color: 'var(--sub)', fontSize: 13, margin: '0 0 6px' }}>
            目前仅有 {dates.length} 天数据，积累 2 天以上后将显示跨日反复出现的话题。
          </p>
        )}
        <div className="tscroll">
          <table className="trend">
            <tbody>
              <tr>
                <th>话题</th>
                <th>出现天数</th>
                <th>相关资讯</th>
                <th>最近一次</th>
              </tr>
              {show.map((x) => (
                <tr key={x.topic}>
                  <td>
                    <button type="button" className="tlink" data-search={x.topic} onClick={() => onSearch(x.topic)}>
                      {x.topic}
                    </button>
                  </td>
                  <td>{x.day_count}</td>
                  <td>
                    <span className="bar" style={{ width: `${(x.story_count / tmx) * 80}px` }} />
                    {x.story_count}
                  </td>
                  <td>{x.last_seen}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
