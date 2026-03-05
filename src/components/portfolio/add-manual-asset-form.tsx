"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AssetNameInput } from "./asset-name-input";
import { useAuthStore } from "@/lib/stores/auth-store";

const ASSET_CATEGORIES = [
  { value: "real_estate", label: "Real Estate" },
  { value: "vehicle", label: "Vehicle" },
  { value: "other", label: "Other Asset" },
];

const LIABILITY_CATEGORIES = [
  { value: "other", label: "Loan / Other Liability" },
];

interface AddManualAssetFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function AddManualAssetForm({
  onSuccess,
  onCancel,
}: AddManualAssetFormProps) {
  const [isAsset, setIsAsset] = useState(true);
  const [category, setCategory] = useState<string>("");
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { dbUserId } = useAuthStore();

  const categories = isAsset ? ASSET_CATEGORIES : LIABILITY_CATEGORIES;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !name || !value) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/portfolio/manual-assets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: dbUserId,
          category,
          name,
          value: parseFloat(value),
          description: description || undefined,
          isAsset,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to add item");
      }

      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add item");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Type</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={isAsset ? "default" : "outline"}
            onClick={() => {
              setIsAsset(true);
              setCategory("");
            }}
            className="flex-1"
          >
            Asset
          </Button>
          <Button
            type="button"
            variant={!isAsset ? "default" : "outline"}
            onClick={() => {
              setIsAsset(false);
              setCategory("");
            }}
            className="flex-1"
          >
            Liability
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">Category</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger>
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <AssetNameInput
          id="name"
          placeholder={
            isAsset ? "e.g., Primary Residence, Tesla Model 3" : "e.g., Car Loan"
          }
          value={name}
          onChange={setName}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="value">
          {isAsset ? "Current Value" : "Amount Owed"} (USD)
        </Label>
        <Input
          id="value"
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (Optional)</Label>
        <Input
          id="description"
          placeholder="Add any notes..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isLoading || !category || !name || !value}>
          {isLoading ? "Adding..." : `Add ${isAsset ? "Asset" : "Liability"}`}
        </Button>
      </div>
    </form>
  );
}
