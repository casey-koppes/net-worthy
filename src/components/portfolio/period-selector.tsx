"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "lucide-react";
import {
  PERIOD_BUTTON_OPTIONS,
  type PeriodPreset,
  formatDateForApi,
} from "@/lib/utils/period-utils";

interface PeriodSelectorProps {
  value: PeriodPreset;
  onChange: (preset: PeriodPreset) => void;
  onCustomDateChange?: (startDate: Date, endDate: Date) => void;
  className?: string;
}

/**
 * Period selector with button group style
 * Shows preset periods and custom date range option
 */
export function PeriodSelector({
  value,
  onChange,
  onCustomDateChange,
  className,
}: PeriodSelectorProps) {
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const pickerRef = useRef<HTMLDivElement>(null);

  // Set default dates when opening custom picker
  useEffect(() => {
    if (showCustomPicker && !customEndDate) {
      const today = new Date();
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      setCustomEndDate(formatDateForApi(today));
      setCustomStartDate(formatDateForApi(thirtyDaysAgo));
    }
  }, [showCustomPicker, customEndDate]);

  // Handle clicks outside to close picker
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowCustomPicker(false);
      }
    }

    if (showCustomPicker) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showCustomPicker]);

  const handlePresetClick = (preset: PeriodPreset) => {
    setShowCustomPicker(false);
    onChange(preset);
  };

  const handleCustomClick = () => {
    setShowCustomPicker(!showCustomPicker);
  };

  const handleApplyCustom = () => {
    if (customStartDate && customEndDate && onCustomDateChange) {
      const start = new Date(customStartDate);
      const end = new Date(customEndDate);

      // Validate dates
      if (start > end) {
        return; // Don't apply if start is after end
      }

      onCustomDateChange(start, end);
      onChange("custom");
      setShowCustomPicker(false);
    }
  };

  // Calculate the number of days in the custom period
  const getCustomDays = (): number | null => {
    if (!customStartDate || !customEndDate) return null;
    const start = new Date(customStartDate);
    const end = new Date(customEndDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const customDays = getCustomDays();

  return (
    <div className={`relative ${className ?? ""}`}>
      <div className="flex flex-wrap gap-1.5">
        {PERIOD_BUTTON_OPTIONS.map((option) => (
          <Button
            key={option.value}
            variant={value === option.value ? "default" : "outline"}
            size="sm"
            onClick={() => handlePresetClick(option.value)}
            className="h-7 px-2 text-xs"
          >
            {option.label}
          </Button>
        ))}
        <Button
          variant={value === "custom" ? "default" : "outline"}
          size="sm"
          onClick={handleCustomClick}
          className="h-7 px-2 text-xs"
        >
          <Calendar className="h-3 w-3" />
        </Button>
      </div>

      {/* Custom Date Picker Dropdown */}
      {showCustomPicker && (
        <div
          ref={pickerRef}
          className="absolute right-0 top-full mt-2 z-50 bg-background border rounded-lg shadow-lg p-4 w-72"
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="startDate" className="text-xs">
                Start Date
              </Label>
              <Input
                id="startDate"
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                max={customEndDate || undefined}
                className="h-8 text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate" className="text-xs">
                End Date
              </Label>
              <Input
                id="endDate"
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                min={customStartDate || undefined}
                max={formatDateForApi(new Date())}
                className="h-8 text-sm"
              />
            </div>

            {customDays !== null && (
              <p className="text-xs text-muted-foreground">
                Period: {customDays} day{customDays !== 1 ? "s" : ""}
                {customDays > 0 && (
                  <span className="block mt-1">
                    Comparing to prior {customDays} days
                  </span>
                )}
              </p>
            )}

            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleApplyCustom}
                disabled={!customStartDate || !customEndDate}
                className="flex-1 h-8"
              >
                Apply
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowCustomPicker(false)}
                className="h-8"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
