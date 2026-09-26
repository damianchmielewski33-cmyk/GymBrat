"use client";

import { useId, useState, type ChangeEventHandler, type ReactNode } from "react";
import { snapshotFiles } from "@/lib/file-snapshot";
import { cn } from "@/lib/utils";

type FilePickerButtonProps = {
  id?: string;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  label?: ReactNode;
  emptyLabel?: ReactNode;
  valueLabel?: ReactNode;
  onFiles: (files: File[]) => void;
};

/**
 * Wybór pliku odporny na Android WebView:
 * klik musi trafiać w prawdziwy input type=file (nakładka opacity-0).
 * Bajty kopiujemy ZANIM wyczyścimy input — inaczej File ma size 0.
 */
export function FilePickerButton({
  id,
  accept,
  multiple = false,
  disabled = false,
  className,
  buttonClassName,
  label,
  emptyLabel = "Wybierz plik",
  valueLabel,
  onFiles,
}: FilePickerButtonProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const [reading, setReading] = useState(false);

  const handleChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    const input = e.currentTarget;
    const files = Array.from(input.files ?? []);
    if (files.length === 0) {
      onFiles([]);
      return;
    }
    setReading(true);
    void snapshotFiles(files)
      .then((copies) => {
        onFiles(copies);
      })
      .catch(() => {
        onFiles(files);
      })
      .finally(() => {
        input.value = "";
        setReading(false);
      });
  };

  const text =
    label ??
    (reading ? "Odczytywanie pliku…" : valueLabel ? valueLabel : emptyLabel);

  return (
    <div className={cn("relative z-10 inline-flex w-full sm:w-auto", className)}>
      <div
        className={cn(
          "gym-btn-outline pointer-events-none relative flex h-11 w-full min-w-0 items-center justify-center rounded-2xl px-5 text-sm sm:min-w-[12rem]",
          (disabled || reading) && "opacity-45",
          buttonClassName,
        )}
        aria-hidden
      >
        {text}
      </div>
      <input
        id={inputId}
        type="file"
        {...(accept && accept !== "*/*" ? { accept } : {})}
        multiple={multiple}
        disabled={disabled || reading}
        aria-label={typeof text === "string" ? text : "Wybierz plik"}
        className={cn(
          "absolute inset-0 z-20 h-full w-full cursor-pointer opacity-0",
          (disabled || reading) && "pointer-events-none",
        )}
        onChange={handleChange}
      />
    </div>
  );
}
