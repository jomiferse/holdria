"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFormAction } from "@/components/hooks/use-form-action";
import { deletePortfolioAction, renamePortfolioAction } from "@/modules/portfolio/interface/actions";
import type { Portfolio } from "@/modules/portfolio/domain/portfolio";

/** Rename and delete controls for one portfolio, each behind an accessible confirmation dialog. */
export function PortfolioActions({ portfolio }: { portfolio: Portfolio }) {
  return (
    <div className="flex gap-2">
      <RenameDialog portfolio={portfolio} />
      <DeleteDialog portfolio={portfolio} />
    </div>
  );
}

function RenameDialog({ portfolio }: { portfolio: Portfolio }) {
  const [open, setOpen] = useState(false);
  const [state, dispatch, pending] = useFormAction(renamePortfolioAction, (result) => {
    if (result.status === "success") {
      toast.success(result.message);
      setOpen(false);
    } else if (result.status === "error" && !result.fieldErrors) {
      toast.error(result.message);
    }
  });

  const nameError = state.status === "error" ? state.fieldErrors?.name?.[0] : undefined;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Rename</Button>
      </DialogTrigger>
      <DialogContent>
        <form action={dispatch} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Rename portfolio</DialogTitle>
            <DialogDescription>Choose a new name for “{portfolio.name}”.</DialogDescription>
          </DialogHeader>
          <input type="hidden" name="id" value={portfolio.id} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rename-name">Portfolio name</Label>
            <Input
              id="rename-name"
              name="name"
              defaultValue={portfolio.name}
              required
              maxLength={80}
              aria-invalid={Boolean(nameError)}
              aria-describedby={nameError ? "rename-name-error" : undefined}
            />
            {nameError && (
              <p id="rename-name-error" className="text-sm text-destructive">
                {nameError}
              </p>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({ portfolio }: { portfolio: Portfolio }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, dispatch, pending] = useFormAction(deletePortfolioAction, (result) => {
    if (result.status === "success") {
      toast.success(result.message);
      setOpen(false);
      router.push("/portfolios");
    } else if (result.status === "error") {
      toast.error(result.message);
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">Delete</Button>
      </DialogTrigger>
      <DialogContent>
        <form action={dispatch} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Delete “{portfolio.name}”?</DialogTitle>
            <DialogDescription>
              This permanently removes the portfolio and its operations. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <input type="hidden" name="id" value={portfolio.id} />
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Deleting…" : "Delete portfolio"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
