import { useState } from 'react';
import { api } from '../api/client.ts';
import { Icon, type IconName } from '../components/Icon.tsx';
import { Footnote, Main } from '../components/Layout.tsx';
import { EmptyState, ErrorState, ListSkeleton } from '../components/States.tsx';
import { StoryList } from '../components/StoryList.tsx';
import { useExpanded } from '../state/useExpanded.ts';
import type { Theme } from '../lib/theme.ts';
import { useAsync } from '../state/useAsync.ts';

function Row({ icon, children, right }: { icon: IconName; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <span className="flex min-h-12 items-center gap-3 px-4 py-2.5 text-body">
      <Icon name={icon} className="text-brand" />
      <span className="flex-1">{children}</span>
      {right}
    </span>
  );
}

interface Props {
  favVersion: number;
  onFavsLoaded: (ids: string[]) => void;
  theme: Theme;
  onToggleTheme: () => void;
}

/** 我的: favorites (server-side, v5), 关注 entry (F4, later), theme switch and data export. Visual refresh only. */
export default function MePage({ favVersion, onFavsLoaded, theme, onToggleTheme }: Props) {
  const [reload, setReload] = useState(0);
  const res = useAsync(
    'favorites',
    () =>
      api.favorites().then((r) => {
        onFavsLoaded(r.ids);
        return r;
      }),
    favVersion + reload,
  );
  const expanded = useExpanded();
  const dark = theme === 'dark';

  let favs: React.ReactNode;
  if (res.status === 'loading') favs = <ListSkeleton n={2} />;
  else if (res.status === 'error') favs = <ErrorState onRetry={() => setReload((n) => n + 1)} />;
  else
    favs = res.data.count ? (
      <StoryList
        stories={res.data.stories}
        cat={null}
        title={`收藏 · ${res.data.count}`}
        showDate
        empty=""
        expanded={expanded}
      />
    ) : (
      <>
        <h2 className="mb-2.5 text-title2">收藏</h2>
        <EmptyState>还没有收藏。展开话题卡片的“详情”，点“收藏”即可保存在服务器上，任何设备都能看到。</EmptyState>
      </>
    );

  return (
    <Main>
      <h1 id="title" className="mb-4 text-large lg:text-large-d">
        我的
      </h1>
      <div className="mb-6 overflow-hidden rounded-card bg-surface shadow-card [&>*+*]:border-t-[0.5px] [&>*+*]:border-separator">
        <Row icon="bell" right={<span className="text-footnote text-text-2">即将上线</span>}>
          关注
        </Row>
        <button
          type="button"
          data-theme-toggle=""
          role="switch"
          aria-checked={dark}
          onClick={onToggleTheme}
          className="block w-full text-left"
        >
          <Row
            icon={dark ? 'moon' : 'sun'}
            right={
              <span
                className={`relative h-[31px] w-[51px] rounded-full transition-colors duration-200 ${dark ? 'bg-brand' : 'bg-surface-2'}`}
              >
                <i
                  className={`absolute top-0.5 size-[27px] rounded-full bg-white shadow transition-[left] duration-200 ${dark ? 'left-[22px]' : 'left-0.5'}`}
                />
              </span>
            }
          >
            深色模式
          </Row>
        </button>
        <a href={api.exportUrl} download className="block">
          <Row icon="download" right={<Icon name="chev" size={16} className="text-text-3" />}>
            导出数据（JSON）
          </Row>
        </a>
      </div>
      <div id="favs" data-fav-view="">
        {favs}
      </div>
      <Footnote />
    </Main>
  );
}
