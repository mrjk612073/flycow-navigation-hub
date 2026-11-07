import { useState, type FormEvent } from 'react';
import { Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@client/src/components/ui/input';
import { Button } from '@client/src/components/ui/button';
import { getPublicSettings } from '@client/src/api/settings';

const SearchBar = () => {
  const { data } = useQuery({
    queryKey: ['publicSettings'],
    queryFn: getPublicSettings,
    staleTime: 60_000,
  });

  const searchEngine = data?.settings?.searchEngine ?? 'baidu';
  const [keyword, setKeyword] = useState('');

  const getPlaceholder = (): string => {
    switch (searchEngine) {
      case 'baidu':
        return '搜索百度，回车跳转';
      case 'google':
        return '搜索 Google，回车跳转';
      case 'bing':
        return '搜索 Bing，回车跳转';
      default:
        return '搜索，回车跳转';
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = keyword.trim();
    if (!trimmed) return;

    let url = '';
    switch (searchEngine) {
      case 'baidu':
        url = `https://www.baidu.com/s?wd=${encodeURIComponent(trimmed)}`;
        break;
      case 'google':
        url = `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
        break;
      case 'bing':
        url = `https://www.bing.com/search?q=${encodeURIComponent(trimmed)}`;
        break;
      default:
        url = `https://www.baidu.com/s?wd=${encodeURIComponent(trimmed)}`;
    }

    window.open(url, '_blank', 'noopener noreferrer');
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="relative w-full max-w-[600px] mx-auto rise"
      style={{ animationDelay: '0.3s' }}
    >
      <div className="glass-card flex items-center h-12 px-4 gap-3">
        <Search className="w-5 h-5 text-white/60 flex-shrink-0" />
        <Input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder={getPlaceholder()}
          className="flex-1 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-white placeholder:text-white/40 text-sm h-auto py-0"
        />
        <Button
          type="submit"
          size="sm"
          className="h-8 px-4 bg-primary text-primary-foreground hover:opacity-90 transition-opacity flex-shrink-0"
        >
          搜索
        </Button>
      </div>
    </form>
  );
};

export default SearchBar;
