import { DayParamSchema, StoriesQuerySchema } from '@ai-daily/shared';
import { Hono } from 'hono';
import type { AppEnv } from '../env.ts';
import { json, jsonError, rawPathname } from '../lib/http.ts';
import { parseOr400 } from '../lib/validate.ts';
import { getDay, health, latestDate, listDays } from '../services/days.ts';
import { exportAll } from '../services/favorites.ts';
import { searchStories } from '../services/stories.ts';
import { trends } from '../services/trends.ts';

export const readRoutes = new Hono<AppEnv>()
  .get('/health', async (c) => json(await health(c.env.DB)))

  .get('/days', async (c) => json(await listDays(c.env.DB)))

  .get('/days/:date', async (c) => {
    // validate the raw segment ourselves: Hono decodes params leniently, the legacy API used decodeURIComponent
    const raw = rawPathname(c.req.raw).slice('/api/days/'.length);
    const param = parseOr400(DayParamSchema, raw);
    let date: string | null;
    if (param.kind === 'latest') {
      date = await latestDate(c.env.DB);
      if (!date) return jsonError(404, '暂无数据');
    } else date = param.date;
    const day = await getDay(c.env.DB, date);
    if (!day) return jsonError(404, '没有该日期的日报');
    return json(day);
  })

  .get('/stories', async (c) => {
    const sp = new URL(c.req.url).searchParams;
    const query = parseOr400(StoriesQuerySchema, {
      q: sp.get('q'),
      category: sp.get('category'),
      from: sp.get('from'),
      to: sp.get('to'),
      limit: sp.get('limit'),
    });
    const stories = await searchStories(c.env.DB, query);
    return json({ count: stories.length, stories });
  })

  .get('/trends', async (c) => json(await trends(c.env.DB)))

  .get('/export', async (c) => {
    const data = await exportAll(c.env.DB);
    const first = data.days[0];
    return json(data, 200, {
      'Content-Disposition': `attachment; filename="ai-daily-export-${first ? first.date : 'empty'}.json"`,
    });
  });
