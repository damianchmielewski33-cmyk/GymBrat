"use client";

import { useId, useRef, type ChangeEventHandler, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
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
 * Niezawodny wybór pliku: ukryty input type=file + widoczny Button.
 * Unika przycięcia / martwej strefy natywnego „Wybierz plik” (h-10 + overflow-hidden + WebView).
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
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    const files = Array.from(e.target.files ?? []);
    onFiles(files);
    // Pozwala wybrać ten sam plik ponownie.
    e.target.value = "";
  };

  return (
    <div className={cn("relative z-10 flex flex-col gap-2", className)}>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="sr-only"
        tabIndex={-1}
        onChange={handleChange}
      />
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        aria-controls={inputId}
        className={cn("h-11 w-full justify-center sm:w-auto sm:min-w-[12rem]", buttonClassName)}
        onClick={() => {
          if (disabled) return;
          inputRef.current?.click();
        }}
      >
        {label ?? (valueLabel ? valueLabel : emptyLabel)}
      </Button>
    </div>
  );
}
