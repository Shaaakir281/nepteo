import type { MemoryContent, Offer } from "@/lib/memory";
import { MarketingMemoryFields } from "./marketing-memory-fields";
import { SellingMemoryFields } from "./selling-memory-fields";
import { VoiceMemoryFields } from "./voice-memory-fields";

export function IdentityCard({
  mem,
  offers,
  canEdit,
  saved,
}: {
  mem: Partial<MemoryContent>;
  offers: Offer[];
  canEdit: boolean;
  saved?: string;
}) {
  return (
    <div>
      <SellingMemoryFields
        mem={mem}
        offers={offers}
        canEdit={canEdit}
        saved={saved}
      />
      <VoiceMemoryFields mem={mem} canEdit={canEdit} saved={saved} />
      <MarketingMemoryFields mem={mem} canEdit={canEdit} saved={saved} />
    </div>
  );
}
