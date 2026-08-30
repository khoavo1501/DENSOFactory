import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { GaugeChart } from "echarts/charts";
import { TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import clsx from "clsx";

echarts.use([GaugeChart, TooltipComponent, CanvasRenderer]);

interface GaugeProps {
  value: number;
  min?: number;
  max?: number;
  unit?: string;
  name?: string;
  height?: number;
  tablet?: boolean;
}

export function Gauge({
  value,
  min = 0,
  max = 100,
  unit = "",
  name = "",
  height = 200,
  tablet = false,
}: GaugeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    if (!chartRef.current) {
      chartRef.current = echarts.init(containerRef.current, undefined, {
        renderer: "canvas",
      });
    }

    const displayValue = tablet ? height * 0.8 : height;

    const option: echarts.EChartsCoreOption = {
      series: [
        {
          type: "gauge",
          min,
          max,
          startAngle: 210,
          endAngle: -30,
          radius: tablet ? "70%" : "85%",
          center: ["50%", "55%"],
          progress: { show: true, width: 10 },
          axisLine: { lineStyle: { width: 10 } },
          axisTick: { show: false },
          splitLine: { length: 8, lineStyle: { width: 2 } },
          axisLabel: { distance: 14, fontSize: 10 },
          pointer: { width: 4, length: "60%" },
          anchor: { show: true, size: 12 },
          detail: {
            valueAnimation: true,
            offsetCenter: [0, "70%"],
            fontSize: tablet ? 16 : 20,
            color: "inherit",
            formatter: (v: number) => `${Math.round(v * 10) / 10}${unit}`,
          },
          title: { show: false },
          data: [{ value, name }],
        },
      ],
    };

    chartRef.current.setOption(option);
    chartRef.current.resize({ width: containerRef.current.clientWidth, height: displayValue });

    const onResize = () => {
      if (chartRef.current && containerRef.current) {
        chartRef.current.resize({
          width: containerRef.current.clientWidth,
          height: displayValue,
        });
      }
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, [value, min, max, unit, name, height, tablet]);

  useEffect(() => {
    return () => {
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  return (
    <div className={clsx("gauge-wrap", tablet && "tablet")}>
      <div ref={containerRef} style={{ width: "100%", height }} />
      {name && <div className="gauge-label">{name}</div>}
    </div>
  );
}
