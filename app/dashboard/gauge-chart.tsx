"use client";

import React from "react";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";

type GaugeChartSize = "default" | "medium";

interface GaugeChartProps {
  /** Score 0–100. */
  target: number;
  size?: GaugeChartSize;
  animationDuration?: number;
}

const COLOR_STOPS = (t: number, isDark: boolean) => {
  if (t >= 60) {
    return isDark
      ? [
          { stop: 0, color: [110, 231, 183] },
          { stop: 0.5, color: [52, 211, 153] },
          { stop: 1, color: [16, 185, 129] },
        ]
      : [
          { stop: 0, color: [110, 231, 183] },
          { stop: 0.5, color: [16, 185, 129] },
          { stop: 1, color: [4, 120, 87] },
        ];
  }
  if (t < 40) {
    return isDark
      ? [
          { stop: 0, color: [252, 165, 165] },
          { stop: 0.5, color: [248, 113, 113] },
          { stop: 1, color: [239, 68, 68] },
        ]
      : [
          { stop: 0, color: [252, 165, 165] },
          { stop: 0.5, color: [239, 68, 68] },
          { stop: 1, color: [153, 27, 27] },
        ];
  }
  return isDark
    ? [
        { stop: 0, color: [252, 211, 77] },
        { stop: 0.5, color: [251, 191, 36] },
        { stop: 1, color: [245, 158, 11] },
      ]
    : [
        { stop: 0, color: [252, 211, 77] },
        { stop: 0.5, color: [245, 158, 11] },
        { stop: 1, color: [180, 83, 9] },
      ];
};

export default function GaugeChart({
  target,
  size = "default",
  animationDuration = 1800,
}: GaugeChartProps) {
  const counter = useMotionValue(0);
  const [displayValue, setDisplayValue] = React.useState(0);
  const [isDark, setIsDark] = React.useState(false);

  React.useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  React.useEffect(() => {
    const controls = animate(counter, target, {
      duration: animationDuration / 1000,
      ease: "easeOut",
    });
    return controls.stop;
  }, [target, animationDuration, counter]);

  const roundedValue = useTransform(counter, (val) => Math.round(val));
  React.useEffect(() => {
    const unsubscribe = roundedValue.on("change", (v) => setDisplayValue(v));
    return () => unsubscribe();
  }, [roundedValue]);

  const sizeConfig = {
    default: {
      containerWidth: "w-52",
      containerHeight: "h-28",
      blockWidth: "w-[4px]",
      blockHeight: "h-[25px]",
      blockTransformOrigin: "50% 100px",
      textSize: "text-4xl",
      supTextSize: "text-lg",
      arcRadius: 90,
      arrowSize: 4,
    },
    medium: {
      containerWidth: "w-64",
      containerHeight: "h-36",
      blockWidth: "w-[5px]",
      blockHeight: "h-[30px]",
      blockTransformOrigin: "50% 120px",
      textSize: "text-4xl",
      supTextSize: "text-xl",
      arcRadius: 90,
      arrowSize: 4,
    },
  } as const;

  const {
    containerWidth,
    containerHeight,
    blockWidth,
    blockHeight,
    blockTransformOrigin,
    textSize,
    supTextSize,
    arcRadius,
    arrowSize,
  } = sizeConfig[size];

  const blocks = Array.from({ length: 26 }, (_, i) => i);

  const interpolateMultiColor = (value: number): string => {
    const clamp = (v: number) => Math.max(0, Math.min(1, v));
    value = clamp(value);
    const stops = COLOR_STOPS(target, isDark);

    const findStops = () => {
      for (let i = 1; i < stops.length; i++) {
        if (value <= stops[i].stop) return [stops[i - 1], stops[i]];
      }
      return [stops[stops.length - 2], stops[stops.length - 1]];
    };

    const [start, end] = findStops();
    const localT = (value - start.stop) / (end.stop - start.stop);
    const [r1, g1, b1] = start.color;
    const [r2, g2, b2] = end.color;
    const r = Math.round(r1 + localT * (r2 - r1));
    const g = Math.round(g1 + localT * (g2 - g1));
    const b = Math.round(b1 + localT * (b2 - b1));
    return `rgb(${r}, ${g}, ${b})`;
  };

  const arrowFillColor = useTransform(counter, (val) =>
    interpolateMultiColor(Math.min(Math.max(val / 100, 0), 1))
  );

  const createArcPath = (radius: number) => {
    const startRad = (180 * Math.PI) / 180;
    const endRad = 0;
    const x1 = radius * Math.cos(startRad);
    const y1 = -radius * Math.sin(startRad);
    const x2 = radius * Math.cos(endRad);
    const y2 = -radius * Math.sin(endRad);
    return `M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2}`;
  };

  const arrowAngleDeg = useTransform(counter, (val) => 180 - ((val - 1) / 100) * 180);
  const arrowX = useTransform(arrowAngleDeg, (deg) => arcRadius * Math.cos((deg * Math.PI) / 180));
  const arrowY = useTransform(arrowAngleDeg, (deg) => -arcRadius * Math.sin((deg * Math.PI) / 180));

  return (
    <div
      className={[
        "relative",
        containerWidth,
        containerHeight,
        "overflow-visible",
        "[--gauge-empty:var(--muted)]",
        "[--gauge-arc:rgba(0,0,0,0.07)]",
        "dark:[--gauge-arc:rgba(255,255,255,0.08)]",
      ].join(" ")}
    >
      {blocks.map((i) => {
        const blockAngle = 7.2 * i - 90;
        const colorFactor = i / blocks.length;
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const bg = useTransform(counter, (val) => {
          const filled = Math.floor((val / 100) * blocks.length);
          return i < filled ? interpolateMultiColor(colorFactor) : "var(--gauge-empty)";
        });
        return (
          <motion.div
            key={i}
            className={["absolute", blockWidth, blockHeight, "left-1/2", "rounded-sm"].join(" ")}
            style={{
              backgroundColor: bg,
              transform: `rotate(${blockAngle}deg)`,
              transformOrigin: blockTransformOrigin,
            }}
          />
        );
      })}

      <div className="absolute left-1/2 top-1/2 mt-1 -translate-x-1/2 text-center">
        <div className="flex items-end justify-center leading-none tabular-nums text-foreground">
          <motion.span className={`${textSize} font-semibold leading-none`}>{displayValue}</motion.span>
          <span className={`${supTextSize} ml-1 translate-y-[2px] font-light text-muted-foreground`}>%</span>
        </div>
      </div>

      <svg
        className="absolute right-1 top-9 size-full overflow-visible"
        viewBox={`-${arcRadius} -${arcRadius} ${arcRadius * 1.85} ${arcRadius * 1.85}`}
      >
        <path d={createArcPath(arcRadius)} fill="none" stroke="var(--gauge-arc)" strokeWidth="1" />
        <motion.g style={{ translateX: arrowX, translateY: arrowY }}>
          <motion.circle cx={0} cy={0} r={arrowSize} style={{ fill: arrowFillColor }} />
        </motion.g>
      </svg>
    </div>
  );
}
