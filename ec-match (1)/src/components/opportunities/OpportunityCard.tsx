import { useState } from 'react';
import { Opportunity, UserOpportunity, UserRanking } from '../../types';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Calendar, MapPin, DollarSign, Zap, ExternalLink, Star, BookmarkPlus, Loader2 } from 'lucide-react';
import { auth, db } from '../../lib/firebase';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { OpportunityDetails } from './OpportunityDetails';
import { AnimatePresence } from 'motion/react';

interface OpportunityCardProps {
  opportunity: any; // Using any to cleanly support your CSV fields
  isFeatured?: boolean;
}

export default function OpportunityCard({ opportunity, isFeatured }: OpportunityCardProps) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(opportunity ? 'status' in opportunity : false);
  const [showDetails, setShowDetails] = useState(false);

  if (!opportunity) return null;

  // Map your exact CSV header fields
  const title = opportunity.Name || opportunity.title || 'Untitled Opportunity';
  const description = opportunity.Summary || opportunity.Details || opportunity.description || 'No description available.';
  const type = opportunity.Type || opportunity.type || 'General';
  const subject = opportunity.Subject || opportunity.subject || 'General';
  const deadline = opportunity.Deadline || opportunity.deadline || 'Flexible';
  const cost = opportunity.Price || opportunity.cost || 'Free';
  const effortLevel = opportunity.EffortLevel || 'Medium';
  const location = opportunity.Location || opportunity.State || 'Remote / All Ages';
  const url = opportunity.URL || opportunity.url;

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const user = auth.currentUser;
    if (!user || saved) return;

    setSaving(true);
    try {
      const userOpp: UserOpportunity = {
        ...opportunity,
        id: opportunity.id || Math.random().toString(),
        title,
        description,
        status: 'Saved',
        ranking: 'Medium',
        savedAt: new Date().toISOString(),
        hoursLogged: 0,
        impactSummary: ''
      };

      await setDoc(doc(db, 'users', user.uid, 'opportunities', userOpp.id), userOpp);
      setSaved(true);
    } catch (error) {
      console.error("Error saving opportunity:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card 
        className={`group relative overflow-hidden transition-all duration-500 cursor-pointer h-full border-none shadow-sm hover:shadow-md ${
          isFeatured 
            ? 'rounded-[40px] border-primary/20 shadow-2xl bg-primary/5' 
            : 'rounded-[32px] bg-card'
        }`}
        onClick={() => setShowDetails(true)}
      >
        <CardHeader className="p-6 pb-0 space-y-4">
          <div className="flex justify-between items-start">
            <div className="flex flex-wrap gap-2">
              {type && (
                <Badge variant="secondary" className="rounded-full bg-muted text-muted-foreground border-none px-3">
                  {type}
                </Badge>
              )}
              {subject && (
                <Badge variant="outline" className="rounded-full text-muted-foreground border-border px-3">
                  {subject}
                </Badge>
              )}
            </div>
          </div>
          <h3 className={`font-serif font-medium leading-tight group-hover:text-primary transition-colors text-foreground ${isFeatured ? 'text-2xl' : 'text-xl'}`}>
            {title}
          </h3>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          <div className="p-4 bg-muted/50 rounded-2xl border border-border/30 italic text-sm text-muted-foreground leading-relaxed line-clamp-3">
            "{description}"
          </div>

          <div className="grid grid-cols-2 gap-4 text-[11px] font-medium text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5" />
              {deadline}
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="w-3.5 h-3.5" />
              {cost}
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5" />
              {effortLevel} Effort
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5" />
              {location}
            </div>
          </div>
        </CardContent>

        <CardFooter className="p-6 pt-0 flex gap-3 border-t-0 bg-transparent">
          <Button 
            onClick={handleSave}
            disabled={saving || saved}
            className={`flex-1 rounded-full h-11 transition-all ${
              saved 
                ? 'bg-emerald-500 hover:bg-emerald-600 text-white' 
                : 'bg-foreground text-background hover:bg-foreground/90'
            }`}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : saved ? (
              <CheckCircle2 className="w-4 h-4 mr-2" />
            ) : (
              <BookmarkPlus className="w-4 h-4 mr-2" />
            )}
            {saved ? 'Saved' : 'Add to Dashboard'}
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            className="rounded-full w-11 h-11 border-border/50 text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              if (url) window.open(url, '_blank');
            }}
          >
            <ExternalLink className="w-4 h-4" />
          </Button>
        </CardFooter>
      </Card>

      <AnimatePresence>
        {showDetails && (
          <OpportunityDetails 
            opportunity={opportunity} 
            onClose={() => setShowDetails(false)} 
          />
        )}
      </AnimatePresence>
    </>
  );
}