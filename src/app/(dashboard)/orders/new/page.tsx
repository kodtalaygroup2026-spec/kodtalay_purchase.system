import { redirect } from "next/navigation";

// PO creation is now inline on the PR detail page.
// /orders/new redirects to /requisitions where users can find approved PRs and create POs.
export default function NewOrderPage() {
  redirect("/requisitions");
}
