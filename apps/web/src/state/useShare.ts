import { useState } from 'react';

/** share the current page (system share sheet, else copy the link) */
export function useShare(): [string | null, () => void] {
  const [toast, setToast] = useState<string | null>(null);
  const share = () => {
    const url = location.href;
    const flash = (m: string) => {
      setToast(m);
      setTimeout(() => setToast(null), 1800);
    };
    if (navigator.share) {
      navigator.share({ title: document.title, url }).catch(() => undefined);
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(
        () => flash('链接已复制'),
        () => flash('复制失败'),
      );
    }
  };
  return [toast, share];
}
