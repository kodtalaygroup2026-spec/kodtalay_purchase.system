"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface CategoryOption {
  id: string;
  code: string | null;
  name: string;
  mode: number;
  is_active: boolean;
}

const MODE_LABELS: Record<number, string> = {
  1: "งานจัดซื้อทั่วไป",
  2: "งานช่าง (เร็วๆ นี้)",
};

interface CategorySelectProps {
  name?: string;
  defaultValue?: string;
  className?: string;
}

/**
 * dropdown หมวดหมู่ จัดกลุ่มตาม MODE (optgroup)
 * — MODE 2 (ช่าง) แสดงแต่เลือกไม่ได้ (is_active=false)
 */
export function CategorySelect({
  name = "category_id",
  defaultValue = "",
  className,
}: CategorySelectProps) {
  const supabase = createClient();
  const [cats, setCats] = useState<CategoryOption[]>([]);
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    (supabase as any)
      .from("categories")
      .select("id, code, name, mode, is_active, sort_order")
      .order("mode")
      .order("sort_order")
      .then(({ data }: { data: CategoryOption[] | null }) => setCats(data ?? []));
  }, [supabase]);

  const modes = [...new Set(cats.map((c) => c.mode))].sort((a, b) => a - b);

  return (
    <select
      name={name}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      className={className}
    >
      <option value="">— ไม่ระบุ —</option>
      {modes.map((mode) => (
        <optgroup key={mode} label={MODE_LABELS[mode] ?? `MODE ${mode}`}>
          {cats
            .filter((c) => c.mode === mode)
            .map((c) => (
              <option key={c.id} value={c.id} disabled={!c.is_active}>
                {c.code ? `[${c.code}] ` : ""}
                {c.name}
                {!c.is_active ? " (เร็วๆ นี้)" : ""}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  );
}
