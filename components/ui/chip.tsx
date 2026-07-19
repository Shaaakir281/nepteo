import { CHIP } from "./styles";

/** Chip cliquable (radio ou checkbox) — style onboarding/maquettes. */
export function Chip({
  type,
  name,
  value,
  defaultChecked,
  required,
}: {
  type: "radio" | "checkbox";
  name: string;
  value: string;
  defaultChecked?: boolean;
  required?: boolean;
}) {
  return (
    <label className={CHIP}>
      <input
        type={type}
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        required={required}
        className="sr-only"
      />
      {value}
    </label>
  );
}

export function ChipGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}
