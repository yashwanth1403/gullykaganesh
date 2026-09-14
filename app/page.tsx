import { Suspense } from "react";
import Home from "@/components/Home";
import { SignInPromptProvider } from "@/components/SignInPrompt";
import { getLivePandals } from "@/lib/queries";

/**
 * Regenerated at most once a minute, and immediately after a submission via
 * revalidatePath("/"). During the festival the whole city hits this one
 * route, so it must not run a query per visitor.
 */
export const revalidate = 60;

export default async function Page() {
  const pandals = await getLivePandals();
  return (
    // useSearchParams in Home needs a boundary; nothing streams, it only
    // keeps the shell static.
    <Suspense>
      <SignInPromptProvider>
        <Home pandals={pandals} />
      </SignInPromptProvider>
    </Suspense>
  );
}
