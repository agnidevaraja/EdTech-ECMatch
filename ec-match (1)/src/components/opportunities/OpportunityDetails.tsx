import { useState, useEffect, useCallback } from 'react';
import { Opportunity, Review } from '../../types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  X, 
  ExternalLink, 
  Calendar, 
  MapPin, 
  DollarSign, 
  Zap, 
  CheckCircle2, 
  Info,
  ArrowRight,
} from 'lucide-react';
import { motion } from 'motion/react';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { RatingSummary } from './RatingSummary';
import { ReviewList } from './ReviewList';
import { ReviewModal } from './ReviewModal';
import { subscribeReviews, getMyReview } from '../../services/reviewService';

interface OpportunityDetailsProps {
  opportunity: Opportunity;
  onClose: () => void;
}

export function OpportunityDetails({ opportunity, onClose }: OpportunityDetailsProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [myReview, setMyReview] = useState<Review | null>(null);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [aggregates, setAggregates] = useState({
    overallRating: opportunity.overallRating ?? 0,
    reviewCount: opportunity.reviewCount ?? 0,
    ratingBreakdown: opportunity.ratingBreakdown ?? { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
    averages: {
      overallExperience: opportunity.avgOverallExperience ?? 0,
      competitivenessPrestige: opportunity.avgCompetitivenessPrestige ?? 0,
      timeCommitment: opportunity.avgTimeCommitment ?? 0,
      mentorshipSupport: opportunity.avgMentorshipSupport ?? 0,
      collegeAppImpact: opportunity.avgCollegeAppImpact ?? 0,
    },
  });

  useEffect(() => {
    setAggregates((prev) => ({
      ...prev,
      overallRating: opportunity.overallRating ?? prev.overallRating,
      reviewCount: opportunity.reviewCount ?? prev.reviewCount,
      ratingBreakdown: opportunity.ratingBreakdown ?? prev.ratingBreakdown,
      averages: {
        overallExperience: opportunity.avgOverallExperience ?? prev.averages.overallExperience,
        competitivenessPrestige: opportunity.avgCompetitivenessPrestige ?? prev.averages.competitivenessPrestige,
        timeCommitment: opportunity.avgTimeCommitment ?? prev.averages.timeCommitment,
        mentorshipSupport: opportunity.avgMentorshipSupport ?? prev.averages.mentorshipSupport,
        collegeAppImpact: opportunity.avgCollegeAppImpact ?? prev.averages.collegeAppImpact,
      },
    }));
  }, [opportunity]);

  useEffect(() => {
    const unsubscribeParent = onSnapshot(doc(db, 'extracurriculars', opportunity.id), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setAggregates({
          overallRating: data.overallRating ?? 0,
          reviewCount: data.reviewCount ?? 0,
          ratingBreakdown: data.ratingBreakdown ?? { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
          averages: {
            overallExperience: data.avgOverallExperience ?? 0,
            competitivenessPrestige: data.avgCompetitivenessPrestige ?? 0,
            timeCommitment: data.avgTimeCommitment ?? 0,
            mentorshipSupport: data.avgMentorshipSupport ?? 0,
            collegeAppImpact: data.avgCollegeAppImpact ?? 0,
          },
        });
      }
    });

    const unsubscribeReviews = subscribeReviews(opportunity.id, (list) => {
      setReviews(list);
      setReviewsLoading(false);
    });

    const loadMyReview = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const currentUser = (auth as any).currentUser;
        if (currentUser) {
          const my = await getMyReview(opportunity.id, currentUser.uid);
          setMyReview(my);
        }
      } catch (e) {
        console.warn('Could not load my review:', e);
      }
    };
    loadMyReview();

    return () => {
      unsubscribeParent();
      unsubscribeReviews();
    };
  }, [opportunity.id]);

  const handleReviewSaved = useCallback(() => {
    setModalOpen(false);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="bg-card border border-border w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-[40px] shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="relative h-48 bg-slate-900 dark:bg-slate-800 p-8 flex flex-col justify-end">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose}
            className="absolute top-4 right-4 text-white/50 hover:text-white hover:bg-white/10 rounded-full"
          >
            <X className="w-5 h-5" />
          </Button>
          <div className="space-y-2">
            <div className="flex gap-2">
              <Badge className="bg-white/10 text-white border-none backdrop-blur-md">
                {opportunity.type}
              </Badge>
              <Badge className="bg-white/10 text-white border-none backdrop-blur-md">
                {opportunity.subject}
              </Badge>
            </div>
            <h2 className="text-3xl font-serif font-medium text-white">{opportunity.title}</h2>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="p-4 bg-muted rounded-3xl space-y-1">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Format</p>
              <div className="flex items-center gap-2 font-medium text-foreground">
                <MapPin className="w-4 h-4 text-primary" />
                {opportunity.format}
              </div>
            </div>
            <div className="p-4 bg-muted rounded-3xl space-y-1">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Cost</p>
              <div className="flex items-center gap-2 font-medium text-foreground">
                <DollarSign className="w-4 h-4 text-primary" />
                {opportunity.cost}
              </div>
            </div>
            <div className="p-4 bg-muted rounded-3xl space-y-1">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Effort</p>
              <div className="flex items-center gap-2 font-medium text-foreground">
                <Zap className="w-4 h-4 text-primary" />
                {opportunity.effortLevel}
              </div>
            </div>
            <div className="p-4 bg-muted rounded-3xl space-y-1">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Age Group</p>
              <div className="flex items-center gap-2 font-medium text-foreground">
                <Info className="w-4 h-4 text-primary" />
                {opportunity.ageGroup}
              </div>
            </div>
            <div className="p-4 bg-muted rounded-3xl space-y-1">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Deadline</p>
              <div className="flex items-center gap-2 font-medium text-foreground">
                <Calendar className="w-4 h-4 text-primary" />
                {opportunity.deadline}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-serif font-medium flex items-center gap-2">
              <Info className="w-5 h-5 text-primary" />
              Why this matches you
            </h3>
            <p className="text-muted-foreground leading-relaxed italic">
              "{opportunity.rationale}"
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-serif font-medium">Description</h3>
            <p className="text-muted-foreground leading-relaxed">
              {opportunity.description || "This opportunity provides a unique platform for growth and development in your field of interest. It is highly regarded for its rigorous curriculum and networking potential."}
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-serif font-medium">Required Materials</h3>
            <div className="flex flex-wrap gap-2">
              {opportunity.materials.map((m, i) => (
                <Badge key={i} variant="outline" className="rounded-full px-4 py-1 border-border/50">
                  <CheckCircle2 className="w-3 h-3 mr-2 text-emerald-500" />
                  {m}
                </Badge>
              ))}
            </div>
          </div>
        </div>

          {/* Student reviews (Amazon-style) */}
          <div className="space-y-6">
            <RatingSummary
              overallRating={aggregates.overallRating}
              reviewCount={aggregates.reviewCount}
              ratingBreakdown={aggregates.ratingBreakdown}
              averages={aggregates.averages}
            />

            <div className="flex items-center justify-between">
              <h3 className="text-xl font-serif font-medium">
                Student Reviews ({aggregates.reviewCount})
              </h3>
              <ReviewModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                opportunityId={opportunity.id}
                opportunityTitle={opportunity.title}
                existingReview={myReview}
                onReviewSaved={handleReviewSaved}
              />
            </div>

            <ReviewList reviews={reviews} viewerUid={(auth as any).currentUser?.uid ?? null} />
          </div>

          <div className="p-8 border-t border-border bg-muted/30 flex flex-col sm:flex-row gap-4">
          <Button 
            className="flex-1 rounded-full h-12 bg-slate-900 dark:bg-slate-100 dark:text-slate-900 gap-2"
            onClick={() => window.open(opportunity.url, '_blank')}
          >
            Learn More about EC
            <ExternalLink className="w-4 h-4" />
          </Button>
          <Button 
            variant="outline"
            className="flex-1 rounded-full h-12 border-slate-200 dark:border-slate-800 gap-2"
            onClick={() => window.open(opportunity.url, '_blank')}
          >
            Go to Registration Portal
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
