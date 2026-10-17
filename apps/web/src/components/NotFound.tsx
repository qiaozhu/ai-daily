import { useContext, useLayoutEffect } from 'react';
import { dateSpacedCN } from '../lib/format.ts';
import { navigate } from '../lib/router.ts';
import { NotFoundContext } from '../state/ui-context.ts';
import { Icon } from './Icon.tsx';

interface Props {
  kind: 'day' | 'story';
  /** earliest report date (from /api/days), for "日报从 X 开始" */
  earliest?: string | null;
}

/**
 * 404 page (layout of the F4 empty state in PR #20): 64×64 brand-soft icon, title, one line, primary
 * "回到今日" (+ "看往期" for a missing day). The HTTP 404 status comes from the Worker (routes/pages.ts).
 * While shown, no navigation tab is highlighted.
 */
export function NotFound({ kind, earliest }: Props) {
  const day = kind === 'day';
  const setNotFound = useContext(NotFoundContext);
  useLayoutEffect(() => {
    setNotFound(true);
    return () => setNotFound(false);
  }, [setNotFound]);
  return (
    <section data-state="not-found" className="flex flex-col items-center px-6 pt-16 pb-8 text-center lg:pt-24">
      <div className="mb-4 flex size-16 items-center justify-center rounded-[18px] bg-brand-soft text-brand-text">
        <Icon name={day ? 'today' : 'search'} size={30} />
      </div>
      <h1 className="mb-1.5 text-title2">{day ? '这一天没有日报' : '找不到这个话题'}</h1>
      <p className="mb-5 text-body text-text-2">
        {day
          ? earliest
            ? `日报从 ${dateSpacedCN(earliest)} 开始`
            : '目前还没有日报'
          : '链接可能写错了，或者这个话题已经不在了'}
      </p>
      <div className="grid w-[200px] gap-2.5">
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate('/', { top: true });
          }}
          className="flex h-[50px] items-center justify-center rounded-button bg-brand text-headline text-on-brand active:scale-[.97]"
        >
          回到今日
        </a>
        {day && (
          <a
            href="/archive"
            onClick={(e) => {
              e.preventDefault();
              navigate('/archive', { top: true });
            }}
            className="flex h-[50px] items-center justify-center rounded-button bg-brand-soft text-headline text-brand-text active:scale-[.97]"
          >
            看往期
          </a>
        )}
      </div>
    </section>
  );
}
