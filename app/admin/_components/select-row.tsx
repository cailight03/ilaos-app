"use client";

import { ChevronsUpDown, type LucideIcon } from "lucide-react";
import { Dropdown, type DropdownOption } from "./dropdown";

/** Settings-style row: label on the left, current value + chevrons on the right, opens a popover menu. */
export function SelectRow({
  label,
  value,
  options,
  onChange,
  Icon,
}: {
  label: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  Icon: LucideIcon;
}) {
  return (
    <Dropdown
      title={label}
      ariaLabel={label}
      value={value}
      options={options}
      onChange={onChange}
      triggerClassName="flex w-full items-center gap-3 pl-4 text-left transition-colors active:bg-fill group-first/row:rounded-t-xl group-last/row:rounded-b-xl"
    >
      {({ current }) => (
        <>
          <span className="flex size-7 shrink-0 items-center justify-center rounded-[7px] bg-brand text-white">
            <Icon className="size-4" aria-hidden />
          </span>
          <span className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-2 border-b border-separator pr-3.5 text-[17px] group-last/row:border-b-0">
            {label}
            <span className="flex min-w-0 items-center gap-1 text-label2">
              <span className="truncate">{current}</span>
              <ChevronsUpDown className="size-4 shrink-0" aria-hidden />
            </span>
          </span>
        </>
      )}
    </Dropdown>
  );
}
