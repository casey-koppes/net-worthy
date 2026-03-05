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
import { useAuthStore } from "@/lib/stores/auth-store";
import { toast } from "sonner";

interface AddBankAccountFormProps {
  onSuccess?: () => void;
}

const ACCOUNT_TYPES = [
  { value: "checking", label: "Checking Account" },
  { value: "savings", label: "Savings Account" },
  { value: "money_market", label: "Money Market" },
  { value: "cd", label: "Certificate of Deposit (CD)" },
  { value: "other", label: "Other" },
];

export function AddBankAccountForm({ onSuccess }: AddBankAccountFormProps) {
  const { dbUserId } = useAuthStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    accountType: "",
    institutionName: "",
    balance: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!dbUserId) {
      toast.error("Please login first");
      return;
    }

    if (!formData.name || !formData.accountType || !formData.balance) {
      toast.error("Please fill in all required fields");
      return;
    }

    const balance = parseFloat(formData.balance);
    if (isNaN(balance) || balance < 0) {
      toast.error("Please enter a valid balance");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/portfolio/manual-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: dbUserId,
          category: "bank",
          name: formData.name,
          description: formData.institutionName
            ? `${formData.accountType} at ${formData.institutionName}`
            : formData.accountType,
          value: balance,
          isAsset: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add bank account");
      }

      toast.success("Bank account added successfully!");
      setFormData({
        name: "",
        accountType: "",
        institutionName: "",
        balance: "",
      });
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add bank account");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Account Name *</Label>
        <Input
          id="name"
          placeholder="e.g., Primary Checking"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="accountType">Account Type *</Label>
        <Select
          value={formData.accountType}
          onValueChange={(value) => setFormData({ ...formData, accountType: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select account type" />
          </SelectTrigger>
          <SelectContent>
            {ACCOUNT_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="institutionName">Bank/Institution Name</Label>
        <Input
          id="institutionName"
          placeholder="e.g., Chase, Bank of America"
          value={formData.institutionName}
          onChange={(e) => setFormData({ ...formData, institutionName: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="balance">Current Balance *</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            $
          </span>
          <Input
            id="balance"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            className="pl-7"
            value={formData.balance}
            onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
            required
          />
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Adding..." : "Add Bank Account"}
      </Button>
    </form>
  );
}
