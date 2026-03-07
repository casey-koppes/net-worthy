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
import { PlaidLinkButton } from "./plaid-link-button";
import { Zap } from "lucide-react";

interface AddBankAccountFormProps {
  onSuccess?: () => void;
  onConnectPlaid?: () => void;
}

const ACCOUNT_TYPES = [
  { value: "checking", label: "Checking Account" },
  { value: "savings", label: "Savings Account" },
  { value: "money_market", label: "Money Market" },
  { value: "cd", label: "Certificate of Deposit (CD)" },
  { value: "other", label: "Other" },
];

export function AddBankAccountForm({ onSuccess, onConnectPlaid }: AddBankAccountFormProps) {
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
    <div className="space-y-6">
      {/* Plaid Integration Section */}
      <div className="rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-4">
        <div className="flex flex-col items-center text-center space-y-3">
          {/* Plaid Logo */}
          <div className="flex items-center gap-2">
            <svg
              viewBox="0 0 24 24"
              className="h-8 w-8"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect width="24" height="24" rx="4" fill="#111111" />
              <path
                d="M7 8.5h2.5v7H7v-7zm3.75 0h2.5v7h-2.5v-7zm3.75 0H17v7h-2.5v-7z"
                fill="white"
              />
            </svg>
            <span className="text-lg font-semibold">Plaid</span>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">Recommended: Connect via Plaid</p>
            <p className="text-xs text-muted-foreground">
              Securely link your bank account for automatic balance updates
            </p>
          </div>
          <PlaidLinkButton
            className="w-full"
            onSuccess={() => {
              onConnectPlaid?.();
              onSuccess?.();
            }}
          >
            <Zap className="h-4 w-4 mr-2" />
            Connect Bank Account
          </PlaidLinkButton>
        </div>
      </div>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            Or enter manually
          </span>
        </div>
      </div>

      {/* Manual Entry Form */}
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

        <Button type="submit" variant="outline" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Adding..." : "Add Bank Account Manually"}
        </Button>
      </form>
    </div>
  );
}
