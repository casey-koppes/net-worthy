"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";

interface AssetNameInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  id?: string;
}

export function AssetNameInput({
  value,
  onChange,
  placeholder = "Enter name",
  required = false,
  id = "name",
}: AssetNameInputProps) {
  const { dbUserId } = useAuthStore();
  const [existingNames, setExistingNames] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isChipSelected, setIsChipSelected] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch existing asset names on mount
  useEffect(() => {
    async function fetchExistingNames() {
      if (!dbUserId) return;

      try {
        const res = await fetch(`/api/portfolio/manual-assets?userId=${dbUserId}`);
        if (res.ok) {
          const data = await res.json();
          const names = (data.assets || [])
            .map((asset: { name: string }) => asset.name)
            .filter((name: string, index: number, self: string[]) =>
              self.indexOf(name) === index // Remove duplicates
            );
          setExistingNames(names);
        }
      } catch (error) {
        console.error("Failed to fetch existing names:", error);
      }
    }

    fetchExistingNames();
  }, [dbUserId]);

  // Sync external value changes
  useEffect(() => {
    if (value !== inputValue && !isChipSelected) {
      setInputValue(value);
    }
  }, [value]);

  // Handle clicks outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter suggestions based on input
  const filteredSuggestions = existingNames.filter(
    (name) =>
      name.toLowerCase().includes(inputValue.toLowerCase()) &&
      name.toLowerCase() !== inputValue.toLowerCase()
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setIsChipSelected(false);
    onChange(newValue);
    setShowDropdown(true);
  };

  const handleFocus = () => {
    if (!isChipSelected) {
      setShowDropdown(true);
    }
  };

  const handleSelectSuggestion = (name: string) => {
    setInputValue(name);
    setIsChipSelected(true);
    onChange(name);
    setShowDropdown(false);
  };

  const handleRemoveChip = () => {
    setInputValue("");
    setIsChipSelected(false);
    onChange("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  // Render chip if selected from dropdown
  if (isChipSelected && inputValue) {
    return (
      <div className="flex items-center gap-2">
        <div className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-100 text-blue-800 text-sm font-medium">
          {inputValue}
          <button
            type="button"
            onClick={handleRemoveChip}
            className="ml-1 hover:bg-blue-200 rounded-full p-0.5 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <Input
        ref={inputRef}
        id={id}
        placeholder={placeholder}
        value={inputValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        required={required}
        autoComplete="off"
      />

      {/* Dropdown */}
      {showDropdown && filteredSuggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-auto">
          <div className="py-1">
            <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
              Existing assets
            </div>
            {filteredSuggestions.map((name) => (
              <button
                key={name}
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                onClick={() => handleSelectSuggestion(name)}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Show all suggestions when input is empty and focused */}
      {showDropdown && !inputValue && existingNames.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-auto">
          <div className="py-1">
            <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
              Existing assets
            </div>
            {existingNames.map((name) => (
              <button
                key={name}
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                onClick={() => handleSelectSuggestion(name)}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
