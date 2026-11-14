import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import OpportunityCard from './OpportunityCard';
import { Button } from '@/components/ui/button';

// Import the CSV file directly as a raw string using Vite's ?raw suffix
import csvData from '../../Database.csv?raw';

export function OpportunityFeed() {
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(24);

  useEffect(() => {
    try {
      Papa.parse(csvData, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          setOpportunities(results.data);
          setLoading(false);
        },
      });
    } catch (err) {
      console.error("Failed to parse CSV:", err);
      setLoading(false);
    }
  }, []);

  if (loading) {
    return <div className="text-white p-8">Loading your 1,200 opportunities...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="text-sm text-muted-foreground px-2">
        Showing {Math.min(visibleCount, opportunities.length)} of {opportunities.length} opportunities
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {opportunities.slice(0, visibleCount).map((opp, index) => (
          <OpportunityCard key={index} opportunity={opp} />
        ))}
      </div>

      {visibleCount < opportunities.length && (
        <div className="flex justify-center pb-12">
          <Button 
            onClick={() => setVisibleCount(prev => prev + 24)}
            className="rounded-full px-8 py-6 text-base"
          >
            Load More Opportunities
          </Button>
        </div>
      )}
    </div>
  );
}