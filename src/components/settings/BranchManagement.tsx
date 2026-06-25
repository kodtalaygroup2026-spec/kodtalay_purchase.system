"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Branch } from "@/types/database";

interface BranchManagementProps {
  initialBranches: Branch[];
}

export function BranchManagement({ initialBranches }: BranchManagementProps) {
  const supabase = createClient();
  const [branches, setBranches] = useState<Branch[]>(initialBranches);
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit(branch: Branch) {
    setEditingId(branch.id);
    setEditName(branch.name);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
  }

  function saveEdit(branch: Branch) {
    if (!editName.trim()) return;
    setError(null);
    startTransition(async () => {
      const { data, error: err } = await (supabase as any)
        .from("branches")
        .update({ name: editName.trim() })
        .eq("id", branch.id)
        .select()
        .single();

      if (err) {
        setError(err.message);
        return;
      }
      setBranches((prev) => prev.map((b) => (b.id === branch.id ? data : b)));
      setEditingId(null);
    });
  }

  function toggleActive(branch: Branch) {
    setError(null);
    startTransition(async () => {
      const { data, error: err } = await (supabase as any)
        .from("branches")
        .update({ is_active: !branch.is_active })
        .eq("id", branch.id)
        .select()
        .single();

      if (err) {
        setError(err.message);
        return;
      }
      setBranches((prev) => prev.map((b) => (b.id === branch.id ? data : b)));
    });
  }

  function addBranch() {
    if (!newCode.trim() || !newName.trim()) return;
    setError(null);
    startTransition(async () => {
      const { data, error: err } = await (supabase as any)
        .from("branches")
        .insert({ code: newCode.trim().toUpperCase(), name: newName.trim() })
        .select()
        .single();

      if (err) {
        setError(err.message);
        return;
      }
      setBranches((prev) => [...prev, data]);
      setNewCode("");
      setNewName("");
      setShowAddForm(false);
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-700">รายการสาขา</h2>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
          >
            <Plus size={14} />
            เพิ่มสาขา
          </button>
        </div>

        {showAddForm && (
          <div className="flex items-center gap-2 border-b border-slate-100 bg-blue-50 px-4 py-3">
            <input
              type="text"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              placeholder="รหัส (เช่น CK)"
              maxLength={10}
              className="w-24 rounded-lg border border-slate-200 px-3 py-1.5 text-sm uppercase outline-none focus:border-blue-400"
            />
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="ชื่อสาขา"
              className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-blue-400"
            />
            <button
              disabled={isPending || !newCode.trim() || !newName.trim()}
              onClick={addBranch}
              className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              บันทึก
            </button>
            <button
              onClick={() => { setShowAddForm(false); setNewCode(""); setNewName(""); }}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50"
            >
              ยกเลิก
            </button>
          </div>
        )}

        <table className="min-w-full text-sm">
          <thead className="border-b border-slate-100">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-slate-500">รหัส</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">ชื่อสาขา</th>
              <th className="px-4 py-3 text-center font-medium text-slate-500">สถานะ</th>
              <th className="px-4 py-3 text-center font-medium text-slate-500">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {branches.map((branch) => (
              <tr key={branch.id} className={!branch.is_active ? "opacity-50" : ""}>
                <td className="px-4 py-3 font-mono text-xs font-medium text-slate-700">
                  {branch.code}
                </td>
                <td className="px-4 py-3">
                  {editingId === branch.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-1 rounded-lg border border-blue-300 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-100"
                        autoFocus
                      />
                      <button
                        onClick={() => saveEdit(branch)}
                        disabled={isPending}
                        className="text-green-600 hover:text-green-700"
                      >
                        <Check size={16} />
                      </button>
                      <button onClick={cancelEdit} className="text-slate-400 hover:text-slate-600">
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <span className="text-slate-800">{branch.name}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => toggleActive(branch)}
                    disabled={isPending}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      branch.is_active
                        ? "bg-green-100 text-green-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {branch.is_active ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  {editingId !== branch.id && (
                    <button
                      onClick={() => startEdit(branch)}
                      className="text-slate-400 hover:text-blue-600"
                    >
                      <Pencil size={15} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
