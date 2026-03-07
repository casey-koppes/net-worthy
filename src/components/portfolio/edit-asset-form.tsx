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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";
import { AssetNameInput } from "./asset-name-input";
import { useAuthStore } from "@/lib/stores/auth-store";
import { toast } from "sonner";

export interface EditableAsset {
  id: string;
  name: string;
  description: string | null;
  value: number;
  category: string;
  isAsset: boolean;
  createdAt?: string;
  metadata?: {
    action?: string;
    investmentType?: string;
    ticker?: string;
    shares?: number;
    pricePerShare?: number;
  } | null;
}

interface EditAssetFormProps {
  asset: EditableAsset;
  onSuccess?: () => void;
  onCancel?: () => void;
}

// Category options based on asset type
const ASSET_CATEGORIES = [
  { value: "bank", label: "Bank Account" },
  { value: "investment", label: "Investment" },
  { value: "vehicle", label: "Vehicle" },
  { value: "motorcycle", label: "Motorcycle" },
  { value: "real_estate", label: "Real Estate" },
  { value: "other", label: "Other" },
];

const LIABILITY_CATEGORIES = [
  { value: "mortgage", label: "Mortgage" },
  { value: "loan", label: "Loan" },
  { value: "credit_card", label: "Credit Card" },
  { value: "other", label: "Other" },
];

export function EditAssetForm({ asset, onSuccess, onCancel }: EditAssetFormProps) {
  const { dbUserId } = useAuthStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Format date for input (YYYY-MM-DD)
  const formatDateForInput = (dateStr?: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toISOString().split("T")[0];
  };

  const [formData, setFormData] = useState({
    name: asset.name,
    value: asset.value.toString(),
    description: asset.description || "",
    category: asset.category,
    action: asset.metadata?.action || "buy",
    shares: asset.metadata?.shares?.toString() || "",
    activityDate: formatDateForInput(asset.createdAt),
  });

  const categories = asset.isAsset ? ASSET_CATEGORIES : LIABILITY_CATEGORIES;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!dbUserId) {
      toast.error("Please login first");
      return;
    }

    if (!formData.name || !formData.value) {
      toast.error("Name and value are required");
      return;
    }

    const value = parseFloat(formData.value);
    if (isNaN(value) || value < 0) {
      toast.error("Please enter a valid value");
      return;
    }

    setIsSubmitting(true);

    try {
      // Build updated metadata for investments
      const updatedMetadata = formData.category === "investment"
        ? {
            ...asset.metadata,
            action: formData.action,
            shares: formData.shares ? parseFloat(formData.shares) : null,
          }
        : asset.metadata;

      const res = await fetch("/api/portfolio/manual-assets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId: asset.id,
          userId: dbUserId,
          name: formData.name,
          value: value,
          description: formData.description || null,
          category: formData.category,
          metadata: updatedMetadata,
          createdAt: formData.activityDate ? new Date(formData.activityDate).toISOString() : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update");
      }

      toast.success("Updated successfully!");
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!dbUserId) {
      toast.error("Please login first");
      return;
    }

    setIsDeleting(true);

    try {
      const res = await fetch(`/api/portfolio/manual-assets?assetId=${asset.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }

      toast.success("Deleted successfully!");
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="category">Category</Label>
        <Select
          value={formData.category}
          onValueChange={(value) => setFormData({ ...formData, category: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {formData.category === "investment" && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="action">Action</Label>
              <Select
                value={formData.action}
                onValueChange={(value) => setFormData({ ...formData, action: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="buy">Buy</SelectItem>
                  <SelectItem value="sell">Sell</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="shares">Shares</Label>
              <Input
                id="shares"
                type="number"
                step="0.0001"
                min="0"
                placeholder="0"
                value={formData.shares}
                onChange={(e) => setFormData({ ...formData, shares: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="activityDate">Activity Date</Label>
            <Input
              id="activityDate"
              type="date"
              value={formData.activityDate}
              onChange={(e) => setFormData({ ...formData, activityDate: e.target.value })}
            />
          </div>
        </>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Name *</Label>
        <AssetNameInput
          id="name"
          placeholder="Enter name"
          value={formData.name}
          onChange={(value) => setFormData({ ...formData, name: value })}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="value">Value ($) *</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            $
          </span>
          <Input
            id="value"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            className="pl-7"
            value={formData.value}
            onChange={(e) => setFormData({ ...formData, value: e.target.value })}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <textarea
          id="description"
          placeholder="Additional notes"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={2}
          className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      <div className="pt-2">
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <div className="border-t pt-4 mt-4 flex justify-end">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="text-destructive border-destructive hover:bg-destructive/10"
              disabled={isDeleting}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete &quot;{asset.name}&quot; from your portfolio.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </form>
  );
}
