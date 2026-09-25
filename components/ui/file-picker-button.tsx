"use client";

import { useId, type ChangeEventHandler, type ReactNode } from "react";
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
 * klik musi trafiać w prawdziwy input type=file (nakładka opacity-0),
 * a nie w Button wywołujący input.click() — wtedy po powrocie z galerii
 * plik często nie trafia do inputa.
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

  const handleChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    const files = Array.from(e.target.files ?? []);
    onFiles(files);
    // Pozwala wybrać ten sam plik ponownie.
    e.target.value = "";
  };

  const text = label ?? (valueLabel ? valueLabel : emptyLabel);

  return (
    <div className={cn("relative z-10 inline-flex w-full sm:w-auto", className)}>
      <div
        className={cn(
          "gym-btn-outline pointer-events-none relative flex h-11 w-full min-w-0 items-center justify-center rounded-2xl px-5 text-sm sm:min-w-[12rem]",
          disabled && "opacity-45",
          buttonClassName,
        )}
        aria-hidden
      >
        {text}
      </div>
      <input
        id={inputId}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        aria-label={typeof text === "string" ? text : "Wybierz plik"}
        className={cn(
          "absolute inset-0 z-20 h-full w-full cursor-pointer opacity-0",
          disabled && "pointer-events-none",
        )}
        onChange={handleChange}
      />
    </div>
  );
}
