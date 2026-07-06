"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Plus, X, Users, Tag, Pencil, Check, Trash2, Loader2 } from "lucide-react";

export interface Position {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}
export interface PositionMember {
  id: string;
  position_id: string;
  user_id: string;
  user_name: string;
}
export interface CategoryRef {
  id: string;
  code: string | null;
  name: string;
  mode: number;
  position_id: string | null;
}
export interface UserRef {
  id: string;
  full_name: string;
  role: string;
}

interface Props {
  initialPositions: Position[];
  initialMembers: PositionMember[];
  categories: CategoryRef[];
  users: UserRef[];
}

export function PositionManagement({ initialPositions, initialMembers, categories, users }: Props) {
  const supabase = createClient();

  const [positions, setPositions] = useState<Position[]>(initialPositions);
  const [members, setMembers] = useState<PositionMember[]>(initialMembers);
  const [cats, setCats] = useState<CategoryRef[]>(categories);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  // ── ตำแหน่ง ────────────────────────────────────────────────────────────────
  async function addPosition() {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    const { data } = await (supabase as any)
      .from("approval_positions")
      .insert({ name })
      .select("id, name, description, is_active")
      .single();
    if (data) setPositions((p) => [...p, data]);
    setNewName("");
    setBusy(false);
  }

  async function saveRename(id: string) {
    const name = editName.trim();
    if (!name) { setEditingId(null); return; }
    await (supabase as any).from("approval_positions").update({ name }).eq("id", id);
    setPositions((p) => p.map((x) => (x.id === id ? { ...x, name } : x)));
    setEditingId(null);
  }

  async function deletePosition(id: string) {
    if (!confirm("ลบตำแหน่งนี้? หมวดที่ผูกอยู่จะกลายเป็นไม่ระบุตำแหน่ง")) return;
    await (supabase as any).from("approval_positions").delete().eq("id", id);
    setPositions((p) => p.filter((x) => x.id !== id));
    setMembers((m) => m.filter((x) => x.position_id !== id));
    setCats((c) => c.map((x) => (x.position_id === id ? { ...x, position_id: null } : x)));
  }

  // ── สมาชิก ─────────────────────────────────────────────────────────────────
  async function addMember(positionId: string, userId: string) {
    if (!userId) return;
    const { data } = await (supabase as any)
      .from("position_members")
      .insert({ position_id: positionId, user_id: userId })
      .select("id")
      .single();
    if (data) {
      const u = users.find((x) => x.id === userId);
      setMembers((m) => [...m, { id: data.id, position_id: positionId, user_id: userId, user_name: u?.full_name ?? "—" }]);
    }
  }

  async function removeMember(memberId: string) {
    await (supabase as any).from("position_members").delete().eq("id", memberId);
    setMembers((m) => m.filter((x) => x.id !== memberId));
  }

  // ── หมวด → ตำแหน่ง ──────────────────────────────────────────────────────────
  async function assignCategory(categoryId: string, positionId: string | null) {
    await (supabase as any).from("categories").update({ position_id: positionId }).eq("id", categoryId);
    setCats((c) => c.map((x) => (x.id === categoryId ? { ...x, position_id: positionId } : x)));
  }

  return (
    <div className="space-y-4">
      {/* เพิ่มตำแหน่ง */}
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addPosition()}
          placeholder="ชื่อตำแหน่งใหม่ เช่น จัดซื้ออาหาร"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        <button
          onClick={addPosition}
          disabled={busy || !newName.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} เพิ่มตำแหน่ง
        </button>
      </div>

      {positions.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-12 text-center text-sm text-slate-400">
          ยังไม่มีตำแหน่ง — เพิ่มด้านบน
        </div>
      )}

      {positions.map((pos) => {
        const posMembers = members.filter((m) => m.position_id === pos.id);
        const posCats = cats.filter((c) => c.position_id === pos.id);
        const memberUserIds = new Set(posMembers.map((m) => m.user_id));
        const availableUsers = users.filter((u) => !memberUserIds.has(u.id));
        const availableCats = cats.filter((c) => c.position_id !== pos.id);

        return (
          <div key={pos.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            {/* หัว: ชื่อ + ลบ */}
            <div className="mb-4 flex items-center justify-between gap-2">
              {editingId === pos.id ? (
                <div className="flex flex-1 items-center gap-2">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveRename(pos.id)}
                    autoFocus
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                  />
                  <button onClick={() => saveRename(pos.id)} className="rounded-lg bg-blue-600 p-1.5 text-white hover:bg-blue-700">
                    <Check size={14} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-slate-800">📌 {pos.name}</span>
                  <button
                    onClick={() => { setEditingId(pos.id); setEditName(pos.name); }}
                    className="rounded p-1 text-slate-300 hover:bg-slate-100 hover:text-slate-500"
                  >
                    <Pencil size={13} />
                  </button>
                </div>
              )}
              <button
                onClick={() => deletePosition(pos.id)}
                className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-100"
              >
                <Trash2 size={12} /> ลบ
              </button>
            </div>

            {/* ดูแลหมวด */}
            <div className="mb-4">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                <Tag size={13} /> ดูแลหมวด
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {posCats.length === 0 && <span className="text-xs text-slate-300">— ยังไม่ผูกหมวด —</span>}
                {posCats.map((c) => (
                  <span key={c.id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                    {c.code ? `[${c.code}] ` : ""}{c.name}
                    <button onClick={() => assignCategory(c.id, null)} className="text-slate-400 hover:text-red-500">
                      <X size={11} />
                    </button>
                  </span>
                ))}
                {availableCats.length > 0 && (
                  <select
                    value=""
                    onChange={(e) => e.target.value && assignCategory(e.target.value, pos.id)}
                    className="rounded-lg border border-dashed border-slate-300 bg-white px-2 py-1 text-xs text-slate-500 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">+ เพิ่มหมวด</option>
                    {availableCats.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code ? `[${c.code}] ` : ""}{c.name}{c.position_id ? " (ย้ายจากตำแหน่งอื่น)" : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* สมาชิก */}
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                <Users size={13} /> สมาชิก ({posMembers.length})
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {posMembers.length === 0 && <span className="text-xs text-slate-300">— ยังไม่มีสมาชิก —</span>}
                {posMembers.map((m) => (
                  <span key={m.id} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                    {m.user_name}
                    <button onClick={() => removeMember(m.id)} className="text-blue-400 hover:text-red-500">
                      <X size={11} />
                    </button>
                  </span>
                ))}
                {availableUsers.length > 0 && (
                  <select
                    value=""
                    onChange={(e) => e.target.value && addMember(pos.id, e.target.value)}
                    className="rounded-lg border border-dashed border-slate-300 bg-white px-2 py-1 text-xs text-slate-500 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">+ เพิ่มคน</option>
                    {availableUsers.map((u) => (
                      <option key={u.id} value={u.id}>{u.full_name}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
