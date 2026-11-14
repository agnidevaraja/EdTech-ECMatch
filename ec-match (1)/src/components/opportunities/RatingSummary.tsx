import { Star, StarHalf, Activity, BarChart3, TrendingUp, Clock, GraduationCap, ShieldCheck } from 'lucide-react';
import { RatingBreakdown, REVIEW_METRIC_LABELS, REVIEW_METRICS } from '../../types';

interface RatingSummaryProps {
  overallRating: number;
  reviewCount: number;
  ratingBreakdown: RatingBreakdown;
  averages: {
    overallExperience: number;
    competitivenessPrestige: number;
    timeCommitment: number;
    mentorshipSupport: number;
    collegeAppImpact: number;
  };
}

function renderStars(rating: number) {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    if (rating >= i) {
      stars.push(<Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />);
    } else if (rating > i - 1 && rating < i) {
      stars.push(<StarHalf key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />);
    } else {
      stars.push(<Star key={i} className="w-4 h-4 text-slate-300" />);
    }
  }
  return stars;
}

function pct(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

export function RatingSummary({ overallRating, reviewCount, ratingBreakdown, averages }: RatingSummaryProps) {
  const stars = renderStars(overallRating || 0);

  return (
    <div className="space-y-6">
      {/* Header: overall score + stars + count */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 border-b border-border pb-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold font-serif text-foreground">{overallRating || 0}</span>
            <span className="text-lg text-muted-foreground">/ 5</span>
          </div>
          <div className="flex items-center gap-1">
            {stars}
            <span className="ml-2 text-sm text-muted-foreground">
              {reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <Activity className="w-4 h-4 text-muted-foreground" />
          <span className="text-muted-foreground">
            {reviewCount === 0 ? 'No reviews yet' : `${reviewCount} student reviews`}
          </span>
        </div>
      </div>

      {reviewCount > 0 ? (
        <>
          {/* 5-star distribution bar chart */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <BarChart3 className="w-3 h-3" /> Star distribution
            </div>
            <div className="space-y-1">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = ratingBreakdown[star as keyof RatingBreakdown] ?? 0;
                const percentage = pct(count, reviewCount);
                return (
                  <div key={star} className="flex items-center gap-3">
                    <div className="w-8 text-right text-xs text-muted-foreground flex items-center gap-1">
                      <span className="text-xs fill-yellow-400 text-yellow-400">{star}</span>
                      <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                    </div>
                    <div className="flex-1 bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-yellow-400 h-full transition-all duration-500"
                        style={{ width: `${Math.max(percentage, 1)}%` }}
                      ></div>
                    </div>
                    <div className="w-16 text-right text-xs text-muted-foreground">
                      {percentage}% ({count})
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Individual metric progress bars */}
          <div className="pt-4 border-t border-border">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              <ShieldCheck className="w-3 h-3" /> Student metrics
            </div>
            <div className="space-y-3">
              {REVIEW_METRICS.map((metric) => {
                const value = averages[metric] ?? 0;
                const percentage = Math.round((value / 5) * 100);
                const label = REVIEW_METRIC_LABELS[metric];
                const Icon =
                  metric === 'overallExperience'
                    ? GraduationCap
                    : metric === 'competitivenessPrestige'
                      ? TrendingUp
                      : metric === 'timeCommitment'
                        ? Clock
                        : metric === 'mentorshipSupport'
                          ? ShieldCheck
                          : BarChart3;
                return (
                  <div key={metric} className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="text-foreground font-medium">{value.toFixed(1)} / 5</span>
                    </div>
                    <div className="bg-slate-200 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                      <div className="bg-primary h-full transition-all duration-500" style={{ width: `${percentage}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <div className="bg-muted/50 rounded-2xl p-6 text-center text-muted-foreground text-sm">
          Be the first to share your experience!
        </div>
      )}
    </div>
  );
}
