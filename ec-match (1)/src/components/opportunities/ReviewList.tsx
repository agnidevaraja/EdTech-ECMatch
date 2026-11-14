import { useMemo, useState } from 'react';
import { Review, REVIEW_METRICS } from '../../types';
import { Star, ArrowUpDown, Filter, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ReviewListProps {
  reviews: Review[];
  viewerUid: string | null;
}

type SortBy = 'newest' | 'oldest' | 'rating-high' | 'rating-low';
type StarFilter = 'all' | 1 | 2 | 3 | 4 | 5;

const STAR_OPTIONS: StarFilter[] = ['all', 5, 4, 3, 2, 1];

function renderStars(rating: number) {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    if (rating >= i) stars.push(<Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />);
    else if (rating > i - 1 && rating < i) stars.push(<Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />);
    else stars.push(<Star key={i} className="w-3 h-3 text-slate-300" />);
  }
  return stars;
}

export function ReviewList({ reviews, viewerUid }: ReviewListProps) {
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [starFilter, setStarFilter] = useState<StarFilter>('all');

  const filteredAndSorted = useMemo(() => {
    let list = [...reviews];
    if (starFilter !== 'all') {
      list = list.filter((r) => r.rating === starFilter);
    }
    list.sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortBy === 'rating-high') return b.rating - a.rating || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === 'rating-low') return a.rating - b.rating || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return 0;
    });
    return list;
  }, [reviews, sortBy, starFilter]);

  if (filteredAndSorted.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground text-sm">
        No reviews matching your filters. Be the first to share your experience!
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select
            value={starFilter === 'all' ? 'All stars' : String(starFilter)}
            onValueChange={(v) => setStarFilter(v === 'All stars' ? 'all' : Number(v) as StarFilter)}
          >
            <SelectTrigger className="w-24">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              {STAR_OPTIONS.map((s) => (
                <SelectItem key={s} value={s === 'all' ? 'All stars' : String(s)}>
                  {s === 'all' ? 'All stars' : `${s} star${s > 1 ? 's' : ''}& up`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
              <SelectItem value="rating-high">Highest rated</SelectItem>
              <SelectItem value="rating-low">Lowest rated</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => { setSortBy('newest'); setStarFilter('all'); }}>
            <Clock className="w-3 h-3 mr-1" /> Reset
          </Button>
        </div>
      </div>

      {/* Reviews */}
      <div className="space-y-4">
        {filteredAndSorted.map((review) => {
          const isOwner = review.userId === viewerUid;
          return (
            <div key={review.id} className="p-4 bg-card border border-border rounded-xl">
              <div className="flex justify-between items-start gap-2 mb-1">
                <span className="text-sm font-medium text-foreground">{review.userName}</span>
                <span className="text-xs text-muted-foreground">{review.yearParticipated}</span>
              </div>
              <div className="flex items-baseline gap-1 mb-1">
                {renderStars(review.rating)}
                <span className="text-xs text-muted-foreground ml-1">{review.title}</span>
              </div>
              {review.body && (
                <p className="text-sm text-muted-foreground leading-relaxed mb-3">{review.body}</p>
              )}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{new Date(review.createdAt).toLocaleDateString()}</span>
                {isOwner && (
                  <span className="text-primary font-medium">· Your review</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
