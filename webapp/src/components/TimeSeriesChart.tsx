import { useEffect, useRef } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";

interface TimeSeriesChartProps {
  data: { ts: number; value: number }[];
  unit?: string;
  height?: number;
  title?: string;
  className?: string;
}

export function TimeSeriesChart({
  data,
  unit = "",
  height = 240,
  title,
  className,
}: TimeSeriesChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const plotRef = useRef<uPlot | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // uPlot data: [x_values..., y_values...]
    const xs = data.map((d) => d.ts);
    const ys = data.map((d) => d.value);
    const uplotData: uPlot.AlignedData = [xs, ys];

    if (data.length === 0) {
      if (plotRef.current) {
        plotRef.current.destroy();
        plotRef.current = null;
      }
      return;
    }

    const opts: uPlot.Options = {
      width: containerRef.current.clientWidth,
      height,
      title,
      scales: {
        x: { time: true },
        y: { auto: true },
      },
      axes: [
        {
          stroke: "currentColor",
          grid: { stroke: "rgba(128,128,128,0.15)" },
          ticks: { stroke: "rgba(128,128,128,0.3)" },
        },
        {
          stroke: "currentColor",
          grid: { stroke: "rgba(128,128,128,0.15)" },
          ticks: { stroke: "rgba(128,128,128,0.3)" },
          label: unit,
        },
      ],
      series: [
        {},
        {
          label: title ?? "value",
          stroke: "var(--accent, #3b82f6)",
          width: 1.5,
          fill: "rgba(59, 130, 246, 0.1)",
        },
      ],
      cursor: {
        drag: { x: true, y: false },
        points: { size: 6 },
      },
    };

    if (plotRef.current) {
      plotRef.current.setData(uplotData);
      plotRef.current.setSize({
        width: containerRef.current.clientWidth,
        height,
      });
    } else {
      plotRef.current = new uPlot(opts, uplotData, containerRef.current);
    }

    const onResize = () => {
      if (plotRef.current && containerRef.current) {
        plotRef.current.setSize({
          width: containerRef.current.clientWidth,
          height,
        });
      }
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, [data, height, title, unit]);

  useEffect(() => {
    return () => {
      if (plotRef.current) {
        plotRef.current.destroy();
        plotRef.current = null;
      }
    };
  }, []);

  if (data.length === 0) {
    return <div className="chart-empty">No data in selected range.</div>;
  }

  return <div ref={containerRef} className={className} style={{ minHeight: height }} />;
}
