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
import { toast } from "sonner";

interface AddAssetFormProps {
  onSuccess?: () => void;
}

const ASSET_CATEGORIES = [
  { value: "vehicle", label: "Vehicle" },
  { value: "motorcycle", label: "Motorcycle" },
  { value: "real_estate", label: "Real Estate" },
  { value: "gold", label: "Gold" },
  { value: "other", label: "Other" },
];

export function AddAssetForm({ onSuccess }: AddAssetFormProps) {
  const { dbUserId } = useAuthStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    category: "",
    name: "",
    currentValue: "",
    description: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!dbUserId) {
      toast.error("Please login first");
      return;
    }

    if (!formData.name || !formData.category || !formData.currentValue) {
      toast.error("Please fill in all required fields");
      return;
    }

    const value = parseFloat(formData.currentValue);
    if (isNaN(value) || value < 0) {
      toast.error("Please enter a valid value");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/portfolio/manual-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: dbUserId,
          category: formData.category,
          name: formData.name,
          description: formData.description || null,
          value: value,
          isAsset: true, // Always an asset
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add asset");
      }

      toast.success("Asset added successfully!");
      setFormData({
        category: "",
        name: "",
        currentValue: "",
        description: "",
      });
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add asset");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="category">Category *</Label>
        <Select
          value={formData.category}
          onValueChange={(value) => setFormData({ ...formData, category: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {ASSET_CATEGORIES.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Name *</Label>
        {formData.category === "other" ? (
          <Input
            id="name"
            placeholder="e.g., Jewelry, Art Collection, Collectibles"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        ) : (
          <AssetNameInput
            id="name"
            placeholder="e.g., 2022 Toyota Camry, Beach House"
            value={formData.name}
            onChange={(value) => setFormData({ ...formData, name: value })}
            required
          />
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="currentValue">Current Value ($) *</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            $
          </span>
          <Input
            id="currentValue"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            className="pl-7"
            value={formData.currentValue}
            onChange={(e) => setFormData({ ...formData, currentValue: e.target.value })}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <textarea
          id="description"
          placeholder="Additional notes about this asset"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={2}
          className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Adding..." : "Add Asset"}
      </Button>
    </form>
  );
}
