"use client";

import React, { memo, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";

export type Recommendation = {
  id: string;
  provision: string;
  text: string;
  tone: "info" | "warn" | "danger";
  tag?: string;
};

const TONE_BAR: Record<Recommendation["tone"], string> = {
  info: "bg-chart-3",
  warn: "bg-chart-2",
  danger: "bg-destructive",
};

const TONE_PILL: Record<Recommendation["tone"], "info" | "warning" | "destructive"> = {
  info: "info",
  warn: "warning",
  danger: "destructive",
};

function useRecommendationContent(text: string) {
  return useMemo(() => {
    const [heading, ...bodyParts] = text.split(":");
    if (bodyParts.length === 0) return { heading: "", body: heading };
    return { heading, body: bodyParts.join(":").trim() };
  }, [text]);
}

interface RecommendationItemProps {
  recommendation: Recommendation;
}

const RecommendationItem = memo(({ recommendation }: RecommendationItemProps) => {
  const { provision, text, tone, tag } = recommendation;
  const { heading, body } = useRecommendationContent(text);

  return (
    <Card className="relative flex flex-col justify-between gap-0 p-3">
      <CardContent className="!p-0">
        <div className="relative mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className={cn("h-3.5 w-1 rounded-full", TONE_BAR[tone])} />
            <span className="ps-0.5 text-left text-sm font-semibold text-foreground line-clamp-2">
              {provision}
            </span>
          </div>
          {tag && <Pill color={TONE_PILL[tone]}>{tag}</Pill>}
        </div>
        <p className="overflow-hidden text-xs leading-relaxed text-muted-foreground line-clamp-3">
          {heading && <span className="font-semibold text-foreground">{heading}: </span>}
          <span className="font-normal">{body}</span>
        </p>
      </CardContent>
    </Card>
  );
});

RecommendationItem.displayName = "RecommendationItem";
export { RecommendationItem };
