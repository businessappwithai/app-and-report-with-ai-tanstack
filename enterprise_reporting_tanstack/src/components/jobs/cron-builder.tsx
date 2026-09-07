"use client";

import { HelpCircle, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface CronBuilderProps {
  value: string;
  onChange: (cron: string) => void;
}

export function CronBuilder({ value, onChange }: CronBuilderProps) {
  const [mode, setMode] = useState<"ui" | "manual">("ui");
  const [minute, setMinute] = useState("*");
  const [hour, setHour] = useState("*");
  const [dayOfMonth, setDayOfMonth] = useState("*");
  const [month, setMonth] = useState("*");
  const [dayOfWeek, setDayOfWeek] = useState("*");
  const [manualCron, setManualCron] = useState(value);

  const commonSchedules = [
    { label: "Every minute", cron: "* * * * *" },
    { label: "Every hour", cron: "0 * * * *" },
    { label: "Every day at midnight", cron: "0 0 * * *" },
    { label: "Every day at 6 AM", cron: "0 6 * * *" },
    { label: "Every week (Monday 9 AM)", cron: "0 9 * * 1" },
    { label: "Every month (1st at midnight)", cron: "0 0 1 * *" },
    { label: "Every 5 minutes", cron: "*/5 * * * *" },
    { label: "Every 30 minutes", cron: "*/30 * * * *" },
    { label: "Weekdays at 9 AM", cron: "0 9 * * 1-5" },
    { label: "Weekends at midnight", cron: "0 0 * * 6,0" },
  ];

  const getCronExpression = () => {
    if (mode === "manual") return manualCron;
    return `${minute} ${hour} ${dayOfMonth} ${month} ${dayOfWeek}`;
  };

  const updateCron = () => {
    onChange(getCronExpression());
  };

  const handlePresetClick = (cron: string) => {
    const parts = cron.split(" ");
    if (parts.length === 5) {
      setMinute(parts[0]);
      setHour(parts[1]);
      setDayOfMonth(parts[2]);
      setMonth(parts[3]);
      setDayOfWeek(parts[4]);
      setMode("ui");
      onChange(cron);
    }
  };

  const handleManualChange = (val: string) => {
    setManualCron(val);
    onChange(val);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Schedule</Label>
        <Tabs value={mode} onValueChange={(v) => setMode(v as "ui" | "manual")}>
          <TabsList>
            <TabsTrigger value="ui" className="text-xs">
              UI Builder
            </TabsTrigger>
            <TabsTrigger value="manual" className="text-xs">
              Manual Cron
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {mode === "manual" ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              value={manualCron}
              onChange={(e) => handleManualChange(e.target.value)}
              placeholder="* * * * *"
              className="font-mono"
            />
            <Button type="button" variant="outline" size="icon" onClick={updateCron} title="Apply">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-tremor-label text-tremor-content">
            Format: minute hour day month weekday (0-6, Sunday = 0)
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-5 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Minute</Label>
              <Input
                value={minute}
                onChange={(e) => setMinute(e.target.value)}
                onBlur={updateCron}
                placeholder="*"
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hour</Label>
              <Input
                value={hour}
                onChange={(e) => setHour(e.target.value)}
                onBlur={updateCron}
                placeholder="*"
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Day</Label>
              <Input
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(e.target.value)}
                onBlur={updateCron}
                placeholder="*"
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Month</Label>
              <Input
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                onBlur={updateCron}
                placeholder="*"
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Weekday</Label>
              <Input
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(e.target.value)}
                onBlur={updateCron}
                placeholder="*"
                className="font-mono text-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-mono font-medium">Current: {getCronExpression()}</span>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <div className="space-y-1 text-xs">
                    <p>
                      <strong>Minute:</strong> 0-59 or *
                    </p>
                    <p>
                      <strong>Hour:</strong> 0-23 or *
                    </p>
                    <p>
                      <strong>Day:</strong> 1-31 or *
                    </p>
                    <p>
                      <strong>Month:</strong> 1-12 or *
                    </p>
                    <p>
                      <strong>Weekday:</strong> 0-6 (0=Sunday) or *
                    </p>
                    <p className="mt-2">
                      <strong>Examples:</strong>
                    </p>
                    <p>*/5 = every 5</p>
                    <p>1-5 = 1 to 5</p>
                    <p>1,3,5 = 1, 3, and 5</p>
                  </div>
                </TooltipContent>
              </Tooltip>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Quick Select</Label>
            <div className="flex flex-wrap gap-2">
              {commonSchedules.map((schedule) => (
                <Badge
                  key={schedule.cron}
                  variant={getCronExpression() === schedule.cron ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => handlePresetClick(schedule.cron)}
                >
                  {schedule.label}
                </Badge>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
