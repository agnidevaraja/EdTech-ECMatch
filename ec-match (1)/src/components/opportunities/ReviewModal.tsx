import { useState, useEffect } from 'react';
import { X, Star, Edit, Trash2, CheckCircle2, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { auth } from '@/lib/firebase';
import { getMyReview, submitReview, deleteReview } from '@/services/reviewService';
import { Review, REVIEW_METRICS, REVIEW_METRIC_LABELS } from '@/types';

interface ReviewModalProps {
  open: boolean;
  onClose: () => void;
  opportunityId: string;
  opportunityTitle: string;
  existingReview: Review | null;
  onReviewSaved: () => void;
}

const INITIAL_METRICS: Record<string, number> = {
  overallExperience: 3,
  competitivenessPrestige: 3,
  timeCommitment: 3,
  mentorshipSupport: 3,
  collegeAppImpact: 3,
};

function StarRating({ value, onChange, className = '' }: { value: number; onChange: (v: number) => void; className?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const display = hover ?? value;
  return (
    <div
      className={`flex items-center gap-1 ${className}`}
      onMouseLeave={() => setHover(null)}
      role="radiogroup"
      aria-label="Rating"
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHover(star)}
          aria-label={`${star} stars`}
          className="p-1"
        >
          <Star
            className={`w-5 h-5 ${
              display >= star ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300'
            }`}
          />
        </button>
      ))}
    </div>
  );
}

export function ReviewModal({ open, onClose, opportunityId, opportunityTitle, existingReview, onReviewSaved }: ReviewModalProps) {
  const user = auth.currentUser;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState({
    rating: existingReview?.rating ?? 3,
    metrics: { ...INITIAL_METRICS, ...existingReview?.metrics },
    title: existingReview?.title ?? '',
    body: existingReview?.body ?? '',
    yearParticipated: existingReview?.yearParticipated ?? new Date().getFullYear().toString(),
  });

  useEffect(() => {
    if (existingReview) {
      setForm({
        rating: existingReview.rating,
        metrics: { ...existingReview.metrics },
        title: existingReview.title,
        body: existingReview.body,
        yearParticipated: existingReview.yearParticipated,
      });
    }
  }, [existingReview]);
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);
    try {
      await submitReview(opportunityId, user, {
        rating: form.rating,
        metrics: form.metrics as never,
        title: form.title,
        body: form.body,
        yearParticipated: form.yearParticipated,
      });
      onReviewSaved();
      onClose();
    } catch (err) {
      console.error('Failed to save review:', err);
      alert('Failed to save your review. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !existingReview) return;
    if (!window.confirm('Delete your review? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await deleteReview(opportunityId, user.uid);
      onReviewSaved();
      onClose();
    } catch (err) {
      console.error('Failed to delete review:', err);
      alert('Failed to delete your review.');
    } finally {
      setDeleting(false);
    }
  };

  const canEdit = Boolean(user && (!existingReview || existingReview.userId === user.uid));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogTrigger>
        <Button variant="outline" size="sm" disabled={!canEdit}>
          {existingReview && existingReview.userId === user?.uid ? 'Edit Your Review' : 'Write a Review'}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[520px]">
        <DialogClose>
          <X className="w-5 h-5" />
        </DialogClose>
        <DialogHeader>
          <DialogTitle>
            {existingReview && existingReview.userId === user?.uid ? 'Edit Your Review' : 'Share Your Review'}
          </DialogTitle>
          <DialogDescription>{opportunityTitle}</DialogDescription>
        </DialogHeader>

        {!user ? (
          <div className="p-6 text-center text-muted-foreground text-sm">
            Please sign in to submit a review.
          </div>
        ) : (
          <form onSubmit={handleSave} className="p-6 space-y-5">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Overall rating</Label>
              <StarRating value={form.rating} onChange={(v) => setForm({ ...form, rating: v })} />
              <span className="text-xs text-muted-foreground ml-1">
                {form.rating} star{form.rating !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Student experience</Label>
              <div className="grid grid-cols-2 gap-3">
                {REVIEW_METRICS.map((metric) => (
                  <div key={metric} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{REVIEW_METRIC_LABELS[metric]}</Label>
                    <StarRating
                      value={form.metrics[metric] ?? 3}
                      onChange={(v) => setForm({ ...form, metrics: { ...form.metrics, [metric]: v } })}
                      className="justify-start"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Life-changing research experience"
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Your review</Label>
              <Textarea
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder="What did you learn? Would you recommend it?"
                rows={4}
                maxLength={2000}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Year participated</Label>
              <Input
                value={form.yearParticipated}
                onChange={(e) => setForm({ ...form, yearParticipated: e.target.value })}
                placeholder="2026"
                maxLength={20}
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border">
              {existingReview && existingReview.userId === user.uid && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex items-center gap-1"
                >
                  {deleting ? (
                    <Loader2 className="w-4 h-4" />
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" /> Delete review
                    </>
                  )}
                </Button>
              )}
              <Button type="submit" disabled={isSubmitting} className="w-full md:w-auto">
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    {existingReview ? 'Save changes' : 'Submit review'}
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

