"use client";

export function ChoiceField({
  label,
  options,
  value,
  error,
  onPick,
}: {
  label: string;
  options: readonly { value: string; label: string }[];
  value: string;
  error?: string;
  onPick: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.08em] text-faint">
        {label}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onPick(option.value)}
            aria-pressed={value === option.value}
            className={`rounded-full border px-3.5 py-2 text-[12.5px] font-medium transition ${
              value === option.value
                ? "border-violet bg-tint-soft text-violet-ink"
                : "border-line bg-white text-ink hover:border-violet/40"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <FieldError message={error} />
    </fieldset>
  );
}

export function TextField({
  id,
  label,
  value,
  error,
  maxLength,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  maxLength: number;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block" htmlFor={id}>
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[.08em] text-faint">
        {label}
      </span>
      <input
        id={id}
        type="text"
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-[10px] border border-line bg-white px-3.5 py-2.5 text-[13px] text-body placeholder:text-faint focus:border-violet focus:outline-none focus:ring-[3px] focus:ring-violet/15"
      />
      <FieldError message={error} />
    </label>
  );
}

export function NumberField({
  id,
  label,
  value,
  error,
  min,
  max,
  step,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  min: number;
  max: number;
  step: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block" htmlFor={id}>
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[.08em] text-faint">
        {label}
      </span>
      <input
        id={id}
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-[10px] border border-line bg-white px-3.5 py-2.5 text-[13px] text-body placeholder:text-faint focus:border-violet focus:outline-none focus:ring-[3px] focus:ring-violet/15"
      />
      <FieldError message={error} />
    </label>
  );
}

export function FieldError({ message }: { message?: string }) {
  return message ? (
    <span className="mt-1 block text-[11.5px] text-red">{message}</span>
  ) : null;
}
