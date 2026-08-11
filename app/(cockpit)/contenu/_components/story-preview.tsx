"use client";

import Image from "next/image";
import {
  CREATIVE_IMAGE_FORMATS,
  type CreativeImageFormat,
} from "@/lib/creative-image-rules";

const FRAME: Record<CreativeImageFormat, string> = {
  story: "aspect-[9/16] w-full max-w-[332px]",
  square: "aspect-square w-full max-w-[590px]",
  landscape: "aspect-[3/2] w-full max-w-[885px]",
};

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 4);
}

export function StoryPreview({
  format,
  headline,
  image,
  loading,
}: {
  format: CreativeImageFormat;
  headline: string;
  image: string | null;
  loading: boolean;
}) {
  const spec = CREATIVE_IMAGE_FORMATS[format];

  async function download() {
    if (!image) return;
    const [width, height] = spec.size.split("x").map(Number);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return;

    const source = new window.Image();
    source.crossOrigin = "anonymous";
    source.src = image;
    await source.decode();
    context.drawImage(source, 0, 0, width, height);

    const gradient = context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "rgba(20,16,13,.72)");
    gradient.addColorStop(0.42, "rgba(20,16,13,.06)");
    gradient.addColorStop(1, "rgba(20,16,13,.52)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    const fontSize = Math.round(width * 0.065);
    context.fillStyle = "white";
    context.font = `600 ${fontSize}px Manrope, Arial, sans-serif`;
    context.textBaseline = "top";
    const x = Math.round(width * 0.08);
    const lines = wrapText(context, headline, width * 0.82);
    lines.forEach((line, index) => {
      context.fillText(line, x, height * 0.12 + index * fontSize * 1.16);
    });

    context.font = `600 ${Math.round(fontSize * 0.34)}px Geist, Arial, sans-serif`;
    const cta = "DÉCOUVRIR";
    const ctaWidth = context.measureText(cta).width + width * 0.09;
    const ctaHeight = fontSize * 0.72;
    const ctaY = height - ctaHeight - height * 0.08;
    context.fillStyle = "#ffffff";
    context.beginPath();
    context.roundRect(x, ctaY, ctaWidth, ctaHeight, ctaHeight / 2);
    context.fill();
    context.fillStyle = "#1c1713";
    context.textBaseline = "middle";
    context.fillText(cta, x + width * 0.045, ctaY + ctaHeight / 2);

    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/jpeg", 0.92);
    link.download = `nepteo-${format}.jpg`;
    link.click();
  }

  return (
    <aside className="rounded-[12px] border border-line bg-tint-soft p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[.09em] text-muted">
            Aperçu
          </p>
          <p className="mt-0.5 text-[11.5px] text-faint">
            {spec.label} · {spec.ratio}
          </p>
        </div>
        {image && (
          <button
            type="button"
            onClick={download}
            className="rounded-[8px] border border-line bg-white px-3 py-1.5 text-[11.5px] font-semibold text-ink transition hover:bg-tint"
          >
            Télécharger
          </button>
        )}
      </div>

      <div
        className={`relative mx-auto overflow-hidden rounded-[16px] border-[5px] border-[#211c18] bg-[#ddd4c7] shadow-[0_18px_42px_rgba(28,23,19,.16)] ${FRAME[format]}`}
      >
        {image ? (
          <Image
            src={image}
            alt="Visuel généré pour votre contenu"
            fill
            unoptimized
            sizes="420px"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_22%,#f6dfd8,transparent_30%),radial-gradient(circle_at_78%_66%,#d8e3f2,transparent_34%),linear-gradient(145deg,#f2e9dc,#e7ded2)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/45" />
        <div className="absolute inset-x-[8%] top-[10%] z-10">
          <p className="font-display text-[clamp(18px,3.2vw,30px)] font-semibold leading-[1.08] text-white drop-shadow-sm">
            {headline}
          </p>
        </div>
        <span className="absolute bottom-[7%] left-[8%] z-10 rounded-full bg-white px-4 py-2 text-[10px] font-semibold uppercase tracking-[.08em] text-ink">
          Découvrir
        </span>
        {loading && (
          <div className="absolute inset-0 z-20 grid place-items-center bg-[#f7f4ee]/88 backdrop-blur-sm">
            <div className="text-center">
              <span className="mx-auto block h-7 w-7 animate-spin rounded-full border-2 border-line border-t-[#8a232d]" />
              <p className="mt-3 text-[12px] font-medium text-ink">
                Création en cours
              </p>
              <p className="mt-1 text-[10.5px] text-muted">Cela peut prendre une minute</p>
            </div>
          </div>
        )}
      </div>
      <p className="mt-4 text-center text-[10.5px] leading-relaxed text-muted">
        Le texte reste net et modifiable. Le visuel est créé sans logo inventé.
      </p>
    </aside>
  );
}
