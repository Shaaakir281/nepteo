import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;
type ExecutionControl = "pause" | "autonomy";

const ERROR_PREFIX: Record<ExecutionControl, string> = {
  pause: "execution_pause",
  autonomy: "autonomy",
};

/** Change une garde d'exécution et son journal dans une RPC transactionnelle. */
export async function changeExecutionControl(
  admin: Admin,
  orgId: string,
  actorId: string,
  control: ExecutionControl,
  value: string | boolean,
): Promise<void> {
  const { data, error } = await admin.rpc("change_execution_control", {
    p_organization_id: orgId,
    p_actor_id: actorId,
    p_control: control,
    p_value: String(value),
  });
  if (error) {
    throw new Error(`${ERROR_PREFIX[control]}_update_failed`);
  }
  const changed =
    Boolean(data) &&
    typeof data === "object" &&
    !Array.isArray(data) &&
    (data as Record<string, unknown>).changed === true;
  if (!changed) {
    throw new Error(`${ERROR_PREFIX[control]}_update_not_applied`);
  }
}
